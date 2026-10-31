use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Metadata extracted from a scanned image file.
#[derive(Debug, Clone, Serialize)]
pub struct ScannedPhoto {
    pub filename: String,
    pub rel_path: String,       // relative to root folder
    pub file_size: u64,
    pub file_hash: String,      // partial: SHA-256(size + first 1MB + last 1MB)
    pub file_mtime: String,     // ISO 8601
    pub width: u32,
    pub height: u32,
    pub orientation: u32,
    pub format: String,
    pub color_space: String,
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

/// Supported image extensions
const IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "tiff", "tif", "webp", "bmp", "gif",
    "cr2", "cr3", "nef", "arw", "orf", "rw2", "raf", "dng", "pef",
    "srw", "x3f", "3fr", "rwl", "mrw",
];

/// Compute partial file hash: SHA-256 of (file_size as bytes + first 1MB + last 1MB)
fn partial_hash(path: &Path) -> Result<String, String> {
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

/// Scan a folder and return metadata for all image files found.
#[tauri::command]
pub async fn scan_folder(folder_path: String) -> Result<Vec<ScannedPhoto>, String> {
    let root = PathBuf::from(&folder_path);
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", folder_path));
    }

    let mut photos = Vec::new();

    for entry in WalkDir::new(&root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        if !IMAGE_EXTENSIONS.contains(&ext.as_str()) {
            continue;
        }

        // Get file metadata
        let meta = match fs::metadata(path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let file_size = meta.len();
        let file_mtime = meta
            .modified()
            .ok()
            .map(|t| {
                let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                let secs = duration.as_secs();
                // Simple ISO 8601 formatting
                format_unix_timestamp(secs)
            })
            .unwrap_or_default();

        let rel_path = path
            .strip_prefix(&root)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string()
            .replace('\\', "/");

        let filename = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let file_hash = partial_hash(path).unwrap_or_default();

        // Read dimensions (for non-RAW files)
        let (mut width, mut height) = (0u32, 0u32);
        let mut orientation = 1u32;
        let format = ext.clone();
        let color_space = "srgb".to_string();

        // Try reading image dimensions
        if let Ok(dim) = image::image_dimensions(path) {
            width = dim.0;
            height = dim.1;
        }

        // Read EXIF
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

        if let Some(exif) = read_exif(path) {
            date_taken = exif_string(&exif, exif::Tag::DateTimeOriginal);
            camera_make = exif_string(&exif, exif::Tag::Make);
            camera_model = exif_string(&exif, exif::Tag::Model);
            lens = exif_string(&exif, exif::Tag::LensModel);
            focal_length = exif_rational_f64(&exif, exif::Tag::FocalLength);
            aperture = exif_rational_f64(&exif, exif::Tag::FNumber);
            shutter_speed = exif_string(&exif, exif::Tag::ExposureTime);
            iso = exif_u32(&exif, exif::Tag::PhotographicSensitivity);
            orientation = exif_u32(&exif, exif::Tag::Orientation).unwrap_or(1);

            let (lat, lng) = read_gps(&exif);
            gps_lat = lat;
            gps_lng = lng;

            // Use EXIF dimensions if available and we didn't get them from image crate
            if width == 0 {
                if let Some(w) = exif_u32(&exif, exif::Tag::PixelXDimension) {
                    width = w;
                }
                if let Some(h) = exif_u32(&exif, exif::Tag::PixelYDimension) {
                    height = h;
                }
            }
        }

        photos.push(ScannedPhoto {
            filename,
            rel_path,
            file_size,
            file_hash,
            file_mtime,
            width,
            height,
            orientation,
            format,
            color_space,
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
        });
    }

    Ok(photos)
}

/// Simple Unix timestamp to ISO 8601 string
fn format_unix_timestamp(secs: u64) -> String {
    // Basic conversion without external crate
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    // Days since epoch to year/month/day (simplified)
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

/// Import folder: scan + return the folder metadata for the frontend to insert into SQLite.
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
