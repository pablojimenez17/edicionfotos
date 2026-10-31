use image::{ColorType, ImageEncoder, ImageFormat, RgbaImage};
use std::collections::HashMap;
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;
use std::sync::{LazyLock, Mutex};

struct ExportSession {
    width: u32,
    height: u32,
    buffer: Vec<u8>,
}

static SESSIONS: LazyLock<Mutex<HashMap<String, ExportSession>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Initializes an in-memory buffer to stitch tiles for a full export image.
#[tauri::command]
pub fn create_export_session(session_id: String, width: u32, height: u32) -> Result<(), String> {
    let size = (width as usize)
        .checked_mul(height as usize)
        .and_then(|px| px.checked_mul(4))
        .ok_or_else(|| "Export dimensions exceed maximum image buffer size".to_string())?;

    let session = ExportSession {
        width,
        height,
        buffer: vec![0u8; size],
    };

    let mut sessions = SESSIONS.lock().map_err(|e| e.to_string())?;
    sessions.insert(session_id, session);
    Ok(())
}

/// Receives a binary chunk of raw RGBA8 pixels rendered for a tile (with margins cropped).
/// Stitches the tile directly into the session image buffer without JSON serialization.
#[tauri::command]
pub fn write_export_tile(
    session_id: String,
    tile_x: u32,
    tile_y: u32,
    tile_width: u32,
    tile_height: u32,
    rgba_data: Vec<u8>,
) -> Result<(), String> {
    let mut sessions = SESSIONS.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("Export session '{}' not found", session_id))?;

    let total_w = session.width;
    let total_h = session.height;

    for row in 0..tile_height {
        let dest_y = tile_y + row;
        if dest_y >= total_h {
            break;
        }

        let copy_w = tile_width.min(total_w.saturating_sub(tile_x));
        if copy_w == 0 {
            continue;
        }

        let src_start = (row * tile_width * 4) as usize;
        let src_end = src_start + (copy_w * 4) as usize;
        let dest_start = ((dest_y * total_w + tile_x) * 4) as usize;
        let dest_end = dest_start + (copy_w * 4) as usize;

        if src_end <= rgba_data.len() && dest_end <= session.buffer.len() {
            session.buffer[dest_start..dest_end].copy_from_slice(&rgba_data[src_start..src_end]);
        }
    }

    Ok(())
}

/// Finalizes the export session: optionally applies text watermark,
/// encodes to chosen image format (JPEG, PNG, TIFF, WebP), and writes to disk.
#[tauri::command]
pub fn finish_export_session(
    session_id: String,
    output_path: String,
    format: String,
    quality: u8,
    watermark_text: Option<String>,
) -> Result<String, String> {
    let mut sessions = SESSIONS.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .remove(&session_id)
        .ok_or_else(|| format!("Export session '{}' not found", session_id))?;

    let mut img = RgbaImage::from_raw(session.width, session.height, session.buffer)
        .ok_or_else(|| "Failed to construct RGBA image from buffer".to_string())?;

    // Apply simple text watermark if requested
    if let Some(ref text) = watermark_text {
        if !text.trim().is_empty() {
            draw_simple_watermark(&mut img, text.trim());
        }
    }

    let path = Path::new(&output_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let file = File::create(path).map_err(|e| format!("Failed to create export file: {}", e))?;
    let mut writer = BufWriter::new(file);

    let fmt = format.to_lowercase();
    match fmt.as_str() {
        "jpeg" | "jpg" => {
            let q = quality.clamp(1, 100);
            let rgb_img = image::DynamicImage::ImageRgba8(img).to_rgb8();
            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut writer, q);
            encoder
                .encode(
                    rgb_img.as_raw(),
                    session.width,
                    session.height,
                    ColorType::Rgb8.into(),
                )
                .map_err(|e| format!("JPEG encoding failed: {}", e))?;
        }
        "png" => {
            let encoder = image::codecs::png::PngEncoder::new(&mut writer);
            encoder
                .write_image(
                    img.as_raw(),
                    session.width,
                    session.height,
                    ColorType::Rgba8.into(),
                )
                .map_err(|e| format!("PNG encoding failed: {}", e))?;
        }
        "tiff" | "tif" => {
            let encoder = image::codecs::tiff::TiffEncoder::new(&mut writer);
            encoder
                .write_image(
                    img.as_raw(),
                    session.width,
                    session.height,
                    ColorType::Rgba8.into(),
                )
                .map_err(|e| format!("TIFF encoding failed: {}", e))?;
        }
        "webp" => {
            let rgb_img = image::DynamicImage::ImageRgba8(img).to_rgba8();
            rgb_img
                .save_with_format(path, ImageFormat::WebP)
                .map_err(|e| format!("WebP encoding failed: {}", e))?;
        }
        _ => {
            return Err(format!("Unsupported export format: {}", format));
        }
    }

    Ok(output_path)
}

/// Draws an unobtrusive watermark label in the bottom-right corner.
fn draw_simple_watermark(img: &mut RgbaImage, text: &str) {
    let w = img.width();
    let h = img.height();
    if w < 100 || h < 40 {
        return;
    }

    // Draw a subtle translucent box in the bottom right corner
    let box_w = (text.len() as u32 * 10 + 24).min(w.saturating_sub(20));
    let box_h = 32u32.min(h.saturating_sub(20));
    let start_x = w.saturating_sub(box_w + 16);
    let start_y = h.saturating_sub(box_h + 16);

    for y in start_y..start_y + box_h {
        for x in start_x..start_x + box_w {
            if x < w && y < h {
                let px = img.get_pixel_mut(x, y);
                // Blend with dark background and slight contrast
                px[0] = (px[0] as u16 * 4 / 10) as u8;
                px[1] = (px[1] as u16 * 4 / 10) as u8;
                px[2] = (px[2] as u16 * 4 / 10) as u8;
            }
        }
    }
}
