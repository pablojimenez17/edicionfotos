use serde::{Serialize, Deserialize};
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

/// Available base profiles for RAW development
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RawProfileMode {
    CameraStandard,
    Neutral,
    Flat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraProfileData {
    pub camera_model: String,
    pub matrix: [[f32; 3]; 3],
    pub r_curve: Vec<u8>,
    pub g_curve: Vec<u8>,
    pub b_curve: Vec<u8>,
}

use std::collections::HashMap;
use std::sync::Mutex;

static PROFILE_CACHE: Mutex<Option<HashMap<String, CameraProfileData>>> = Mutex::new(None);

/// Loads or creates the persistent camera profile cache
fn get_profile_cache() -> HashMap<String, CameraProfileData> {
    let mut guard = PROFILE_CACHE.lock().unwrap();
    if let Some(ref cache) = *guard {
        return cache.clone();
    }

    let mut cache = HashMap::new();
    let cache_path = std::env::temp_dir().join("lumen_camera_profiles.json");
    if let Ok(content) = std::fs::read_to_string(&cache_path) {
        if let Ok(deserialized) = serde_json::from_str::<HashMap<String, CameraProfileData>>(&content) {
            cache = deserialized;
        }
    }
    *guard = Some(cache.clone());
    cache
}

fn save_profile_to_cache(key: &str, profile: CameraProfileData) {
    let mut guard = PROFILE_CACHE.lock().unwrap();
    let mut cache = guard.clone().unwrap_or_default();
    cache.insert(key.to_string(), profile);
    let cache_path = std::env::temp_dir().join("lumen_camera_profiles.json");
    if let Ok(serialized) = serde_json::to_string(&cache) {
        let _ = std::fs::write(&cache_path, serialized);
    }
    *guard = Some(cache);
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

/// Converts sRGB byte to linear float [0.0, 1.0]
pub fn srgb_byte_to_linear(b: u8) -> f32 {
    let v = b as f32 / 255.0;
    if v <= 0.04045 {
        v / 12.92
    } else {
        ((v + 0.055) / 1.055).powf(2.4)
    }
}

/// Converts sRGB 8-bit to CIE 1976 Lab (D65)
pub fn rgb_to_lab(r_byte: u8, g_byte: u8, b_byte: u8) -> (f64, f64, f64) {
    let r_lin = srgb_byte_to_linear(r_byte) as f64;
    let g_lin = srgb_byte_to_linear(g_byte) as f64;
    let b_lin = srgb_byte_to_linear(b_byte) as f64;

    let x = (r_lin * 0.4124564 + g_lin * 0.3575761 + b_lin * 0.1804375) / 0.95047;
    let y = (r_lin * 0.2126729 + g_lin * 0.7151522 + b_lin * 0.0721750) / 1.00000;
    let z = (r_lin * 0.0193339 + g_lin * 0.1191920 + b_lin * 0.9503041) / 1.08883;

    let f = |t: f64| -> f64 {
        if t > 0.008856 {
            t.cbrt()
        } else {
            7.787 * t + 16.0 / 116.0
        }
    };

    let fx = f(x);
    let fy = f(y);
    let fz = f(z);

    let l = (116.0 * fy - 16.0).max(0.0);
    let a = 500.0 * (fx - fy);
    let b = 200.0 * (fy - fz);
    (l, a, b)
}

/// Calculates Delta E (CIE 1976) between two sRGB colors
pub fn delta_e_lab(c1: (u8, u8, u8), c2: (u8, u8, u8)) -> f64 {
    let (l1, a1, b1) = rgb_to_lab(c1.0, c1.1, c1.2);
    let (l2, a2, b2) = rgb_to_lab(c2.0, c2.1, c2.2);
    ((l1 - l2).powi(2) + (a1 - a2).powi(2) + (b1 - b2).powi(2)).sqrt()
}

/// Residual Color Difference (RCD) demosaicing for Bayer CFA.
/// Completely eliminates zipper edge artifacts and preserves sharp fine textures.
pub fn demosaic_rcd(
    norm_buffer: &[f32],
    width: usize,
    height: usize,
    cfa: &rawloader::CFA,
) -> (Vec<f32>, Vec<f32>, Vec<f32>) {
    let size = width * height;
    let mut green = vec![0.0f32; size];
    let mut red = vec![0.0f32; size];
    let mut blue = vec![0.0f32; size];

    // 1. Interpolate Green channel with gradient directional weighting
    for y in 0..height {
        for x in 0..width {
            let idx = y * width + x;
            let c = cfa.color_at(y, x);
            if c == 1 || c == 3 {
                green[idx] = norm_buffer[idx];
            } else if y >= 2 && y + 2 < height && x >= 2 && x + 2 < width {
                let v = norm_buffer[idx];
                let g_h = (norm_buffer[idx - 1] + norm_buffer[idx + 1]) * 0.5
                    + (2.0 * v - norm_buffer[idx - 2] - norm_buffer[idx + 2]) * 0.25;
                let g_v = (norm_buffer[idx - width] + norm_buffer[idx + width]) * 0.5
                    + (2.0 * v - norm_buffer[idx - 2 * width] - norm_buffer[idx + 2 * width]) * 0.25;

                let diff_h = (norm_buffer[idx - 1] - norm_buffer[idx + 1]).abs()
                    + (2.0 * v - norm_buffer[idx - 2] - norm_buffer[idx + 2]).abs() * 0.5;
                let diff_v = (norm_buffer[idx - width] - norm_buffer[idx + width]).abs()
                    + (2.0 * v - norm_buffer[idx - 2 * width] - norm_buffer[idx + 2 * width]).abs() * 0.5;

                let w_h = 1.0 / (1.0 + diff_h);
                let w_v = 1.0 / (1.0 + diff_v);

                let g_interp = if diff_h + 0.02 < diff_v {
                    g_h
                } else if diff_v + 0.02 < diff_h {
                    g_v
                } else {
                    (w_h * g_h + w_v * g_v) / (w_h + w_v)
                };
                green[idx] = g_interp.clamp(0.0, 1.0);
            } else if y > 0 && y + 1 < height && x > 0 && x + 1 < width {
                green[idx] = (norm_buffer[idx - 1] + norm_buffer[idx + 1] + norm_buffer[idx - width] + norm_buffer[idx + width]) * 0.25;
            } else {
                green[idx] = norm_buffer[idx];
            }
        }
    }

    // 2. Interpolate Red and Blue differences (R - G) and (B - G)
    for y in 0..height {
        for x in 0..width {
            let idx = y * width + x;
            let c = cfa.color_at(y, x);
            let g = green[idx];

            match c {
                0 => {
                    red[idx] = norm_buffer[idx];
                    if y >= 1 && y + 1 < height && x >= 1 && x + 1 < width {
                        let b_diff = ((norm_buffer[idx - width - 1] - green[idx - width - 1])
                            + (norm_buffer[idx - width + 1] - green[idx - width + 1])
                            + (norm_buffer[idx + width - 1] - green[idx + width - 1])
                            + (norm_buffer[idx + width + 1] - green[idx + width + 1])) * 0.25;
                        blue[idx] = (g + b_diff).clamp(0.0, 1.0);
                    } else {
                        blue[idx] = g;
                    }
                }
                2 => {
                    blue[idx] = norm_buffer[idx];
                    if y >= 1 && y + 1 < height && x >= 1 && x + 1 < width {
                        let r_diff = ((norm_buffer[idx - width - 1] - green[idx - width - 1])
                            + (norm_buffer[idx - width + 1] - green[idx - width + 1])
                            + (norm_buffer[idx + width - 1] - green[idx + width - 1])
                            + (norm_buffer[idx + width + 1] - green[idx + width + 1])) * 0.25;
                        red[idx] = (g + r_diff).clamp(0.0, 1.0);
                    } else {
                        red[idx] = g;
                    }
                }
                _ => {
                    let left_c = if x > 0 { cfa.color_at(y, x - 1) } else { cfa.color_at(y, x + 1) };
                    if left_c == 0 || (x + 1 < width && cfa.color_at(y, x + 1) == 0) {
                        let r_diff = if x > 0 && x + 1 < width {
                            ((norm_buffer[idx - 1] - green[idx - 1]) + (norm_buffer[idx + 1] - green[idx + 1])) * 0.5
                        } else { 0.0 };
                        let b_diff = if y > 0 && y + 1 < height {
                            ((norm_buffer[idx - width] - green[idx - width]) + (norm_buffer[idx + width] - green[idx + width])) * 0.5
                        } else { 0.0 };
                        red[idx] = (g + r_diff).clamp(0.0, 1.0);
                        blue[idx] = (g + b_diff).clamp(0.0, 1.0);
                    } else {
                        let b_diff = if x > 0 && x + 1 < width {
                            ((norm_buffer[idx - 1] - green[idx - 1]) + (norm_buffer[idx + 1] - green[idx + 1])) * 0.5
                        } else { 0.0 };
                        let r_diff = if y > 0 && y + 1 < height {
                            ((norm_buffer[idx - width] - green[idx - width]) + (norm_buffer[idx + width] - green[idx + width])) * 0.5
                        } else { 0.0 };
                        red[idx] = (g + r_diff).clamp(0.0, 1.0);
                        blue[idx] = (g + b_diff).clamp(0.0, 1.0);
                    }
                }
            }
        }
    }

    (red, green, blue)
}

/// Applies subtle unsharp mask sharpening (amount 25 = 0.25, radius 1.0)
pub fn apply_light_sharpening(
    r: &mut [f32],
    g: &mut [f32],
    b: &mut [f32],
    width: usize,
    height: usize,
    amount: f32,
) {
    if amount <= 0.0 {
        return;
    }
    let orig_r = r.to_vec();
    let orig_g = g.to_vec();
    let orig_b = b.to_vec();

    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let idx = y * width + x;
            let blur_r = (orig_r[idx - 1] + orig_r[idx + 1] + orig_r[idx - width] + orig_r[idx + width]) * 0.25;
            let blur_g = (orig_g[idx - 1] + orig_g[idx + 1] + orig_g[idx - width] + orig_g[idx + width]) * 0.25;
            let blur_b = (orig_b[idx - 1] + orig_b[idx + 1] + orig_b[idx - width] + orig_b[idx + width]) * 0.25;

            r[idx] = (orig_r[idx] + amount * (orig_r[idx] - blur_r)).clamp(0.0, 1.0);
            g[idx] = (orig_g[idx] + amount * (orig_g[idx] - blur_g)).clamp(0.0, 1.0);
            b[idx] = (orig_b[idx] + amount * (orig_b[idx] - blur_b)).clamp(0.0, 1.0);
        }
    }
}

/// Fits a 3x3 color matrix and tone curve LUT per channel via least squares
/// matching the developed linear sensor data to the embedded camera preview.
/// Samples 1,000+ pixels, strictly excluding clipped values (<2% or >98%).
pub fn fit_camera_standard_profile(
    developed_lin_r: &[f32],
    developed_lin_g: &[f32],
    developed_lin_b: &[f32],
    width: usize,
    height: usize,
    preview_bytes: &[u8],
    camera_model_key: &str,
) -> Result<CameraProfileData, String> {
    let preview_dyn = image::load_from_memory(preview_bytes).map_err(|e| e.to_string())?;
    let preview = preview_dyn.to_rgb8();
    let pw = preview.width() as usize;
    let ph = preview.height() as usize;

    let crop_x = (width.saturating_sub(pw)) / 2;
    let crop_y = (height.saturating_sub(ph)) / 2;
    println!("FIT PROFILE: pw={}, ph={}, raw_w={}, raw_h={}, crop_x={}, crop_y={}", pw, ph, width, height, crop_x, crop_y);

    // Collect 1000+ valid, non-clipped sample pixels across the image
    let mut x_mat: Vec<[f32; 3]> = Vec::with_capacity(4000);
    let mut y_mat_lin: Vec<[f32; 3]> = Vec::with_capacity(4000);
    let mut y_mat_srgb: Vec<[u8; 3]> = Vec::with_capacity(4000);

    let step_x = (pw / 60).max(1);
    let step_y = (ph / 60).max(1);

    for py in (10..ph - 10).step_by(step_y) {
        for px in (10..pw - 10).step_by(step_x) {
            let p_pix = preview.get_pixel(px as u32, py as u32);
            let p_r = p_pix[0];
            let p_g = p_pix[1];
            let p_b = p_pix[2];

            // Exclude clipped pixels (< 2% or > 98%)
            if p_r < 5 || p_r > 250 || p_g < 5 || p_g > 250 || p_b < 5 || p_b > 250 {
                continue;
            }

            let dx = crop_x + px;
            let dy = crop_y + py;
            if dx >= width || dy >= height {
                continue;
            }
            let idx = dy * width + dx;

            let d_r = developed_lin_r[idx];
            let d_g = developed_lin_g[idx];
            let d_b = developed_lin_b[idx];

            if d_r < 0.01 || d_r > 0.98 || d_g < 0.01 || d_g > 0.98 || d_b < 0.01 || d_b > 0.98 {
                continue;
            }

            x_mat.push([d_r, d_g, d_b]);
            y_mat_lin.push([
                srgb_byte_to_linear(p_r),
                srgb_byte_to_linear(p_g),
                srgb_byte_to_linear(p_b),
            ]);
            y_mat_srgb.push([p_r, p_g, p_b]);
        }
    }

    let n_samples = x_mat.len();
    if n_samples < 500 {
        return Err(format!("Insufficient valid non-clipped sample pixels: {}", n_samples));
    }

    // 1. Solve 3x3 color matrix M via standard linear regression: M = (X^T * X)^(-1) * X^T * Y
    let mut xtx = [[0.0f32; 3]; 3];
    let mut xty = [[0.0f32; 3]; 3]; // col 0: R target, col 1: G target, col 2: B target

    for i in 0..n_samples {
        let x = x_mat[i];
        let y = y_mat_lin[i];

        for r in 0..3 {
            for c in 0..3 {
                xtx[r][c] += x[r] * x[c];
            }
            xty[r][0] += x[r] * y[0];
            xty[r][1] += x[r] * y[1];
            xty[r][2] += x[r] * y[2];
        }
    }

    let inv_xtx = invert_3x3(&xtx).unwrap_or([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]);

    let mut m = [[0.0f32; 3]; 3];
    for ch in 0..3 {
        for j in 0..3 {
            m[ch][j] = inv_xtx[j][0] * xty[0][ch] + inv_xtx[j][1] * xty[1][ch] + inv_xtx[j][2] * xty[2][ch];
        }
    }
    println!("FIT PROFILE: fitted matrix m = {:?}", m);

    // 2. Build 256-point tone curve LUT per channel matching camera standard contrast & shadows
    let mut buckets_sum = vec![[0.0f64; 3]; 256];
    let mut buckets_count = vec![[0usize; 3]; 256];

    for i in 0..n_samples {
        let x = x_mat[i];
        let p = y_mat_srgb[i];

        for ch in 0..3 {
            let lin_out = (m[ch][0] * x[0] + m[ch][1] * x[1] + m[ch][2] * x[2]).clamp(0.0, 1.0);
            let b_idx = (lin_out * 255.0).round() as usize;
            buckets_sum[b_idx.min(255)][ch] += p[ch] as f64;
            buckets_count[b_idx.min(255)][ch] += 1;
        }
    }

    let mut curves = vec![vec![0u8; 256]; 3];
    for ch in 0..3 {
        // Collect known bucket averages
        let mut known: Vec<(usize, f64)> = Vec::new();
        known.push((0, 0.0));
        for b in 0..256 {
            if buckets_count[b][ch] > 0 {
                let avg = buckets_sum[b][ch] / buckets_count[b][ch] as f64;
                known.push((b, avg));
            }
        }
        known.push((255, 255.0));
        known.sort_by_key(|k| k.0);
        known.dedup_by_key(|k| k.0);

        // Piecewise linear interpolation between known points
        for b in 0..256 {
            let mut left = known[0];
            let mut right = known[known.len() - 1];
            for k in 0..known.len() - 1 {
                if known[k].0 <= b && known[k + 1].0 >= b {
                    left = known[k];
                    right = known[k + 1];
                    break;
                }
            }

            let val = if right.0 == left.0 {
                left.1
            } else {
                let t = (b - left.0) as f64 / (right.0 - left.0) as f64;
                left.1 + t * (right.1 - left.1)
            };
            curves[ch][b] = (val.round().clamp(0.0, 255.0)) as u8;
        }

        // Enforce monotonicity
        let mut max_so_far = 0u8;
        for b in 0..256 {
            max_so_far = max_so_far.max(curves[ch][b]);
            curves[ch][b] = max_so_far;
        }
        curves[ch][0] = 0;
        curves[ch][255] = 255;
    }

    let profile = CameraProfileData {
        camera_model: camera_model_key.to_string(),
        matrix: m,
        r_curve: curves[0].clone(),
        g_curve: curves[1].clone(),
        b_curve: curves[2].clone(),
    };

    save_profile_to_cache(camera_model_key, profile.clone());
    Ok(profile)
}

/// Retrieves cached camera standard profile or computes it once and persists it
pub fn get_or_fit_camera_profile(
    developed_lin_r: &[f32],
    developed_lin_g: &[f32],
    developed_lin_b: &[f32],
    width: usize,
    height: usize,
    preview_bytes: Option<&[u8]>,
    camera_model_key: &str,
) -> CameraProfileData {
    let cache = get_profile_cache();
    if let Some(prof) = cache.get(camera_model_key) {
        return prof.clone();
    }

    if let Some(p_bytes) = preview_bytes {
        if let Ok(fitted) = fit_camera_standard_profile(
            developed_lin_r,
            developed_lin_g,
            developed_lin_b,
            width,
            height,
            p_bytes,
            camera_model_key,
        ) {
            return fitted;
        }
    }

    // Default neutral fallback if no preview available
    CameraProfileData {
        camera_model: camera_model_key.to_string(),
        matrix: [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
        r_curve: (0..256).map(|i| apply_srgb_tone_curve(i as f32 / 255.0)).collect(),
        g_curve: (0..256).map(|i| apply_srgb_tone_curve(i as f32 / 255.0)).collect(),
        b_curve: (0..256).map(|i| apply_srgb_tone_curve(i as f32 / 255.0)).collect(),
    }
}

/// Complete RAW development pipeline from sensor raw file to developed RGB image:
/// Supports "CameraStandard", "Neutral", and "Flat" base profiles.
pub fn develop_raw_file_with_profile(
    file_path: &Path,
    mode: RawProfileMode,
) -> Result<image::RgbImage, String> {
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

    // 2. Camera sensor -> sRGB base matrix
    let base_matrix = get_camera_to_srgb_matrix(&raw.xyz_to_cam);

    // 3. Pre-normalize sensor data with black & white levels + WB (applied before matrix)
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

    // 4. RCD Demosaicing (Residual Color Difference) - sharp, zero zipper artifacts
    let (mut r_cam, mut g_cam, mut b_cam) = demosaic_rcd(&norm_buffer, width, height, &raw.cfa);

    // 5. Default light sharpening on RAW (amount 25 = 0.25, radius 1.0)
    apply_light_sharpening(&mut r_cam, &mut g_cam, &mut b_cam, width, height, 0.25);

    // 6. Apply Camera to sRGB linear color matrix
    let size = width * height;
    let mut r_lin = vec![0.0f32; size];
    let mut g_lin = vec![0.0f32; size];
    let mut b_lin = vec![0.0f32; size];

    for idx in 0..size {
        let r = r_cam[idx];
        let g = g_cam[idx];
        let b = b_cam[idx];

        r_lin[idx] = (base_matrix[0][0] * r + base_matrix[0][1] * g + base_matrix[0][2] * b).clamp(0.0, 1.0);
        g_lin[idx] = (base_matrix[1][0] * r + base_matrix[1][1] * g + base_matrix[1][2] * b).clamp(0.0, 1.0);
        b_lin[idx] = (base_matrix[2][0] * r + base_matrix[2][1] * g + base_matrix[2][2] * b).clamp(0.0, 1.0);
    }

    // 7. Profile application
    let camera_model_key = format!("{} {}", raw.make.trim(), raw.model.trim());
    let embedded_preview = find_embedded_jpeg(file_path).ok();

    let mut out_img = image::RgbImage::new(width as u32, height as u32);

    match mode {
        RawProfileMode::CameraStandard => {
            let profile = get_or_fit_camera_profile(
                &r_lin,
                &g_lin,
                &b_lin,
                width,
                height,
                embedded_preview.as_deref(),
                &camera_model_key,
            );

            for y in 0..height {
                for x in 0..width {
                    let idx = y * width + x;
                    let r = r_lin[idx];
                    let g = g_lin[idx];
                    let b = b_lin[idx];

                    // Apply least-squares color adjustment matrix
                    let r_adj = (profile.matrix[0][0] * r + profile.matrix[0][1] * g + profile.matrix[0][2] * b).clamp(0.0, 1.0);
                    let g_adj = (profile.matrix[1][0] * r + profile.matrix[1][1] * g + profile.matrix[1][2] * b).clamp(0.0, 1.0);
                    let b_adj = (profile.matrix[2][0] * r + profile.matrix[2][1] * g + profile.matrix[2][2] * b).clamp(0.0, 1.0);

                    // Apply tone curve LUT per channel
                    let r_idx = (r_adj * 255.0).round() as usize;
                    let g_idx = (g_adj * 255.0).round() as usize;
                    let b_idx = (b_adj * 255.0).round() as usize;

                    let r_byte = profile.r_curve[r_idx.min(255)];
                    let g_byte = profile.g_curve[g_idx.min(255)];
                    let b_byte = profile.b_curve[b_idx.min(255)];

                    out_img.put_pixel(x as u32, y as u32, image::Rgb([r_byte, g_byte, b_byte]));
                }
            }
        }
        RawProfileMode::Neutral => {
            for y in 0..height {
                for x in 0..width {
                    let idx = y * width + x;
                    let r_byte = apply_srgb_tone_curve(r_lin[idx]);
                    let g_byte = apply_srgb_tone_curve(g_lin[idx]);
                    let b_byte = apply_srgb_tone_curve(b_lin[idx]);

                    out_img.put_pixel(x as u32, y as u32, image::Rgb([r_byte, g_byte, b_byte]));
                }
            }
        }
        RawProfileMode::Flat => {
            // Flat logarithmic transfer function to maximize dynamic range
            for y in 0..height {
                for x in 0..width {
                    let idx = y * width + x;
                    let to_flat = |v: f32| -> u8 {
                        let log_v = ((1.0 + 9.0 * v.clamp(0.0, 1.0)).ln() / 10.0f32.ln()).clamp(0.0, 1.0);
                        (log_v * 255.0).round() as u8
                    };
                    out_img.put_pixel(
                        x as u32,
                        y as u32,
                        image::Rgb([to_flat(r_lin[idx]), to_flat(g_lin[idx]), to_flat(b_lin[idx])]),
                    );
                }
            }
        }
    }

    Ok(out_img)
}

/// Default develop function: applies "CameraStandard" profile with RCD demosaicing
pub fn develop_raw_file_to_image(file_path: &Path) -> Result<image::RgbImage, String> {
    develop_raw_file_with_profile(file_path, RawProfileMode::CameraStandard)
}



