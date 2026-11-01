use image::imageops::FilterType;
use image::GenericImageView;
use std::path::PathBuf;
use tauri::Manager;

/// Generate a thumbnail for a photo and save it to the cache directory.
/// Returns the path to the generated thumbnail.
#[tauri::command]
pub async fn generate_thumbnail(
    app: tauri::AppHandle,
    source_path: String,
    photo_id: i64,
    size: String,  // "thumb" (256px) or "standard" (2048px)
) -> Result<String, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let (max_dim, subdir) = match size.as_str() {
        "thumb" => (256u32, "thumbs"),
        "standard" => (2048u32, "standard"),
        _ => return Err(format!("Invalid size: {}", size)),
    };

    let cache_dir = app_data.join("previews").join(subdir);
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let output_filename = format!("{}.jpg", photo_id);
    let output_path = cache_dir.join(&output_filename);

    // If thumbnail already exists, return it
    if output_path.exists() {
        return Ok(output_path.to_string_lossy().to_string());
    }

    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("Source file not found: {}", source_path));
    }

    // Open and resize the image
    let img = image::open(&source).map_err(|e| format!("Failed to open image: {}", e))?;

    let (w, h) = img.dimensions();
    let scale = (max_dim as f64) / (w.max(h) as f64);

    let thumb = if scale < 1.0 {
        let new_w = ((w as f64) * scale).round() as u32;
        let new_h = ((h as f64) * scale).round() as u32;
        img.resize(new_w, new_h, FilterType::Lanczos3)
    } else {
        img.clone()
    };

    // Save as JPEG
    thumb
        .save(&output_path)
        .map_err(|e| format!("Failed to save thumbnail: {}", e))?;

    Ok(output_path.to_string_lossy().to_string())
}

/// Get the expected thumbnail path for a photo (without generating it).
#[tauri::command]
pub async fn get_thumbnail_path(
    app: tauri::AppHandle,
    photo_id: i64,
    size: String,
) -> Result<String, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let subdir = match size.as_str() {
        "thumb" => "thumbs",
        "standard" => "standard",
        _ => return Err(format!("Invalid size: {}", size)),
    };

    let output_path = app_data
        .join("previews")
        .join(subdir)
        .join(format!("{}.jpg", photo_id));

    Ok(output_path.to_string_lossy().to_string())
}

use rayon::prelude::*;

/// Fast multi-threaded batch thumbnail generation using Rayon thread pool.
/// Generates thumbnails in parallel across CPU cores without blocking the UI thread.
pub fn batch_generate_thumbnails_parallel(
    tasks: Vec<(PathBuf, PathBuf, u32)>, // (source, destination, max_dim)
) -> Vec<Result<String, String>> {
    tasks.into_par_iter().map(|(src, dst, max_dim)| {
        if dst.exists() {
            return Ok(dst.to_string_lossy().to_string());
        }
        let img = image::open(&src).map_err(|e| e.to_string())?;
        let thumb = img.thumbnail(max_dim, max_dim);
        thumb.save(&dst).map_err(|e| e.to_string())?;
        Ok(dst.to_string_lossy().to_string())
    }).collect()
}

