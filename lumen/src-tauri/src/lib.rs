pub mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::import::import_folder,
            commands::import::scan_folder,
            commands::thumbnail::generate_thumbnail,
            commands::thumbnail::get_thumbnail_path,
            commands::catalog::run_migration,
            commands::catalog::get_app_data_dir,
            commands::catalog::check_file_exists,
            commands::export::create_export_session,
            commands::export::write_export_tile,
            commands::export::finish_export_session,
            commands::raw::extract_raw_preview,
        ])
        .setup(|app| {
            // Ensure the previews cache directory exists
            let app_data = app.path().app_data_dir().expect("Failed to get app data dir");
            let previews_dir = app_data.join("previews");
            let thumbs_dir = previews_dir.join("thumbs");
            let standard_dir = previews_dir.join("standard");
            std::fs::create_dir_all(&thumbs_dir).ok();
            std::fs::create_dir_all(&standard_dir).ok();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Lumen");
}
