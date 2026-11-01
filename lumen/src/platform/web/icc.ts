/**
 * Pure JavaScript standard ICC v2.1 profile generator for sRGB, Display P3, and Adobe RGB (1998).
 * Injects APP2 ICC profile and APP1 EXIF markers directly into JPEG binaries.
 */

export function getWebIccProfile(colorSpace: string): Uint8Array {
  const cs = (colorSpace || 'srgb').toLowerCase();
  switch (cs) {
    case 'display-p3':
    case 'display_p3':
    case 'p3':
      return createMatrixIcc(
        'Display P3 (Lumen Web)',
        [0.51512, 0.2412, -0.00105],
        [0.29198, 0.69225, 0.04189],
        [0.1571, 0.06655, 0.78407],
        2.2
      );
    case 'adobe-rgb':
    case 'adobergb':
    case 'adobe_rgb':
      return createMatrixIcc(
        'Adobe RGB (1998) (Lumen Web)',
        [0.57673, 0.29738, 0.02703],
        [0.18555, 0.62735, 0.07069],
        [0.18819, 0.07527, 0.9911],
        2.2
      );
    case 'srgb':
    default:
      return createMatrixIcc(
        'sRGB v2 (Lumen Web)',
        [0.43607, 0.38515, 0.14307],
        [0.2225, 0.71687, 0.06061],
        [0.01393, 0.09708, 0.7141],
        2.2
      );
  }
}

function writeU32BE(target: Uint8Array, offset: number, value: number) {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function writeU16BE(target: Uint8Array, offset: number, value: number) {
  target[offset] = (value >>> 8) & 0xff;
  target[offset + 1] = value & 0xff;
}

function createMatrixIcc(
  desc: string,
  rXyz: [number, number, number],
  gXyz: [number, number, number],
  bXyz: [number, number, number],
  gamma: number
): Uint8Array {
  const header = new Uint8Array(128);
  const encoder = new TextEncoder();

  // Header fields
  header.set(encoder.encode('LUMN'), 4);
  header[8] = 0x02; // version 2.1
  header[9] = 0x10;
  header.set(encoder.encode('mntr'), 12);
  header.set(encoder.encode('RGB '), 16);
  header.set(encoder.encode('XYZ '), 20);
  header.set(encoder.encode('acsp'), 36);
  header.set(encoder.encode('MSFT'), 40);
  header.set(encoder.encode('LUMN'), 68);

  // D50 Illuminant
  writeU32BE(header, 72, 0x0000f6d6);
  writeU32BE(header, 76, 0x00010000);
  writeU32BE(header, 80, 0x0000d32d);

  const tagCount = 8;
  const tagTable: number[] = [];
  // Tag count
  tagTable.push((tagCount >>> 24) & 0xff, (tagCount >>> 16) & 0xff, (tagCount >>> 8) & 0xff, tagCount & 0xff);

  const tagData: number[] = [];

  const addTag = (tagSig: string, data: Uint8Array) => {
    const offset = 128 + 4 + tagCount * 12 + tagData.length;
    const sigBytes = encoder.encode(tagSig);
    for (let i = 0; i < 4; i++) tagTable.push(sigBytes[i]);
    tagTable.push((offset >>> 24) & 0xff, (offset >>> 16) & 0xff, (offset >>> 8) & 0xff, offset & 0xff);
    tagTable.push((data.length >>> 24) & 0xff, (data.length >>> 16) & 0xff, (data.length >>> 8) & 0xff, data.length & 0xff);

    for (let i = 0; i < data.length; i++) tagData.push(data[i]);
    while (tagData.length % 4 !== 0) tagData.push(0);
  };

  // 1. desc
  const descBytes = encoder.encode(desc);
  const descTag = new Uint8Array(12 + descBytes.length + 1 + 67);
  descTag.set(encoder.encode('desc'), 0);
  writeU32BE(descTag, 8, descBytes.length + 1);
  descTag.set(descBytes, 12);
  addTag('desc', descTag);

  // 2. wtpt
  const wtptTag = new Uint8Array(20);
  wtptTag.set(encoder.encode('XYZ '), 0);
  writeU32BE(wtptTag, 8, 0x0000f6d6);
  writeU32BE(wtptTag, 12, 0x010000);
  writeU32BE(wtptTag, 16, 0x0000d32d);
  addTag('wtpt', wtptTag);

  // Helper XYZ
  const encodeXyz = (xyz: [number, number, number]) => {
    const b = new Uint8Array(20);
    b.set(encoder.encode('XYZ '), 0);
    for (let i = 0; i < 3; i++) {
      const fixed = Math.round(xyz[i] * 65536);
      writeU32BE(b, 8 + i * 4, fixed);
    }
    return b;
  };

  addTag('rXYZ', encodeXyz(rXyz));
  addTag('gXYZ', encodeXyz(gXyz));
  addTag('bXYZ', encodeXyz(bXyz));

  // TRC
  const trcTag = new Uint8Array(14);
  trcTag.set(encoder.encode('curv'), 0);
  writeU32BE(trcTag, 8, 1);
  writeU16BE(trcTag, 12, Math.round(gamma * 256));

  addTag('rTRC', trcTag);
  addTag('gTRC', trcTag);
  addTag('bTRC', trcTag);

  const totalLen = 128 + tagTable.length + tagData.length;
  writeU32BE(header, 0, totalLen);

  const finalProfile = new Uint8Array(totalLen);
  finalProfile.set(header, 0);
  finalProfile.set(new Uint8Array(tagTable), 128);
  finalProfile.set(new Uint8Array(tagData), 128 + tagTable.length);

  return finalProfile;
}

/**
 * Injects an ICC profile into a JPEG Uint8Array via APP2 marker (0xFF, 0xE2).
 */
export function injectIccProfileIntoJpeg(
  jpegBytes: Uint8Array,
  iccProfile: Uint8Array
): Uint8Array {
  if (jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) {
    return jpegBytes; // Not a valid JPEG
  }

  // Construct APP2 payload
  // Header: 'ICC_PROFILE\0' (12 bytes) + seq (1 byte: 1) + total (1 byte: 1) = 14 bytes
  const idBytes = new TextEncoder().encode('ICC_PROFILE\0');
  const payloadLen = 2 + 14 + iccProfile.length; // +2 for length marker itself
  const app2 = new Uint8Array(2 + 2 + 14 + iccProfile.length);
  app2[0] = 0xff;
  app2[1] = 0xe2;
  app2[2] = (payloadLen >>> 8) & 0xff;
  app2[3] = payloadLen & 0xff;
  app2.set(idBytes, 4);
  app2[4 + idBytes.length] = 1; // seq
  app2[4 + idBytes.length + 1] = 1; // total
  app2.set(iccProfile, 4 + 14);

  // Insert right after SOI (index 2)
  const result = new Uint8Array(jpegBytes.length + app2.length);
  result.set(jpegBytes.subarray(0, 2), 0);
  result.set(app2, 2);
  result.set(jpegBytes.subarray(2), 2 + app2.length);

  return result;
}
