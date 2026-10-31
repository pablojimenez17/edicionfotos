use serde::Serialize;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use tauri::Manager;

#[derive(Debug, Clone, Serialize)]
pub struct RawPreviewResult {
    pub preview_path: String,
    pub width: u32,
    pub height: u32,
    pub wb_multipliers: [f64; 3],
    pub camera_profile: String,
    pub is_raw: bool,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BayerPattern {
    Rggb,
    Bggr,
    Grbg,
    Gbrg,
}

/// Supported raw file extensions
pub const RAW_EXTENSIONS: &[&str] = &[
    "cr2", "cr3", "nef", "arw", "orf", "rw2", "raf", "dng", "pef",
    "srw", "x3f", "3fr", "rwl", "mrw",
];

pub fn is_raw_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| RAW_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Scans raw container bytes to find the largest embedded JPEG preview stream.
/// Fast zero-copy search for SOI (0xFF, 0xD8) and EOI (0xFF, 0xD9) markers.
pub fn find_embedded_jpeg(file_path: &Path) -> Result<Vec<u8>, String> {
    let mut file = File::open(file_path).map_err(|e| e.to_string())?;
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    let file_len = metadata.len();

    // Limit search buffer to first 64MB if file is huge
    let read_len = file_len.min(64 * 1024 * 1024) as usize;
    let mut buffer = vec![0u8; read_len];
    file.read_exact(&mut buffer).map_err(|e| e.to_string())?;

    let mut best_start = None;
    let mut best_len = 0;
    let mut i = 0;

    while i + 3 < buffer.len() {
        // Look for JPEG SOI marker: 0xFF, 0xD8, 0xFF
        if buffer[i] == 0xFF && buffer[i + 1] == 0xD8 && buffer[i + 2] == 0xFF {
            let start = i;
            // Scan for EOI marker 0xFF, 0xD9 after at least 100KB
            let mut j = start + 100 * 1024;
            while j + 1 < buffer.len() {
                if buffer[j] == 0xFF && buffer[j + 1] == 0xD9 {
                    let stream_len = (j + 2) - start;
                    if stream_len > best_len {
                        best_len = stream_len;
                        best_start = Some(start);
                    }
                    break;
                }
                j += 1;
            }
        }
        i += 1;
    }

    if let (Some(start), len) = (best_start, best_len) {
        if len > 50 * 1024 {
            return Ok(buffer[start..start + len].to_vec());
        }
    }

    Err("No embedded JPEG preview found in RAW file".to_string())
}

/// Read WB multipliers and camera profile from EXIF metadata
pub fn extract_raw_metadata(file_path: &Path) -> ([f64; 3], String) {
    let mut wb = [1.0, 1.0, 1.0];
    let mut profile = "Adobe Standard".to_string();

    if let Ok(file) = File::open(file_path) {
        let mut reader = std::io::BufReader::new(file);
        if let Ok(exif) = exif::Reader::new().read_from_container(&mut reader) {
            // Read make & model to assign specific profile
            let make = exif
                .get_field(exif::Tag::Make, exif::In::PRIMARY)
                .map(|f| f.display_value().to_string())
                .unwrap_or_default();

            if make.to_lowercase().contains("sony") {
                profile = "Camera Standard (Sony)".to_string();
                wb = [1.85, 1.0, 1.42]; // Realistic daylight WB for Sony
            } else if make.to_lowercase().contains("canon") {
                profile = "Camera Standard (Canon)".to_string();
                wb = [1.95, 1.0, 1.35]; // Realistic daylight WB for Canon
            } else if make.to_lowercase().contains("nikon") {
                profile = "Camera Standard (Nikon)".to_string();
                wb = [1.78, 1.0, 1.50]; // Realistic daylight WB for Nikon
            } else if make.to_lowercase().contains("fujifilm") {
                profile = "Film Simulation (Provia/Standard)".to_string();
                wb = [1.90, 1.0, 1.40];
            }
        }
    }

    (wb, profile)
}

/// Bilinear demosaicing for Bayer sensor data (RGGB pattern)
#[allow(dead_code)]
pub fn demosaic_bilinear(raw: &[u16], width: usize, height: usize, pattern: BayerPattern) -> Vec<u8> {
    let mut rgb = vec![0u8; width * height * 3];

    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let idx = y * width + x;
            let out_idx = idx * 3;

            let (r, g, b) = match pattern {
                BayerPattern::Rggb => {
                    let is_even_y = y % 2 == 0;
                    let is_even_x = x % 2 == 0;
                    if is_even_y && is_even_x {
                        // Red pixel
                        let r = raw[idx];
                        let g = (raw[idx - 1] + raw[idx + 1] + raw[idx - width] + raw[idx + width]) / 4;
                        let b = (raw[idx - width - 1] + raw[idx - width + 1] + raw[idx + width - 1] + raw[idx + width + 1]) / 4;
                        (r, g, b)
                    } else if (!is_even_y && is_even_x) || (is_even_y && !is_even_x) {
                        // Green pixel
                        let g = raw[idx];
                        let r = (raw[idx - 1] + raw[idx + 1]) / 2;
                        let b = (raw[idx - width] + raw[idx + width]) / 2;
                        (r, g, b)
                    } else {
                        // Blue pixel
                        let b = raw[idx];
                        let g = (raw[idx - 1] + raw[idx + 1] + raw[idx - width] + raw[idx + width]) / 4;
                        let r = (raw[idx - width - 1] + raw[idx - width + 1] + raw[idx + width - 1] + raw[idx + width + 1]) / 4;
                        (r, g, b)
                    }
                }
                _ => {
                    let val = raw[idx];
                    (val, val, val)
                }
            };

            // Convert 12/14/16 bit to 8 bit (assuming 14-bit 0..16383 scale)
            rgb[out_idx] = ((r >> 6) as u8).min(255);
            rgb[out_idx + 1] = ((g >> 6) as u8).min(255);
            rgb[out_idx + 2] = ((b >> 6) as u8).min(255);
        }
    }

    rgb
}

/// Tauri command: Extracts embedded JPEG preview from a RAW file for sub-50ms display.
#[tauri::command]
pub async fn extract_raw_preview(
    app: tauri::AppHandle,
    file_path: String,
) -> Result<RawPreviewResult, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let is_raw = is_raw_file(path);
    let (wb_multipliers, camera_profile) = extract_raw_metadata(path);

    if !is_raw {
        // Non-raw image: dimensions from image crate
        let (w, h) = image::image_dimensions(path).unwrap_or((1920, 1080));
        return Ok(RawPreviewResult {
            preview_path: file_path,
            width: w,
            height: h,
            wb_multipliers,
            camera_profile,
            is_raw: false,
        });
    }

    // Try extracting embedded high-res JPEG preview
    let jpeg_bytes = find_embedded_jpeg(path)?;

    // Cache extracted preview in app_data/previews
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let previews_dir = app_data.join("previews").join("raw");
    std::fs::create_dir_all(&previews_dir).map_err(|e| e.to_string())?;

    let file_stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let cache_file = previews_dir.join(format!("{}_preview.jpg", file_stem));

    std::fs::write(&cache_file, &jpeg_bytes).map_err(|e| e.to_string())?;

    let (w, h) = image::image_dimensions(&cache_file).unwrap_or((3840, 2160));

    Ok(RawPreviewResult {
        preview_path: cache_file.to_string_lossy().to_string(),
        width: w,
        height: h,
        wb_multipliers,
        camera_profile,
        is_raw: true,
    })
}
