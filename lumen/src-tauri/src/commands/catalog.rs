use serde::Serialize;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize)]
pub struct AppPaths {
    pub app_data: String,
    pub previews: String,
    pub thumbs: String,
    pub standard: String,
}

/// Run the initial migration SQL against the catalog database.
/// Called from the frontend on first load.
#[tauri::command]
pub async fn run_migration(app: tauri::AppHandle) -> Result<String, String> {
    let _app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let migration_path = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?
        .join("migrations")
        .join("001_initial.sql");

    // In dev mode, the migration file is in src-tauri/migrations
    let migration_sql = if migration_path.exists() {
        std::fs::read_to_string(&migration_path)
            .map_err(|e| format!("Failed to read migration: {}", e))?
    } else {
        // Fallback: read from the source directory during development
        let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("migrations")
            .join("001_initial.sql");
        std::fs::read_to_string(&dev_path)
            .map_err(|e| format!("Failed to read migration (dev): {}", e))?
    };

    Ok(migration_sql)
}

/// Get the app data directory paths for the frontend to use.
#[tauri::command]
pub async fn get_app_data_dir(app: tauri::AppHandle) -> Result<AppPaths, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let previews = app_data.join("previews");
    let thumbs = previews.join("thumbs");
    let standard = previews.join("standard");

    Ok(AppPaths {
        app_data: app_data.to_string_lossy().to_string(),
        previews: previews.to_string_lossy().to_string(),
        thumbs: thumbs.to_string_lossy().to_string(),
        standard: standard.to_string_lossy().to_string(),
    })
}

/// Check if a file exists on disk.
#[tauri::command]
pub async fn check_file_exists(path: String) -> Result<bool, String> {
    Ok(std::path::Path::new(&path).exists())
}
