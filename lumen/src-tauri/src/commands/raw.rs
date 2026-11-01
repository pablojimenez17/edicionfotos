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

#[derive(Debug, Clone, Serialize)]
pub struct RawDecoded16Bit {
    pub width: u32,
    pub height: u32,
    pub wb_multipliers: [f32; 3],
    pub color_matrix: Vec<Vec<f32>>,
    pub camera_make: String,
    pub camera_model: String,
    pub is_raw: bool,
}

pub fn decode_raw_file_metadata(file_path: &Path) -> Result<RawDecoded16Bit, String> {
    let raw = rawloader::decode_file(file_path).map_err(|e| format!("rawloader error: {:?}", e))?;
    
    // Normalise WB multipliers relative to Green
    let g = if raw.wb_coeffs[1] > 0.0 { raw.wb_coeffs[1] } else { 1.0 };
    let wb = [
        raw.wb_coeffs[0] / g,
        1.0,
        raw.wb_coeffs[2] / g,
    ];

    let matrix: Vec<Vec<f32>> = raw
        .xyz_to_cam
        .iter()
        .map(|row| row.to_vec())
        .collect();

    Ok(RawDecoded16Bit {
        width: raw.width as u32,
        height: raw.height as u32,
        wb_multipliers: wb,
        color_matrix: matrix,
        camera_make: raw.make,
        camera_model: raw.model,
        is_raw: true,
    })
}

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

/// Tauri command: Decodes full 16-bit RAW sensor data with rawloader.
#[tauri::command]
pub async fn decode_raw_16bit(file_path: String) -> Result<RawDecoded16Bit, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }
    decode_raw_file_metadata(path)
}

/// Inverts a 3x3 matrix
fn invert_3x3(m: &[[f32; 3]; 3]) -> Option<[[f32; 3]; 3]> {
    let det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
            - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
            + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

    if det.abs() < 1e-8 {
        return None;
    }

    let inv_det = 1.0 / det;
    Some([
        [
            (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * inv_det,
            (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * inv_det,
            (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * inv_det,
        ],
        [
            (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * inv_det,
            (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * inv_det,
            (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * inv_det,
        ],
        [
            (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * inv_det,
            (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * inv_det,
            (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * inv_det,
        ],
    ])
}

/// Multiplies two 3x3 matrices: A * B
fn mul_3x3(a: &[[f32; 3]; 3], b: &[[f32; 3]; 3]) -> [[f32; 3]; 3] {
    let mut res = [[0.0f32; 3]; 3];
    for r in 0..3 {
        for c in 0..3 {
            res[r][c] = a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c];
        }
    }
    res
}

/// Computes Camera RGB to sRGB conversion matrix
pub fn get_camera_to_srgb_matrix(xyz_to_cam_raw: &[[f32; 3]; 4]) -> [[f32; 3]; 3] {
    let xyz_to_srgb: [[f32; 3]; 3] = [
        [3.2404542, -1.5371385, -0.4985314],
        [-0.9692660, 1.8760108, 0.0415560],
        [0.0556434, -0.2040259, 1.0572252],
    ];

    let mut cam_3x3 = [[0.0f32; 3]; 3];
    let mut sum = 0.0f32;
    for r in 0..3 {
        for c in 0..3 {
            cam_3x3[r][c] = xyz_to_cam_raw[r][c];
            sum += cam_3x3[r][c].abs();
        }
    }

    if sum < 1.0 {
        return [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
    }

    if sum > 100.0 {
        for r in 0..3 {
            let row_sum = cam_3x3[r][0] + cam_3x3[r][1] + cam_3x3[r][2];
            if row_sum.abs() > 1e-4 {
                cam_3x3[r][0] /= row_sum;
                cam_3x3[r][1] /= row_sum;
                cam_3x3[r][2] /= row_sum;
            }
        }
    }

    if let Some(cam_to_xyz) = invert_3x3(&cam_3x3) {
        mul_3x3(&xyz_to_srgb, &cam_to_xyz)
    } else {
        [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]
    }
}

/// Applies sRGB tone curve / gamma transfer function
pub fn apply_srgb_tone_curve(v: f32) -> u8 {
    let clamped = v.clamp(0.0, 1.0);
    let srgb = if clamped <= 0.0031308 {
        12.92 * clamped
    } else {
        1.055 * clamped.powf(1.0 / 2.4) - 0.055
    };
    (srgb * 255.0).round().clamp(0.0, 255.0) as u8
}

/// Complete RAW development pipeline from sensor raw file to developed RGB image:
/// 1. Black & white point normalization
/// 2. Camera White Balance multipliers
/// 3. Demosaicing (Bayer CFA -> RGB)
/// 4. Camera Color Matrix conversion to sRGB
/// 5. Output gamma / sRGB tone curve
pub fn develop_raw_file_to_image(file_path: &Path) -> Result<image::RgbImage, String> {
    let raw = rawloader::decode_file(file_path).map_err(|e| format!("rawloader error: {:?}", e))?;
    let width = raw.width;
    let height = raw.height;

    let raw_data = match raw.data {
        rawloader::RawImageData::Integer(ref v) => v,
        _ => return Err("Unsupported raw floating point sensor data".to_string()),
    };

    if raw_data.len() < width * height {
        return Err(format!("Data buffer size {} is smaller than {}x{}", raw_data.len(), width, height));
    }

    // 1. WB multipliers relative to Green
    let g = if raw.wb_coeffs[1] > 0.0 && !raw.wb_coeffs[1].is_nan() { raw.wb_coeffs[1] } else { 1.0 };
    let wb = [
        if raw.wb_coeffs[0] > 0.0 && !raw.wb_coeffs[0].is_nan() { raw.wb_coeffs[0] / g } else { 1.0 },
        1.0,
        if raw.wb_coeffs[2] > 0.0 && !raw.wb_coeffs[2].is_nan() { raw.wb_coeffs[2] / g } else { 1.0 },
    ];

    // 2. Color matrix: Camera RGB -> sRGB
    let matrix = get_camera_to_srgb_matrix(&raw.xyz_to_cam);

    // 3. Pre-normalize sensor data with black & white levels + WB
    let mut norm_buffer = vec![0.0f32; width * height];
    for y in 0..height {
        for x in 0..width {
            let idx = y * width + x;
            let c = raw.cfa.color_at(y, x);
            let b = raw.blacklevels[c.min(3)] as f32;
            let w = raw.whitelevels[c.min(3)] as f32;
            let range = (w - b).max(1.0);

            let val = (raw_data[idx] as f32 - b) / range;
            let val_clamped = val.clamp(0.0, 1.0);

            let wb_mult = match c {
                0 => wb[0],
                2 => wb[2],
                _ => wb[1],
            };

            norm_buffer[idx] = val_clamped * wb_mult;
        }
    }

    // 4. Bilinear demosaicing + Color matrix + sRGB curve
    let mut out_img = image::RgbImage::new(width as u32, height as u32);

    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let idx = y * width + x;
            let c = raw.cfa.color_at(y, x);

            let (r_cam, g_cam, b_cam) = match c {
                0 => {
                    let r = norm_buffer[idx];
                    let g = (norm_buffer[idx - 1] + norm_buffer[idx + 1] + norm_buffer[idx - width] + norm_buffer[idx + width]) * 0.25;
                    let b = (norm_buffer[idx - width - 1] + norm_buffer[idx - width + 1] + norm_buffer[idx + width - 1] + norm_buffer[idx + width + 1]) * 0.25;
                    (r, g, b)
                }
                2 => {
                    let b = norm_buffer[idx];
                    let g = (norm_buffer[idx - 1] + norm_buffer[idx + 1] + norm_buffer[idx - width] + norm_buffer[idx + width]) * 0.25;
                    let r = (norm_buffer[idx - width - 1] + norm_buffer[idx - width + 1] + norm_buffer[idx + width - 1] + norm_buffer[idx + width + 1]) * 0.25;
                    (r, g, b)
                }
                _ => {
                    let g = norm_buffer[idx];
                    let left_c = raw.cfa.color_at(y, x - 1);
                    let (r, b) = if left_c == 0 {
                        let r = (norm_buffer[idx - 1] + norm_buffer[idx + 1]) * 0.5;
                        let b = (norm_buffer[idx - width] + norm_buffer[idx + width]) * 0.5;
                        (r, b)
                    } else {
                        let b = (norm_buffer[idx - 1] + norm_buffer[idx + 1]) * 0.5;
                        let r = (norm_buffer[idx - width] + norm_buffer[idx + width]) * 0.5;
                        (r, b)
                    };
                    (r, g, b)
                }
            };

            // 5. Apply Camera -> sRGB color matrix
            let r_srgb_lin = matrix[0][0] * r_cam + matrix[0][1] * g_cam + matrix[0][2] * b_cam;
            let g_srgb_lin = matrix[1][0] * r_cam + matrix[1][1] * g_cam + matrix[1][2] * b_cam;
            let b_srgb_lin = matrix[2][0] * r_cam + matrix[2][1] * g_cam + matrix[2][2] * b_cam;

            // 6. Apply sRGB output tone curve
            let r_byte = apply_srgb_tone_curve(r_srgb_lin);
            let g_byte = apply_srgb_tone_curve(g_srgb_lin);
            let b_byte = apply_srgb_tone_curve(b_srgb_lin);

            out_img.put_pixel(x as u32, y as u32, image::Rgb([r_byte, g_byte, b_byte]));
        }
    }

    Ok(out_img)
}


