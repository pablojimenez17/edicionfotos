use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Metadata extracted from a scanned image file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannedPhoto {
    pub filename: String,
    pub rel_path: String,       // relative to root folder (or filename if single file)
    pub file_path: String,      // absolute / full normalized path
    pub file_size: u64,
    pub file_hash: String,      // partial: SHA-256(size + first 1MB + last 1MB)
    pub file_mtime: String,     // ISO 8601
    pub width: u32,
    pub height: u32,
    pub orientation: u32,
    pub format: String,
    pub color_space: String,
    pub has_embedded_preview: bool,
    pub warning: Option<String>,
    // EXIF fields
    pub date_taken: Option<String>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub lens: Option<String>,
    pub focal_length: Option<f64>,
    pub aperture: Option<f64>,
    pub shutter_speed: Option<String>,
    pub iso: Option<u32>,
    pub gps_lat: Option<f64>,
    pub gps_lng: Option<f64>,
}

/// Pre-scan summary result returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub photos: Vec<ScannedPhoto>,
    pub total_found: usize,
    pub unsupported_count: usize,
    pub corrupted_count: usize,
    pub warnings: Vec<String>,
}

/// Removable or external drive detected
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemovableDrive {
    pub path: String,       // e.g. "E:\\"
    pub label: String,      // e.g. "SD_CARD (E:)"
    pub drive_type: String, // "removable", "cdrom"
}

/// Standard bitmap/lossless image extensions
const STANDARD_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "tiff", "tif", "webp", "bmp", "gif",
];

/// RAW image extensions
const RAW_EXTENSIONS: &[&str] = &[
    "cr2", "cr3", "nef", "arw", "orf", "rw2", "raf", "dng", "pef",
    "srw", "x3f", "3fr", "rwl", "mrw",
];

/// Compute partial file hash: SHA-256 of (file_size as bytes + first 1MB + last 1MB)
pub fn partial_hash(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let file_size = metadata.len();

    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();

    // Hash the file size
    hasher.update(file_size.to_le_bytes());

    // First 1MB
    let chunk_size = 1024 * 1024;
    let mut buf = vec![0u8; chunk_size.min(file_size as usize)];
    let n = file.read(&mut buf).map_err(|e| e.to_string())?;
    hasher.update(&buf[..n]);

    // Last 1MB (if file is larger than 1MB)
    if file_size > chunk_size as u64 {
        let seek_pos = file_size.saturating_sub(chunk_size as u64);
        file.seek(SeekFrom::Start(seek_pos)).map_err(|e| e.to_string())?;
        let mut buf2 = vec![0u8; chunk_size];
        let n2 = file.read(&mut buf2).map_err(|e| e.to_string())?;
        hasher.update(&buf2[..n2]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Read EXIF data from a file
fn read_exif(path: &Path) -> Option<exif::Exif> {
    let file = std::fs::File::open(path).ok()?;
    let mut reader = std::io::BufReader::new(file);
    let exif_reader = exif::Reader::new();
    exif_reader.read_from_container(&mut reader).ok()
}

fn exif_string(exif: &exif::Exif, tag: exif::Tag) -> Option<String> {
    exif.get_field(tag, exif::In::PRIMARY)
        .map(|f| f.display_value().to_string().trim().to_string())
        .filter(|s| !s.is_empty())
}

fn exif_rational_f64(exif: &exif::Exif, tag: exif::Tag) -> Option<f64> {
    let field = exif.get_field(tag, exif::In::PRIMARY)?;
    match &field.value {
        exif::Value::Rational(v) if !v.is_empty() => Some(v[0].to_f64()),
        _ => None,
    }
}

fn exif_u32(exif: &exif::Exif, tag: exif::Tag) -> Option<u32> {
    let field = exif.get_field(tag, exif::In::PRIMARY)?;
    match &field.value {
        exif::Value::Short(v) if !v.is_empty() => Some(v[0] as u32),
        exif::Value::Long(v) if !v.is_empty() => Some(v[0]),
        _ => None,
    }
}

/// Read GPS coordinates from EXIF
fn read_gps(exif: &exif::Exif) -> (Option<f64>, Option<f64>) {
    let lat = exif_gps_coord(exif, exif::Tag::GPSLatitude, exif::Tag::GPSLatitudeRef);
    let lng = exif_gps_coord(exif, exif::Tag::GPSLongitude, exif::Tag::GPSLongitudeRef);
    (lat, lng)
}

fn exif_gps_coord(exif: &exif::Exif, tag: exif::Tag, ref_tag: exif::Tag) -> Option<f64> {
    let field = exif.get_field(tag, exif::In::PRIMARY)?;
    let ref_field = exif.get_field(ref_tag, exif::In::PRIMARY)?;

    if let exif::Value::Rational(parts) = &field.value {
        if parts.len() >= 3 {
            let degrees = parts[0].to_f64();
            let minutes = parts[1].to_f64();
            let seconds = parts[2].to_f64();
            let mut coord = degrees + minutes / 60.0 + seconds / 3600.0;

            let ref_str = ref_field.display_value().to_string();
            if ref_str.contains('S') || ref_str.contains('W') {
                coord = -coord;
            }
            return Some(coord);
        }
    }
    None
}

/// Process a single candidate file path
pub fn process_candidate_file(
    path: &Path,
    root_prefix: Option<&Path>,
) -> Result<Option<ScannedPhoto>, (bool, String)> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    let is_standard = STANDARD_EXTENSIONS.contains(&ext.as_str());
    let is_raw = RAW_EXTENSIONS.contains(&ext.as_str());

    if !is_standard && !is_raw {
        // Unsupported format: return false = unsupported
        return Err((false, format!("Formato no compatible: {}", ext)));
    }

    let meta = match fs::metadata(path) {
        Ok(m) => m,
        Err(e) => return Err((true, format!("No se puede leer metadatos: {}", e))),
    };

    let file_size = meta.len();
    if file_size == 0 {
        return Err((true, "Archivo vacío (0 bytes)".to_string()));
    }

    let file_mtime = meta
        .modified()
        .ok()
        .map(|t| {
            let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
            format_unix_timestamp(duration.as_secs())
        })
        .unwrap_or_default();

    let rel_path = if let Some(root) = root_prefix {
        path.strip_prefix(root)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string()
            .replace('\\', "/")
    } else {
        path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    };

    let filename = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let file_path = path.to_string_lossy().to_string().replace('\\', "/");
    let file_hash = partial_hash(path).unwrap_or_default();

    let mut width = 0u32;
    let mut height = 0u32;
    let mut orientation = 1u32;
    let format = ext.clone();
    let color_space = "srgb".to_string();
    let mut has_embedded_preview = false;
    let mut warning = None;

    let maybe_exif = read_exif(path);

    if is_standard {
        // Standard formats: try reading dimensions from image crate
        match image::image_dimensions(path) {
            Ok((w, h)) => {
                width = w;
                height = h;
            }
            Err(_) => {
                // If image crate fails, check if EXIF provides dimensions
                if let Some(ref exif) = maybe_exif {
                    if let Some(w) = exif_u32(exif, exif::Tag::PixelXDimension) {
                        width = w;
                    }
                    if let Some(h) = exif_u32(exif, exif::Tag::PixelYDimension) {
                        height = h;
                    }
                }
                if width == 0 || height == 0 {
                    return Err((true, format!("Cabecera de imagen corrupta o no legible: {}", filename)));
                }
            }
        }
    } else if is_raw {
        // RAW formats: try extracting preview or decode
        // Check if rawloader can parse it
        let raw_decoded = rawloader::decode_file(path);
        match raw_decoded {
            Ok(raw) => {
                width = raw.width as u32;
                height = raw.height as u32;
            }
            Err(_) => {
                // If rawloader fails to decode sensor data, check EXIF / embedded preview
                if let Some(ref exif) = maybe_exif {
                    if let Some(w) = exif_u32(exif, exif::Tag::PixelXDimension) {
                        width = w;
                    }
                    if let Some(h) = exif_u32(exif, exif::Tag::PixelYDimension) {
                        height = h;
                    }
                }
                // Try preview extraction via find_embedded_jpeg or check if EXIF gave dimensions
                if crate::commands::raw::find_embedded_jpeg(path).is_ok() || width > 0 {
                    has_embedded_preview = true;
                    warning = Some("RAW importado con su vista previa embebida (decodificación directa de sensor no disponible)".to_string());
                } else {
                    return Err((true, format!("Archivo RAW corrupto o sin vista previa: {}", filename)));
                }
            }
        }
    }

    // EXIF fields
    let mut date_taken = None;
    let mut camera_make = None;
    let mut camera_model = None;
    let mut lens = None;
    let mut focal_length = None;
    let mut aperture = None;
    let mut shutter_speed = None;
    let mut iso = None;
    let mut gps_lat = None;
    let mut gps_lng = None;

    if let Some(ref exif) = maybe_exif {
        date_taken = exif_string(exif, exif::Tag::DateTimeOriginal);
        camera_make = exif_string(exif, exif::Tag::Make);
        camera_model = exif_string(exif, exif::Tag::Model);
        lens = exif_string(exif, exif::Tag::LensModel);
        focal_length = exif_rational_f64(exif, exif::Tag::FocalLength);
        aperture = exif_rational_f64(exif, exif::Tag::FNumber);
        shutter_speed = exif_string(exif, exif::Tag::ExposureTime);
        iso = exif_u32(exif, exif::Tag::PhotographicSensitivity);
        orientation = exif_u32(exif, exif::Tag::Orientation).unwrap_or(1);

        let (lat, lng) = read_gps(exif);
        gps_lat = lat;
        gps_lng = lng;

        if width == 0 {
            if let Some(w) = exif_u32(exif, exif::Tag::PixelXDimension) {
                width = w;
            }
            if let Some(h) = exif_u32(exif, exif::Tag::PixelYDimension) {
                height = h;
            }
        }
    }

    Ok(Some(ScannedPhoto {
        filename,
        rel_path,
        file_path,
        file_size,
        file_hash,
        file_mtime,
        width,
        height,
        orientation,
        format,
        color_space,
        has_embedded_preview,
        warning,
        date_taken,
        camera_make,
        camera_model,
        lens,
        focal_length,
        aperture,
        shutter_speed,
        iso,
        gps_lat,
        gps_lng,
    }))
}

/// Scan arbitrary paths (folders and/or files) with optional recursive search in folders.
#[tauri::command]
pub async fn scan_paths(paths: Vec<String>, recursive: bool) -> Result<ScanResult, String> {
    let mut photos = Vec::new();
    let mut unsupported_count = 0usize;
    let mut corrupted_count = 0usize;
    let mut warnings = Vec::new();

    for p in paths {
        let path_buf = PathBuf::from(&p);
        if !path_buf.exists() {
            warnings.push(format!("Ruta no encontrada: {}", p));
            continue;
        }

        if path_buf.is_dir() {
            let walker = if recursive {
                WalkDir::new(&path_buf).follow_links(true)
            } else {
                WalkDir::new(&path_buf).max_depth(1).follow_links(true)
            };

            for entry in walker.into_iter().filter_map(|e| e.ok()) {
                let entry_path = entry.path();
                if !entry_path.is_file() {
                    continue;
                }

                match process_candidate_file(entry_path, Some(&path_buf)) {
                    Ok(Some(photo)) => {
                        if let Some(ref w) = photo.warning {
                            warnings.push(format!("{}: {}", photo.filename, w));
                        }
                        photos.push(photo);
                    }
                    Ok(None) => {}
                    Err((is_corrupt, msg)) => {
                        if is_corrupt {
                            corrupted_count += 1;
                            warnings.push(msg);
                        } else {
                            unsupported_count += 1;
                        }
                    }
                }
            }
        } else if path_buf.is_file() {
            match process_candidate_file(&path_buf, None) {
                Ok(Some(photo)) => {
                    if let Some(ref w) = photo.warning {
                        warnings.push(format!("{}: {}", photo.filename, w));
                    }
                    photos.push(photo);
                }
                Ok(None) => {}
                Err((is_corrupt, msg)) => {
                    if is_corrupt {
                        corrupted_count += 1;
                        warnings.push(msg);
                    } else {
                        unsupported_count += 1;
                    }
                }
            }
        }
    }

    let total_found = photos.len();

    Ok(ScanResult {
        photos,
        total_found,
        unsupported_count,
        corrupted_count,
        warnings,
    })
}

/// Scan a folder and return metadata for all image files found (backward compatibility).
#[tauri::command]
pub async fn scan_folder(folder_path: String) -> Result<Vec<ScannedPhoto>, String> {
    let result = scan_paths(vec![folder_path], true).await?;
    Ok(result.photos)
}

/// Import folder: scan + return folder name and photos.
#[tauri::command]
pub async fn import_folder(folder_path: String) -> Result<(String, Vec<ScannedPhoto>), String> {
    let root = PathBuf::from(&folder_path);
    let folder_name = root
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let photos = scan_folder(folder_path).await?;
    Ok((folder_name, photos))
}

#[cfg(target_os = "windows")]
unsafe extern "system" {
    fn GetLogicalDrives() -> u32;
    fn GetDriveTypeW(lpRootPathName: *const u16) -> u32;
    fn GetVolumeInformationW(
        lpRootPathName: *const u16,
        lpVolumeNameBuffer: *mut u16,
        nVolumeNameSize: u32,
        lpVolumeSerialNumber: *mut u32,
        lpMaximumComponentLength: *mut u32,
        lpFileSystemFlags: *mut u32,
        lpFileSystemNameBuffer: *mut u16,
        nFileSystemNameSize: u32,
    ) -> i32;
}

/// Detect removable or external drives (SD cards, USBs)
#[tauri::command]
pub async fn list_removable_drives() -> Result<Vec<RemovableDrive>, String> {
    #[cfg(target_os = "windows")]
    {
        let mut drives = Vec::new();
        unsafe {
            let mask = GetLogicalDrives();
            for i in 0..26 {
                if (mask & (1 << i)) != 0 {
                    let letter = (b'A' + i) as char;
                    let root_str = format!("{}:\\", letter);
                    let wide: Vec<u16> = root_str.encode_utf16().chain(std::iter::once(0)).collect();
                    let dtype = GetDriveTypeW(wide.as_ptr());
                    // 2 = DRIVE_REMOVABLE, 5 = DRIVE_CDROM
                    if dtype == 2 || dtype == 5 {
                        let mut vol_buf = [0u16; 260];
                        let mut fs_buf = [0u16; 260];
                        let res = GetVolumeInformationW(
                            wide.as_ptr(),
                            vol_buf.as_mut_ptr(),
                            vol_buf.len() as u32,
                            std::ptr::null_mut(),
                            std::ptr::null_mut(),
                            std::ptr::null_mut(),
                            fs_buf.as_mut_ptr(),
                            fs_buf.len() as u32,
                        );
                        let label = if res != 0 {
                            let len = vol_buf.iter().position(|&c| c == 0).unwrap_or(0);
                            let s = String::from_utf16_lossy(&vol_buf[..len]);
                            let clean = s.trim();
                            if clean.is_empty() {
                                format!("Tarjeta / Disco ({}:)", letter)
                            } else {
                                format!("{} ({}:)", clean, letter)
                            }
                        } else {
                            format!("Unidad extraíble ({}:)", letter)
                        };
                        drives.push(RemovableDrive {
                            path: root_str,
                            label,
                            drive_type: if dtype == 2 { "removable".to_string() } else { "cdrom".to_string() },
                        });
                    }
                }
            }
        }
        Ok(drives)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

/// Simple Unix timestamp to ISO 8601 string
fn format_unix_timestamp(secs: u64) -> String {
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    let mut y = 1970i64;
    let mut remaining_days = days as i64;

    loop {
        let days_in_year = if is_leap(y) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        y += 1;
    }

    let month_days = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut m = 0;
    for (i, &md) in month_days.iter().enumerate() {
        if remaining_days < md {
            m = i;
            break;
        }
        remaining_days -= md;
    }

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y,
        m + 1,
        remaining_days + 1,
        hours,
        minutes,
        seconds
    )
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}
