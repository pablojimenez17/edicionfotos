/// ICC Profile generators and binary payloads for sRGB, Display P3, and Adobe RGB (1998)
use img_parts::Bytes;

/// Generates a valid standard ICC v2.1 display profile for the given color space name
pub fn get_icc_profile(color_space: &str) -> Option<Bytes> {
    let name = color_space.to_lowercase();
    match name.as_str() {
        "srgb" => Some(Bytes::from(create_matrix_icc("sRGB v2 (Lumen)", &[0.43607, 0.38515, 0.14307], &[0.22250, 0.71687, 0.06061], &[0.01393, 0.09708, 0.71410], 2.2))),
        "display-p3" | "display_p3" | "p3" => Some(Bytes::from(create_matrix_icc("Display P3 (Lumen)", &[0.51512, 0.24120, -0.00105], &[0.29198, 0.69225, 0.04189], &[0.15710, 0.06655, 0.78407], 2.2))),
        "adobe-rgb" | "adobergb" | "adobe_rgb" => Some(Bytes::from(create_matrix_icc("Adobe RGB (1998) (Lumen)", &[0.57673, 0.29738, 0.02703], &[0.18555, 0.62735, 0.07069], &[0.18819, 0.07527, 0.99110], 2.2))),
        _ => Some(Bytes::from(create_matrix_icc("sRGB (Lumen Standard)", &[0.43607, 0.38515, 0.14307], &[0.22250, 0.71687, 0.06061], &[0.01393, 0.09708, 0.71410], 2.2))),
    }
}

/// Constructs a minimal valid 128-byte ICC profile header + standard tags (desc, wtpt, rXYZ, gXYZ, bXYZ, rTRC, gTRC, bTRC)
fn create_matrix_icc(desc: &str, r_xyz: &[f64; 3], g_xyz: &[f64; 3], b_xyz: &[f64; 3], gamma: f64) -> Vec<u8> {
    let mut profile = vec![0u8; 128]; // 128-byte header

    // Header fields (ICC v2.1)
    profile[4..8].copy_from_slice(b"LUMN"); // CMM type
    profile[8] = 0x02; // version 2.1
    profile[9] = 0x10;
    profile[12..16].copy_from_slice(b"mntr"); // Monitor device class
    profile[16..20].copy_from_slice(b"RGB "); // Data colour space
    profile[20..24].copy_from_slice(b"XYZ "); // PCS
    profile[36..40].copy_from_slice(b"acsp"); // Magic signature
    profile[40..44].copy_from_slice(b"MSFT"); // Primary platform
    profile[68..72].copy_from_slice(b"LUMN"); // Device manufacturer

    // D50 Illuminant in s15Fixed16Number
    // X=0.9642 (0x0000F6D6), Y=1.0 (0x00010000), Z=0.8249 (0x0000D32D)
    profile[72..76].copy_from_slice(&0x0000F6D6u32.to_be_bytes());
    profile[76..80].copy_from_slice(&0x00010000u32.to_be_bytes());
    profile[80..84].copy_from_slice(&0x0000D32Du32.to_be_bytes());

    // Tag table (8 tags: desc, wtpt, rXYZ, gXYZ, bXYZ, rTRC, gTRC, bTRC)
    let tag_count = 8u32;
    let mut tag_table = Vec::new();
    tag_table.extend_from_slice(&tag_count.to_be_bytes());

    let mut tag_data = Vec::new();

    // Helper to add tag
    let mut add_tag = |tag_sig: &[u8; 4], data: &[u8]| {
        let offset = 128 + 4 + (tag_count as usize * 12) + tag_data.len();
        tag_table.extend_from_slice(tag_sig);
        tag_table.extend_from_slice(&(offset as u32).to_be_bytes());
        tag_table.extend_from_slice(&(data.len() as u32).to_be_bytes());
        tag_data.extend_from_slice(data);
        // Align to 4 bytes
        while tag_data.len() % 4 != 0 {
            tag_data.push(0);
        }
    };

    // 1. 'desc' tag
    let mut desc_data = Vec::new();
    desc_data.extend_from_slice(b"desc");
    desc_data.extend_from_slice(&[0, 0, 0, 0]); // Reserved
    desc_data.extend_from_slice(&((desc.len() + 1) as u32).to_be_bytes());
    desc_data.extend_from_slice(desc.as_bytes());
    desc_data.push(0);
    desc_data.extend_from_slice(&[0u8; 67]); // Rest of desc structure
    add_tag(b"desc", &desc_data);

    // 2. 'wtpt' tag (D50)
    let mut wtpt_data = Vec::new();
    wtpt_data.extend_from_slice(b"XYZ ");
    wtpt_data.extend_from_slice(&[0, 0, 0, 0]);
    wtpt_data.extend_from_slice(&0x0000F6D6u32.to_be_bytes());
    wtpt_data.extend_from_slice(&0x00010000u32.to_be_bytes());
    wtpt_data.extend_from_slice(&0x0000D32Du32.to_be_bytes());
    add_tag(b"wtpt", &wtpt_data);

    // Helper for XYZ tag
    let encode_xyz = |xyz: &[f64; 3]| -> Vec<u8> {
        let mut d = Vec::new();
        d.extend_from_slice(b"XYZ ");
        d.extend_from_slice(&[0, 0, 0, 0]);
        for &val in xyz {
            let fixed = (val * 65536.0).round() as i32;
            d.extend_from_slice(&fixed.to_be_bytes());
        }
        d
    };

    // 3. 'rXYZ', 4. 'gXYZ', 5. 'bXYZ'
    add_tag(b"rXYZ", &encode_xyz(r_xyz));
    add_tag(b"gXYZ", &encode_xyz(g_xyz));
    add_tag(b"bXYZ", &encode_xyz(b_xyz));

    // 6, 7, 8: 'rTRC', 'gTRC', 'bTRC' (Simple Gamma curve)
    let mut trc_data = Vec::new();
    trc_data.extend_from_slice(b"curv");
    trc_data.extend_from_slice(&[0, 0, 0, 0]);
    trc_data.extend_from_slice(&1u32.to_be_bytes()); // 1 entry = exponent
    let gamma_fixed = ((gamma * 256.0).round() as u16).to_be_bytes();
    trc_data.extend_from_slice(&gamma_fixed);

    add_tag(b"rTRC", &trc_data);
    add_tag(b"gTRC", &trc_data);
    add_tag(b"bTRC", &trc_data);

    // Assemble final profile
    profile.extend_from_slice(&tag_table);
    profile.extend_from_slice(&tag_data);

    // Write final total size in first 4 bytes of header
    let total_len = profile.len() as u32;
    profile[0..4].copy_from_slice(&total_len.to_be_bytes());

    profile
}
