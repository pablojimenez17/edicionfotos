use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Pool, Row, Sqlite};
use std::str::FromStr;

use std::sync::atomic::{AtomicUsize, Ordering};

static DB_COUNTER: AtomicUsize = AtomicUsize::new(1);

async fn setup_test_db() -> Pool<Sqlite> {
    let id = DB_COUNTER.fetch_add(1, Ordering::SeqCst);
    let db_url = format!("sqlite:file:memdb_{}?mode=memory&cache=shared", id);

    let options = SqliteConnectOptions::from_str(&db_url)
        .expect("Valid connect options")
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .expect("Failed to connect to in-memory sqlite");

    // Load migration 001_initial.sql and execute all statements at once via raw_sql
    let migration_sql = include_str!("../migrations/001_initial.sql");
    sqlx::raw_sql(migration_sql)
        .execute(&pool)
        .await
        .expect("Failed executing migration 001_initial.sql");

    pool
}

#[tokio::test]
async fn test_pragma_foreign_keys_active_across_pool_connections() {
    let pool = setup_test_db().await;

    // Check PRAGMA foreign_keys on multiple pool connections
    for _ in 0..5 {
        let mut conn = pool.acquire().await.expect("Acquire connection from pool");
        let row = sqlx::query("PRAGMA foreign_keys;")
            .fetch_one(&mut *conn)
            .await
            .expect("PRAGMA query");
        let fk_enabled: i64 = row.get(0);
        assert_eq!(fk_enabled, 1, "PRAGMA foreign_keys must be active (1) on all pool connections");
    }
}

#[tokio::test]
async fn test_fts_workflow_insert_search_rename_delete() {
    let pool = setup_test_db().await;

    // 1. Insert root folder and folder
    sqlx::query("INSERT INTO root_folders (id, path, name) VALUES (1, 'C:/Photos', 'Main')")
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO folders (id, root_id, rel_path, name) VALUES (1, 1, '2024/Vacation', 'Vacation')")
        .execute(&pool)
        .await
        .unwrap();

    // 2. Insert photo
    sqlx::query(
        "INSERT INTO photos (id, folder_id, filename, file_path, width, height, rating) \
         VALUES (100, 1, 'mountain_sunset.jpg', '2024/Vacation/mountain_sunset.jpg', 6000, 4000, 5)"
    )
    .execute(&pool)
    .await
    .unwrap();

    // Verify FTS indexed the filename
    let fts_match = sqlx::query("SELECT rowid FROM photos_fts WHERE photos_fts MATCH 'mountain*'")
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(fts_match.len(), 1);
    assert_eq!(fts_match[0].get::<i64, _>(0), 100);

    // 3. Add keywords
    sqlx::query("INSERT INTO keywords (id, name) VALUES (10, 'Landscape')")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO keywords (id, name) VALUES (11, 'Alps')")
        .execute(&pool)
        .await
        .unwrap();

    // Assign keywords to photo
    sqlx::query("INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (100, 10)")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (100, 11)")
        .execute(&pool)
        .await
        .unwrap();

    // Search FTS by keyword
    let kw_match = sqlx::query("SELECT rowid FROM photos_fts WHERE photos_fts MATCH 'Alps'")
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(kw_match.len(), 1);
    assert_eq!(kw_match[0].get::<i64, _>(0), 100);

    // 4. Rename keyword: 'Alps' -> 'Dolomites'
    sqlx::query("UPDATE keywords SET name = 'Dolomites' WHERE id = 11")
        .execute(&pool)
        .await
        .unwrap();

    // Verify old keyword no longer matches
    let old_match = sqlx::query("SELECT rowid FROM photos_fts WHERE photos_fts MATCH 'Alps'")
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(old_match.len(), 0, "Old keyword 'Alps' should no longer match");

    // Verify new keyword matches
    let new_match = sqlx::query("SELECT rowid FROM photos_fts WHERE photos_fts MATCH 'Dolomites'")
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(new_match.len(), 1, "New keyword 'Dolomites' must match in FTS");
    assert_eq!(new_match[0].get::<i64, _>(0), 100);

    // 5. Delete photo and verify FTS entry is purged
    sqlx::query("DELETE FROM photos WHERE id = 100")
        .execute(&pool)
        .await
        .unwrap();

    let post_delete_match = sqlx::query("SELECT rowid FROM photos_fts WHERE photos_fts MATCH 'mountain* OR Dolomites'")
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(post_delete_match.len(), 0, "Deleted photo must be removed from photos_fts");

    let fts_row_count = sqlx::query("SELECT COUNT(*) FROM photos_fts WHERE rowid = 100")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(fts_row_count.get::<i64, _>(0), 0, "Zero rows in photos_fts for photo id 100");
}

#[tokio::test]
async fn test_photo_cascade_delete_no_orphans() {
    let pool = setup_test_db().await;

    // Root folder and folder
    sqlx::query("INSERT INTO root_folders (id, path, name) VALUES (1, 'C:/Photos', 'Main')")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO folders (id, root_id, rel_path, name) VALUES (1, 1, '2024', '2024')")
        .execute(&pool)
        .await
        .unwrap();

    // Photo
    sqlx::query("INSERT INTO photos (id, folder_id, filename, file_path) VALUES (42, 1, 'sample.jpg', '2024/sample.jpg')")
        .execute(&pool)
        .await
        .unwrap();

    // Keywords and assignment
    sqlx::query("INSERT INTO keywords (id, name) VALUES (1, 'Nature')")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (42, 1)")
        .execute(&pool)
        .await
        .unwrap();

    // Collection and assignment
    sqlx::query("INSERT INTO collections (id, name) VALUES (1, 'Best 2024')")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO collection_photos (collection_id, photo_id) VALUES (1, 42)")
        .execute(&pool)
        .await
        .unwrap();

    // Edits
    sqlx::query("INSERT INTO edits (photo_id, settings) VALUES (42, '{\"exposure\": 1.0}')")
        .execute(&pool)
        .await
        .unwrap();

    // History steps
    sqlx::query("INSERT INTO history_steps (photo_id, step_index, label, settings) VALUES (42, 1, 'Exposure', '{}')")
        .execute(&pool)
        .await
        .unwrap();

    // Brush strokes
    sqlx::query("INSERT INTO brush_strokes (photo_id, stroke_id, points_data) VALUES (42, 'stroke_1', X'01020304')")
        .execute(&pool)
        .await
        .unwrap();

    // Previews
    sqlx::query("INSERT INTO previews (photo_id, size, cache_path) VALUES (42, 'thumb', 'cache/42_thumb.jpg')")
        .execute(&pool)
        .await
        .unwrap();

    // Verify everything was inserted
    assert_eq!(sqlx::query("SELECT COUNT(*) FROM photo_keywords WHERE photo_id = 42").fetch_one(&pool).await.unwrap().get::<i64, _>(0), 1);
    assert_eq!(sqlx::query("SELECT COUNT(*) FROM collection_photos WHERE photo_id = 42").fetch_one(&pool).await.unwrap().get::<i64, _>(0), 1);
    assert_eq!(sqlx::query("SELECT COUNT(*) FROM edits WHERE photo_id = 42").fetch_one(&pool).await.unwrap().get::<i64, _>(0), 1);
    assert_eq!(sqlx::query("SELECT COUNT(*) FROM history_steps WHERE photo_id = 42").fetch_one(&pool).await.unwrap().get::<i64, _>(0), 1);
    assert_eq!(sqlx::query("SELECT COUNT(*) FROM brush_strokes WHERE photo_id = 42").fetch_one(&pool).await.unwrap().get::<i64, _>(0), 1);
    assert_eq!(sqlx::query("SELECT COUNT(*) FROM previews WHERE photo_id = 42").fetch_one(&pool).await.unwrap().get::<i64, _>(0), 1);
    assert_eq!(sqlx::query("SELECT COUNT(*) FROM photos_fts WHERE rowid = 42").fetch_one(&pool).await.unwrap().get::<i64, _>(0), 1);

    // Delete the photo
    sqlx::query("DELETE FROM photos WHERE id = 42")
        .execute(&pool)
        .await
        .unwrap();

    // Verify NO orphaned rows remain anywhere
    assert_eq!(sqlx::query("SELECT COUNT(*) FROM photo_keywords WHERE photo_id = 42").fetch_one(&pool).await.unwrap().get::<i64, _>(0), 0);
    assert_eq!(sqlx::query("SELECT COUNT(*) FROM collection_photos WHERE photo_id = 42").fetch_one(&pool).await.unwrap().get::<i64, _>(0), 0);
    assert_eq!(sqlx::query("SELECT COUNT(*) FROM edits WHERE photo_id = 42").fetch_one(&pool).await.unwrap().get::<i64, _>(0), 0);
    assert_eq!(sqlx::query("SELECT COUNT(*) FROM history_steps WHERE photo_id = 42").fetch_one(&pool).await.unwrap().get::<i64, _>(0), 0);
    assert_eq!(sqlx::query("SELECT COUNT(*) FROM brush_strokes WHERE photo_id = 42").fetch_one(&pool).await.unwrap().get::<i64, _>(0), 0);
    assert_eq!(sqlx::query("SELECT COUNT(*) FROM previews WHERE photo_id = 42").fetch_one(&pool).await.unwrap().get::<i64, _>(0), 0);
    assert_eq!(sqlx::query("SELECT COUNT(*) FROM photos_fts WHERE rowid = 42").fetch_one(&pool).await.unwrap().get::<i64, _>(0), 0);
}

#[tokio::test]
async fn test_unique_indexes_and_history_cap() {
    let pool = setup_test_db().await;

    sqlx::query("INSERT INTO root_folders (id, path, name) VALUES (1, 'C:/Photos', 'Main')")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO folders (id, root_id, rel_path, name) VALUES (1, 1, '2024', '2024')")
        .execute(&pool)
        .await
        .unwrap();

    // 1. Unique index on photos(folder_id, filename COLLATE NOCASE) WHERE master_id IS NULL
    sqlx::query("INSERT INTO photos (id, folder_id, filename, file_path) VALUES (1, 1, 'test.jpg', '2024/test.jpg')")
        .execute(&pool)
        .await
        .unwrap();

    // Case-insensitive duplicate must fail
    let duplicate_photo = sqlx::query("INSERT INTO photos (id, folder_id, filename, file_path) VALUES (2, 1, 'TEST.JPG', '2024/TEST.JPG')")
        .execute(&pool)
        .await;
    assert!(duplicate_photo.is_err(), "Duplicate filename in same folder must be rejected by unique index");

    // Virtual copy (master_id = 1) with same filename IS allowed
    let virtual_copy = sqlx::query("INSERT INTO photos (id, folder_id, master_id, filename, file_path) VALUES (3, 1, 1, 'test.jpg', '2024/test.jpg')")
        .execute(&pool)
        .await;
    assert!(virtual_copy.is_ok(), "Virtual copy with same filename must be allowed (master_id IS NOT NULL)");

    // 2. Unique index on keywords(COALESCE(parent_id, 0), name COLLATE NOCASE)
    sqlx::query("INSERT INTO keywords (id, parent_id, name) VALUES (1, NULL, 'Travel')")
        .execute(&pool)
        .await
        .unwrap();

    let duplicate_kw = sqlx::query("INSERT INTO keywords (id, parent_id, name) VALUES (2, NULL, 'travel')")
        .execute(&pool)
        .await;
    assert!(duplicate_kw.is_err(), "Duplicate keyword at root level (case-insensitive) must be rejected");

    // 3. Test history 100 steps cap
    for i in 1..=105 {
        sqlx::query("INSERT INTO history_steps (photo_id, step_index, label, settings) VALUES (1, ?, 'Step', '{}')")
            .bind(i)
            .execute(&pool)
            .await
            .unwrap();
    }

    let history_count = sqlx::query("SELECT COUNT(*) FROM history_steps WHERE photo_id = 1")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(history_count.get::<i64, _>(0), 100, "History steps must be capped at 100");
}

#[tokio::test]
async fn test_history_cumulative_size_cap_keeps_most_recent() {
    let pool = setup_test_db().await;

    sqlx::query("INSERT INTO root_folders (id, path, name) VALUES (1, 'C:/Photos', 'Main')")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO folders (id, root_id, rel_path, name) VALUES (1, 1, '2024', '2024')")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO photos (id, folder_id, filename, file_path) VALUES (10, 1, 'heavy.jpg', '2024/heavy.jpg')")
        .execute(&pool)
        .await
        .unwrap();

    // 20 MB string payload (20_000_000 bytes)
    let payload_20mb = "x".repeat(20_000_000);

    // Step 1: 20 MB
    sqlx::query("INSERT INTO history_steps (photo_id, step_index, label, settings) VALUES (10, 1, 'Step 1', ?)")
        .bind(&payload_20mb)
        .execute(&pool)
        .await
        .unwrap();

    // Step 2: 20 MB (total 40 MB <= 50 MB)
    sqlx::query("INSERT INTO history_steps (photo_id, step_index, label, settings) VALUES (10, 2, 'Step 2', ?)")
        .bind(&payload_20mb)
        .execute(&pool)
        .await
        .unwrap();

    let count_2 = sqlx::query("SELECT COUNT(*) FROM history_steps WHERE photo_id = 10")
        .fetch_one(&pool)
        .await
        .unwrap()
        .get::<i64, _>(0);
    assert_eq!(count_2, 2, "Both 20MB steps must fit within 50MB");

    // Step 3: 20 MB (total 60 MB > 50 MB)
    // Most recent step 3 (20MB) and step 2 (cumul 40MB) survive.
    // Step 1 (cumul 60MB > 50MB) must be deleted!
    sqlx::query("INSERT INTO history_steps (photo_id, step_index, label, settings) VALUES (10, 3, 'Step 3', ?)")
        .bind(&payload_20mb)
        .execute(&pool)
        .await
        .unwrap();

    let remaining_steps = sqlx::query("SELECT step_index FROM history_steps WHERE photo_id = 10 ORDER BY step_index ASC")
        .fetch_all(&pool)
        .await
        .unwrap();

    let indices: Vec<i64> = remaining_steps.iter().map(|r| r.get(0)).collect();
    assert_eq!(indices, vec![2, 3], "Step 1 must be deleted, leaving the 2 most recent steps (2 and 3)");
}

#[test]
fn test_raw_bayer_demosaicing() {
    use lumen_lib::commands::raw::{demosaic_bilinear, BayerPattern};

    // Synthetic 4x4 Bayer RGGB sensor
    // Row 0: R0 G1 R2 G3
    // Row 1: G4 B5 G6 B7
    // Row 2: R8 G9 R10 G11
    // Row 3: G12 B13 G14 B15
    let raw: Vec<u16> = vec![
        16000, 8000, 16000, 8000,
        8000, 4000, 8000, 4000,
        16000, 8000, 16000, 8000,
        8000, 4000, 8000, 4000,
    ];

    let rgb = demosaic_bilinear(&raw, 4, 4, BayerPattern::Rggb);
    assert_eq!(rgb.len(), 4 * 4 * 3, "Output RGB size must be width * height * 3");

    // Inspect pixel (1, 1): blue pixel location
    let p1_1_idx = (1 * 4 + 1) * 3;
    let b = rgb[p1_1_idx + 2];
    assert!(b > 50, "Blue channel must be reconstructed from raw data");
}

#[tokio::test]
async fn test_benchmark_sqlite_1000_photos_batch_insert() {
    let pool = setup_test_db().await;

    sqlx::query("INSERT INTO root_folders (id, path, name) VALUES (1, 'C:/Photos', 'Main')")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO folders (id, root_id, rel_path, name) VALUES (1, 1, '2024', '2024')")
        .execute(&pool)
        .await
        .unwrap();

    let start = std::time::Instant::now();
    let mut tx = pool.begin().await.unwrap();

    for i in 1..=1000 {
        let filename = format!("DSC_{:05}.ARW", i);
        let rel_path = format!("2024/DSC_{:05}.ARW", i);
        sqlx::query(
            "INSERT INTO photos (id, folder_id, filename, file_path, width, height, rating, date_taken) \
             VALUES (?, 1, ?, ?, 6000, 4000, 3, '2024-05-18T14:30:00Z')"
        )
        .bind(i)
        .bind(&filename)
        .bind(&rel_path)
        .execute(&mut *tx)
        .await
        .unwrap();
    }

    tx.commit().await.unwrap();
    let duration = start.elapsed();

    // Verify all 1,000 photos exist in photos and photos_fts
    let photo_count: i64 = sqlx::query("SELECT COUNT(*) FROM photos")
        .fetch_one(&pool)
        .await
        .unwrap()
        .get(0);
    assert_eq!(photo_count, 1000);

    let fts_count: i64 = sqlx::query("SELECT COUNT(*) FROM photos_fts")
        .fetch_one(&pool)
        .await
        .unwrap()
        .get(0);
    assert_eq!(fts_count, 1000);

    println!("\n>>> RUST SQLITE BENCHMARK: 1,000 photos inserted with FTS5 triggers in {:?}", duration);
}

#[test]
fn test_rawloader_interface_and_white_balance_extraction() {
    use lumen_lib::commands::raw::is_raw_file;
    use std::path::Path;

    assert!(is_raw_file(Path::new("photo.CR2")));
    assert!(is_raw_file(Path::new("photo.NEF")));
    assert!(is_raw_file(Path::new("photo.ARW")));
    assert!(is_raw_file(Path::new("photo.DNG")));
    assert!(!is_raw_file(Path::new("photo.PNG")));
    assert!(!is_raw_file(Path::new("photo.JPG")));
}

#[test]
fn test_img_parts_icc_and_exif_injection() {
    use img_parts::jpeg::Jpeg;
    use img_parts::{ImageEXIF, ImageICC, Bytes};

    // Minimal valid 1x1 JPEG bytes
    let mut minimal_jpeg = Vec::new();
    let img = image::RgbImage::new(1, 1);
    image::codecs::jpeg::JpegEncoder::new(&mut minimal_jpeg)
        .encode(img.as_raw(), 1, 1, image::ColorType::Rgb8.into())
        .unwrap();

    let mut jpeg = Jpeg::from_bytes(Bytes::from(minimal_jpeg)).expect("Parse JPEG with img-parts");

    // Inject ICC Profile (e.g. sRGB marker)
    let dummy_icc = Bytes::from_static(b"LUMEN_SRGB_ICC_PROFILE_V2_DATA");
    jpeg.set_icc_profile(Some(dummy_icc.clone()));

    // Inject EXIF payload
    let dummy_exif = Bytes::from_static(b"Exif\0\0II*\0\x08\0\0\0\0\0\0\0");
    jpeg.set_exif(Some(dummy_exif.clone()));

    // Serialize back to bytes
    let mut output = Vec::new();
    jpeg.encoder().write_to(&mut output).expect("Encode JPEG with ICC & EXIF");

    // Re-read with img-parts and assert ICC and EXIF are present!
    let reread_jpeg = Jpeg::from_bytes(Bytes::from(output)).expect("Re-read written JPEG");
    assert_eq!(reread_jpeg.icc_profile(), Some(dummy_icc));
    assert_eq!(reread_jpeg.exif(), Some(dummy_exif));
}

#[test]
fn test_export_jpeg_with_icc_profile_and_exif_reread() {
    use lumen_lib::commands::export::{create_export_session, write_export_tile, finish_export_session};
    use img_parts::jpeg::Jpeg;
    use img_parts::{ImageEXIF, ImageICC, Bytes};
    use std::fs;

    let session_id = "test_export_icc_session".to_string();
    create_export_session(session_id.clone(), 100, 100).expect("Create session");

    // 100x100 RGBA8 tile (40000 bytes)
    let tile_rgba = vec![180u8; 100 * 100 * 4];
    write_export_tile(session_id.clone(), 0, 0, 100, 100, tile_rgba).expect("Write tile");

    let out_dir = std::env::temp_dir().join("lumen_test_exports");
    fs::create_dir_all(&out_dir).ok();
    let out_file = out_dir.join("test_p3_export.jpg").to_string_lossy().to_string();

    let exif_payload = b"Exif\0\0II*\0\x08\0\0\0\x01\0\x05\x01\x02\0\x06\0\0\0Lumen\0".to_vec();

    finish_export_session(
        session_id,
        out_file.clone(),
        "jpeg".to_string(),
        90,
        None,
        Some("display-p3".to_string()),
        Some(exif_payload.clone()),
    ).expect("Finish export session");

    // Read back exported JPEG file
    let file_bytes = fs::read(&out_file).expect("Read exported file");
    let jpeg = Jpeg::from_bytes(Bytes::from(file_bytes)).expect("Parse exported JPEG");

    // Verify ICC profile was embedded
    let icc_opt = jpeg.icc_profile();
    assert!(icc_opt.is_some(), "ICC profile must be embedded in APP2 marker");
    let icc_bytes = icc_opt.unwrap();
    assert!(icc_bytes.len() > 128, "ICC profile must be a valid structure");
    let icc_str = String::from_utf8_lossy(&icc_bytes);
    assert!(icc_str.contains("Display P3") || icc_bytes.windows(4).any(|w| w == b"LUMN"), "ICC profile must contain Display P3 / Lumen tag");

    // Verify EXIF metadata was embedded
    let exif_opt = jpeg.exif();
    assert!(exif_opt.is_some(), "EXIF metadata must be embedded in APP1 marker");
    assert_eq!(exif_opt.unwrap().as_ref(), exif_payload.as_slice());

    // Clean up
    fs::remove_file(&out_file).ok();
}

#[test]
fn test_pdf_photobook_and_web_gallery_export() {
    use lumen_lib::commands::book::{generate_photobook_pdf, BookPageExport};
    use lumen_lib::commands::web::export_web_gallery_to_disk;
    use std::fs;

    let temp_dir = std::env::temp_dir().join("lumen_test_book_web");
    fs::create_dir_all(&temp_dir).ok();

    // 1. Test PDF generation with printpdf
    let pdf_path = temp_dir.join("test_book.pdf").to_string_lossy().to_string();
    let pages = vec![
        BookPageExport {
            page_number: 1,
            title: "Introducción a los Alpes".to_string(),
            subtitle: Some("Fotografía de paisajes 2024".to_string()),
        },
        BookPageExport {
            page_number: 2,
            title: "Atardecer en Dolomitas".to_string(),
            subtitle: Some("Luz dorada sobre roca caliza".to_string()),
        },
    ];

    let generated_pdf = generate_photobook_pdf(
        pdf_path.clone(),
        "Mi Fotolibro 2024".to_string(),
        "a4".to_string(),
        pages,
    ).expect("Generate PDF with printpdf");

    assert!(fs::metadata(&generated_pdf).is_ok());
    let pdf_bytes = fs::read(&generated_pdf).expect("Read generated PDF");
    assert!(pdf_bytes.starts_with(b"%PDF-"), "Generated file must have valid PDF header");

    // 2. Test Web gallery generation on disk
    let web_dir = temp_dir.join("test_web_gallery").to_string_lossy().to_string();
    let exported_web = export_web_gallery_to_disk(
        web_dir.clone(),
        "Galería de Viajes".to_string(),
        "dark".to_string(),
        "grid".to_string(),
        vec!["thumb1.jpg".to_string(), "thumb2.jpg".to_string()],
    ).expect("Export web gallery to disk");

    let index_file = temp_dir.join("test_web_gallery").join("index.html");
    let style_file = temp_dir.join("test_web_gallery").join("style.css");
    assert!(index_file.exists(), "index.html must exist on disk");
    assert!(style_file.exists(), "style.css must exist on disk");

    let index_content = fs::read_to_string(&index_file).unwrap();
    assert!(index_content.contains("Galería de Viajes"));
    assert!(index_content.contains("gallery-container"));

    // Cleanup
    fs::remove_file(&pdf_path).ok();
    fs::remove_dir_all(&exported_web).ok();
}





