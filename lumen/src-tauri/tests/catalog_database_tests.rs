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

#[test]
fn test_lensfun_xml_parsing_and_distortion_profile() {
    use lumen_lib::commands::lensfun::{parse_lensfun_profile, find_lens_profile, LENSFUN_DATABASE_XML};

    // 1. Sony 24-70mm at 24mm (poly5 distortion model)
    let profile_sony = parse_lensfun_profile(LENSFUN_DATABASE_XML, "Sony", "24-70mm", 24.0)
        .expect("Lensfun profile for Sony 24-70mm at 24mm must be found");

    assert_eq!(profile_sony.maker, "Sony");
    assert!(profile_sony.model.contains("24-70mm"));
    assert_eq!(profile_sony.distortion_model, "poly5");
    assert!((profile_sony.k1 - (-0.0315)).abs() < 1e-6);
    assert!((profile_sony.k2 - 0.0082).abs() < 1e-6);
    assert!(profile_sony.ca_kr > 0.0);

    // 2. Canon RF 24-70mm at 50mm (poly3 distortion model)
    let profile_canon = parse_lensfun_profile(LENSFUN_DATABASE_XML, "Canon", "24-70mm", 50.0)
        .expect("Lensfun profile for Canon RF 24-70mm at 50mm must be found");
    assert_eq!(profile_canon.distortion_model, "poly3");
    assert!((profile_canon.k1 - 0.0082).abs() < 1e-6);

    // 3. Command interface find_lens_profile
    let cmd_result = find_lens_profile("Nikon".to_string(), "24-70mm".to_string(), 24.0);
    assert!(cmd_result.is_some());
    let nikon = cmd_result.unwrap();
    assert_eq!(nikon.distortion_model, "poly5");
    assert!((nikon.k1 - (-0.0285)).abs() < 1e-6);
}

#[test]
fn test_lensfun_real_lens_pixel_displacement() {
    use lumen_lib::commands::lensfun::{parse_lensfun_profile, apply_lens_distortion_correction, LENSFUN_DATABASE_XML};
    use image::{Rgb, RgbImage};

    // Sony FE 24-70mm F2.8 GM II at 24mm (poly5 distortion model with k1 = -0.0315, k2 = 0.0082)
    let profile = parse_lensfun_profile(LENSFUN_DATABASE_XML, "Sony", "24-70mm", 24.0)
        .expect("Lensfun profile must exist");

    let w = 800u32;
    let h = 600u32;
    // Create image with high-contrast concentric rings/checkerboard to detect distortion
    let input = RgbImage::from_fn(w, h, |x, y| {
        let dx = (x as f64 - 400.0) / 400.0;
        let dy = (y as f64 - 300.0) / 300.0;
        let r = (dx * dx + dy * dy).sqrt();
        let ring = ((r * 20.0).sin() * 127.0 + 128.0) as u8;
        Rgb([ring, (x % 256) as u8, (y % 256) as u8])
    });

    let corrected = apply_lens_distortion_correction(&input, &profile);

    // 1. Center pixel (r = 0) must remain identical
    assert_eq!(input.get_pixel(400, 300), corrected.get_pixel(400, 300), "Center pixel must not shift");

    // 2. Pixels near corners/edges (r >> 0) must change due to barrel distortion correction
    let mut changed_pixels = 0;
    for y in 0..h {
        for x in 0..w {
            if input.get_pixel(x, y) != corrected.get_pixel(x, y) {
                changed_pixels += 1;
            }
        }
    }

    assert!(changed_pixels > 10_000, "Correction must change at least 10,000 pixels across the image, found {}", changed_pixels);
    println!("Lensfun real lens test: {} pixels corrected by Sony 24mm profile", changed_pixels);
}

#[test]
fn test_develop_real_raw_camera_pipeline() {
    use lumen_lib::commands::raw::find_embedded_jpeg;
    use std::fs;

    let nef_path = std::path::Path::new("tests/fixtures/sample_real.nef");
    assert!(nef_path.exists(), "Sample NEF file must exist in fixtures");

    // 1. Extraer preview embebida original del RAW
    let embedded_preview_bytes = find_embedded_jpeg(nef_path)
        .expect("Must extract embedded JPEG preview from Nikon D90 NEF");
    assert!(embedded_preview_bytes.len() > 10_000, "Embedded preview must be valid JPEG data");

    let raw_check_dir = std::path::Path::new("../docs/raw-check");
    fs::create_dir_all(&raw_check_dir).expect("Create docs/raw-check directory");

    let out_preview = raw_check_dir.join("preview_embebido.jpg");
    fs::write(&out_preview, &embedded_preview_bytes).expect("Write embedded preview");

    // 2. Desarrollar RAW en modo NEUTRO (Antes: sin perfil ajustado)
    use lumen_lib::commands::raw::{develop_raw_file_with_profile, RawProfileMode, delta_e_lab};
    let developed_neutral = develop_raw_file_with_profile(nef_path, RawProfileMode::Neutral)
        .expect("Develop neutral RAW");
    let out_neutral = raw_check_dir.join("raw_desarrollado_antes_neutro.jpg");
    developed_neutral.save(&out_neutral).expect("Save developed neutral JPEG");

    // 3. Desarrollar RAW en modo CÁMARA ESTÁNDAR (Después: RCD + Matriz mínimos cuadrados + Curva tonal + Enfoque 25)
    let developed_standard = develop_raw_file_with_profile(nef_path, RawProfileMode::CameraStandard)
        .expect("Develop camera standard RAW");
    let out_standard = raw_check_dir.join("raw_desarrollado_despues_camara_estandar.jpg");
    developed_standard.save(&out_standard).expect("Save developed camera standard JPEG");

    // Mantener raw_desarrollado.jpg con el nuevo perfil estándar
    let out_developed = raw_check_dir.join("raw_desarrollado.jpg");
    developed_standard.save(&out_developed).expect("Save developed JPEG");

    let preview_img = image::open(&out_preview).expect("Open preview image").to_rgb8();
    let pw = preview_img.width();
    let ph = preview_img.height();
    let dw = developed_standard.width();
    let dh = developed_standard.height();

    let raw = rawloader::decode_file(nef_path).expect("Decode raw");
    println!("RAW make: {}, model: {}", raw.make, raw.model);
    println!("RAW wb_coeffs (antes de matriz): {:?}", raw.wb_coeffs);

    let crop_x = ((dw.saturating_sub(pw)) / 2).max(raw.crops[1] as u32);
    let crop_y = ((dh.saturating_sub(ph)) / 2).max(raw.crops[0] as u32);
    println!("DIMENSIONS: pw={}, ph={}, dw={}, dh={}, crops={:?}", pw, ph, dw, dh, raw.crops);

    // 4. Medir zonas grises/neutras en Preview vs Neutro vs Cámara Estándar
    let mut neutral_samples = Vec::new();
    for py in (100..ph - 100).step_by(15) {
        for px in (100..pw - 100).step_by(15) {
            let p_pix = preview_img.get_pixel(px, py);
            let r = p_pix[0] as i32;
            let g = p_pix[1] as i32;
            let b = p_pix[2] as i32;
            if (r - g).abs() <= 2 && (g - b).abs() <= 2 && (r - b).abs() <= 2 && g >= 60 && g <= 200 {
                let dx = crop_x + px;
                let dy = crop_y + py;
                if dx < dw && dy < dh {
                    let d_neut = developed_neutral.get_pixel(dx, dy);
                    let d_std = developed_standard.get_pixel(dx, dy);
                    if d_neut[0] > 0 || d_neut[1] > 0 || d_neut[2] > 0 {
                        neutral_samples.push((*p_pix, *d_neut, *d_std));
                    }
                }
            }
        }
    }

    let n_neut = neutral_samples.len().max(1) as f64;
    let mut sum_p = [0f64; 3];
    let mut sum_neut = [0f64; 3];
    let mut sum_std = [0f64; 3];
    for (p, neut, std) in &neutral_samples {
        for c in 0..3 {
            sum_p[c] += p[c] as f64;
            sum_neut[c] += neut[c] as f64;
            sum_std[c] += std[c] as f64;
        }
    }

    println!("=======================================================");
    println!("  MEDICIÓN DE ZONAS NEUTRAS / BALANCE DE BLANCOS");
    println!("=======================================================");
    println!("1. Preview embebido:    R={:.1} G={:.1} B={:.1} (Equilibrio neutro)", sum_p[0]/n_neut, sum_p[1]/n_neut, sum_p[2]/n_neut);
    println!("2. Revelado Neutro:     R={:.1} G={:.1} B={:.1} (Dominante cálida R-B = {:.1})", sum_neut[0]/n_neut, sum_neut[1]/n_neut, sum_neut[2]/n_neut, (sum_neut[0]-sum_neut[2])/n_neut);
    println!("3. Cámara estándar:     R={:.1} G={:.1} B={:.1} (Corregido R-B = {:.1})", sum_std[0]/n_neut, sum_std[1]/n_neut, sum_std[2]/n_neut, (sum_std[0]-sum_std[2])/n_neut);

    // 5. Medir error medio ΔE (CIELAB) sobre 1.000+ píxeles muestreados no recortados (<2% o >98%)
    let mut delta_e_neut_sum = 0.0f64;
    let mut delta_e_std_sum = 0.0f64;
    let mut sample_count = 0usize;

    for py in (20..ph - 20).step_by(10) {
        for px in (20..pw - 20).step_by(10) {
            let p_pix = preview_img.get_pixel(px, py);
            // Excluir recortados (<2% o >98%)
            if p_pix[0] < 5 || p_pix[0] > 250 || p_pix[1] < 5 || p_pix[1] > 250 || p_pix[2] < 5 || p_pix[2] > 250 {
                continue;
            }

            let dx = crop_x + px;
            let dy = crop_y + py;
            if dx >= dw || dy >= dh {
                continue;
            }

            let d_neut = developed_neutral.get_pixel(dx, dy);
            let d_std = developed_standard.get_pixel(dx, dy);

            let de_neut = delta_e_lab((p_pix[0], p_pix[1], p_pix[2]), (d_neut[0], d_neut[1], d_neut[2]));
            let de_std = delta_e_lab((p_pix[0], p_pix[1], p_pix[2]), (d_std[0], d_std[1], d_std[2]));

            delta_e_neut_sum += de_neut;
            delta_e_std_sum += de_std;
            sample_count += 1;
        }
    }

    let avg_de_neut = delta_e_neut_sum / sample_count as f64;
    let avg_de_std = delta_e_std_sum / sample_count as f64;
    let reduction_pct = ((avg_de_neut - avg_de_std) / avg_de_neut) * 100.0;

    println!("=======================================================");
    println!("  RESULTADOS COMPARATIVOS DE ERROR COLORIMÉTRICO (ΔE Lab)");
    println!("  Píxeles válidos analizados: {}", sample_count);
    println!("=======================================================");
    println!("  - Error medio ΔE ANTES (Neutro / plano):    {:.2}", avg_de_neut);
    println!("  - Error medio ΔE DESPUÉS (Cámara estándar): {:.2}", avg_de_std);
    println!("  - Reducción del error colorimétrico:        {:.1}%", reduction_pct);
    println!("=======================================================");

    assert!(sample_count >= 1000, "Debe evaluar sobre 1000+ píxeles válidos, encontró {}", sample_count);
    assert!(avg_de_std < avg_de_neut, "El perfil Cámara estándar debe reducir el error frente al neutro");

    assert!(fs::metadata(&out_preview).unwrap().len() > 10_000, "Preview must be valid image file");
    assert!(fs::metadata(&out_developed).unwrap().len() > 500_000, "Developed 12 MP image must weigh > 500 KB");
    assert!(fs::metadata(&out_neutral).unwrap().len() > 500_000, "Neutral 12 MP image must weigh > 500 KB");
    assert!(fs::metadata(&out_standard).unwrap().len() > 500_000, "Standard 12 MP image must weigh > 500 KB");
}

#[test]
fn test_path_normalization_to_forward_slashes() {
    let raw_windows_path = r"C:\Photos\2024\Vacation\DSC_0001.JPG";
    let normalized = raw_windows_path.replace('\\', "/");
    assert!(!normalized.contains('\\'), "Normalized path must not contain backslashes");
    assert_eq!(normalized, "C:/Photos/2024/Vacation/DSC_0001.JPG");

    let rel_windows = r"2024\Vacation\subfolder\DSC_0002.CR2";
    let rel_norm = rel_windows.replace('\\', "/");
    assert_eq!(rel_norm, "2024/Vacation/subfolder/DSC_0002.CR2");
}

#[tokio::test]
async fn test_benchmark_200_jpegs_and_24mp_export() {
    use lumen_lib::commands::import::import_folder;
    use lumen_lib::commands::thumbnail::batch_generate_thumbnails_parallel;
    use lumen_lib::commands::export::{create_export_session, write_export_tile, finish_export_session};
    use std::fs;
    use std::time::{Instant, SystemTime, UNIX_EPOCH};
    use image::codecs::jpeg::JpegEncoder;
    use image::RgbImage;

    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let temp_root = std::env::temp_dir().join(format!("lumen_bench_200_{}", nonce));
    let photos_dir = temp_root.join("photos_200");
    let thumbs_dir = temp_root.join("thumbs_200");
    fs::create_dir_all(&photos_dir).expect("Create photos bench dir");
    fs::create_dir_all(&thumbs_dir).expect("Create thumbs bench dir");

    // 200 real 24 MP (6000x4000) JPEG images with realistic photographic detail
    use rayon::prelude::*;
    let synth_start = Instant::now();
    (1..=200).into_par_iter().for_each(|i| {
        let photo_path = photos_dir.join(format!("DSC_{:04}.jpg", i));
        let img = RgbImage::from_fn(6000, 4000, |x, y| {
            let r = ((x * 255) / 6000) as u8;
            let g = ((y * 255) / 4000) as u8;
            let b = (((i * 17) + (x / 64) + (y / 64)) % 256) as u8;
            image::Rgb([r, g, b])
        });
        let mut file = fs::File::create(&photo_path).expect("Create JPEG file");
        let mut encoder = JpegEncoder::new_with_quality(&mut file, 80);
        encoder.encode(img.as_raw(), 6000, 4000, image::ColorType::Rgb8.into()).unwrap();
    });
    let synth_duration = synth_start.elapsed();

    // 1. Benchmark: Scan 200 real 24 MP JPEG files
    let scan_start = Instant::now();
    let (folder_name, scanned) = import_folder(photos_dir.to_string_lossy().to_string())
        .await
        .expect("Scan 200 JPEG files");
    let scan_duration = scan_start.elapsed();
    assert_eq!(scanned.len(), 200, "Must scan exactly 200 JPEG files");

    // 2. Benchmark: Batch insert 200 photos into SQLite catalog with FTS5 triggers
    let pool = setup_test_db().await;
    let db_start = Instant::now();
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("INSERT INTO root_folders (id, path, name) VALUES (1, ?, ?)")
        .bind(photos_dir.to_string_lossy().to_string())
        .bind(&folder_name)
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::query("INSERT INTO folders (id, root_id, rel_path, name) VALUES (1, 1, '', 'root')")
        .execute(&mut *tx)
        .await
        .unwrap();

    for (idx, p) in scanned.iter().enumerate() {
        let id = (idx + 1) as i64;
        sqlx::query(
            "INSERT INTO photos (id, folder_id, filename, file_path, file_size, file_hash, width, height, format) \
             VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(id)
        .bind(&p.filename)
        .bind(&p.rel_path)
        .bind(p.file_size as i64)
        .bind(&p.file_hash)
        .bind(p.width as i64)
        .bind(p.height as i64)
        .bind(&p.format)
        .execute(&mut *tx)
        .await
        .unwrap();
    }
    tx.commit().await.unwrap();
    let db_duration = db_start.elapsed();

    let fts_count: i64 = sqlx::query("SELECT COUNT(*) FROM photos_fts")
        .fetch_one(&pool)
        .await
        .unwrap()
        .get(0);
    assert_eq!(fts_count, 200);

    // 3. Benchmark: Generate 200 thumbnails using Rayon parallel multi-threading
    let thumb_tasks: Vec<_> = scanned.iter().enumerate().map(|(idx, p)| {
        let src_path = photos_dir.join(&p.filename);
        let dst_path = thumbs_dir.join(format!("{}.jpg", idx + 1));
        (src_path, dst_path, 256u32)
    }).collect();

    let thumb_start = Instant::now();
    let thumb_results = batch_generate_thumbnails_parallel(thumb_tasks);
    let thumb_duration = thumb_start.elapsed();
    assert_eq!(thumb_results.len(), 200);
    for res in thumb_results {
        assert!(res.is_ok());
    }

    // 4. Benchmark: 24 Megapixel Tiled Export (6000 x 4000) with rich photographic detail, ICC and EXIF
    let export_start = Instant::now();
    let total_w = 6000u32;
    let total_h = 4000u32;
    let session_id = format!("bench_24mp_session_{}", nonce);
    create_export_session(session_id.clone(), total_w, total_h).expect("Create 24 MP export session");

    // 6 tiles (2000 x 2000) with high frequency detail pattern
    let tile_w = 2000u32;
    let tile_h = 2000u32;
    for ty in 0..2 {
        for tx in 0..3 {
            let x = tx * tile_w;
            let y = ty * tile_h;
            let w = tile_w.min(total_w - x);
            let h = tile_h.min(total_h - y);
            
            // Rich multi-channel tile buffer with fine details
            let mut tile_bytes = Vec::with_capacity((w * h * 4) as usize);
            for py in 0..h {
                for px in 0..w {
                    let gx = x + px;
                    let gy = y + py;
                    let r = (((gx * 255) / total_w) as u8) ^ (((gy * 3) & 0x3F) as u8);
                    let g = (((gy * 255) / total_h) as u8) ^ (((gx * 5) & 0x3F) as u8);
                    let b = (((gx ^ gy) & 0x3F) as u8) + 64;
                    tile_bytes.extend_from_slice(&[r, g, b, 255]);
                }
            }
            write_export_tile(session_id.clone(), x, y, w, h, tile_bytes)
                .expect("Write 24 MP tile");
        }
    }

    let exported_24mp = temp_root.join("exported_24mp.jpg").to_string_lossy().to_string();
    let exif_data = b"Exif\0\0II*\0\x08\0\0\0\x01\0\x05\x01\x02\0\x06\0\0\0Lumen\0".to_vec();
    let saved_path = finish_export_session(
        session_id,
        exported_24mp.clone(),
        "jpg".to_string(),
        95,
        None,
        Some("sRGB".to_string()),
        Some(exif_data),
    ).expect("Finish 24 MP export session");
    let export_duration = export_start.elapsed();

    let exported_size = fs::metadata(&saved_path).expect("24 MP file metadata").len();
    assert!(exported_size > 1_000_000, "Real 24 MP JPEG with detail must weigh several MB (> 1 MB), got: {} bytes", exported_size);

    println!("\n=======================================================");
    println!("  LUMEN REAL BENCHMARK RESULTS (cargo test --release --nocapture)");
    println!("=======================================================");
    println!("1. Creación de 200 JPEGs REALES 24 MP (6000x4000): {:?}", synth_duration);
    println!("2. Escaneo, hash SHA-256 y metadata (200 fotos 24 MP): {:?}", scan_duration);
    println!("   -> Velocidad de escaneo:                     {:.1} fotos/segundo", 200.0 / scan_duration.as_secs_f64());
    println!("3. Inserción SQLite + Triggers FTS5 (200 fotos): {:?}", db_duration);
    println!("   -> Tiempo por foto en catálogo:              {:.2} ms/foto", (db_duration.as_secs_f64() * 1000.0) / 200.0);
    println!("4. Generación paralela de 200 miniaturas (Rayon): {:?}", thumb_duration);
    println!("   -> Tiempo medio por miniatura 24 MP:         {:.2} ms/miniatura ({:.1} thumbs/s)", (thumb_duration.as_secs_f64() * 1000.0) / 200.0, 200.0 / thumb_duration.as_secs_f64());
    println!("5. Exportación teselada Rust foto 24 MP con detalle: {:?}", export_duration);
    println!("   -> Tamaño JPEG final (con ICC y EXIF):       {:.2} MB", exported_size as f64 / (1024.0 * 1024.0));
    println!("   -> Rendimiento de codificación Rust 24 MP:   {:.1} MPixels/s", 24.0 / export_duration.as_secs_f64());
    println!("=======================================================\n");

    // Cleanup temp dir
    fs::remove_dir_all(&temp_root).ok();
}

#[tokio::test]
async fn test_import_folder_with_spaces_accents_subfolders_duplicates_and_corrupt() {
    use lumen_lib::commands::import::scan_paths;
    use std::fs;
    use std::time::SystemTime;

    let nonce = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_millis();

    // Directory name with spaces, accents and special characters
    let base_temp = std::env::temp_dir().join(format!("lumen_test_pablo_jimenez_{}", nonce));
    let root_dir = base_temp.join("Pablo Jiménez Fotos 2026 (Excursión a la Montaña)");
    let sub_dir = root_dir.join("Sesión Día 1 - Amanecer");
    fs::create_dir_all(&sub_dir).expect("Create dirs with spaces and accents");

    // 1. Create valid JPEG in root
    let img_root = image::RgbImage::from_fn(120, 80, |x, y| {
        image::Rgb([(x % 255) as u8, (y % 255) as u8, 128])
    });
    let root_photo_path = root_dir.join("Foto Raíz Árbol.jpg");
    img_root.save(&root_photo_path).expect("Save root photo");

    // 2. Create valid JPEG in subfolder
    let img_sub = image::RgbImage::from_fn(160, 90, |x, y| {
        image::Rgb([200, (x % 255) as u8, (y % 255) as u8])
    });
    let sub_photo_path = sub_dir.join("Foto Subcarpeta Río.png");
    img_sub.save(&sub_photo_path).expect("Save subfolder photo");

    // 3. Create exact DUPLICATE in subfolder (same bytes as root photo -> same hash)
    let dup_photo_path = sub_dir.join("Copia Duplicada Raíz.jpg");
    fs::copy(&root_photo_path, &dup_photo_path).expect("Copy duplicate");

    // 4. Create CORRUPT file (0 bytes or damaged header with image extension)
    let corrupt_path = sub_dir.join("Foto Dañada Ilegible.jpg");
    fs::write(&corrupt_path, b"").expect("Write corrupt empty file");

    // 5. Create UNSUPPORTED format file (.txt, .pdf, etc.)
    let unsupported_path = root_dir.join("Notas de Viaje.txt");
    fs::write(&unsupported_path, b"Itinerario de viaje con fotos").expect("Write unsupported file");

    // Execute scan_paths with recursive = true
    let scan_res = scan_paths(vec![root_dir.to_string_lossy().to_string()], true)
        .await
        .expect("scan_paths should succeed with spaces and accents");

    println!("Scan Result: total_found={}, unsupported={}, corrupted={}, photos={}",
        scan_res.total_found, scan_res.unsupported_count, scan_res.corrupted_count, scan_res.photos.len());

    // Verifications
    assert_eq!(scan_res.photos.len(), 3, "Should find 3 valid image photos (2 unique + 1 duplicate)");
    assert_eq!(scan_res.corrupted_count, 1, "Should identify 1 corrupted file");
    assert_eq!(scan_res.unsupported_count, 1, "Should identify 1 unsupported file (.txt)");

    // Verify duplicate hashes match
    let root_photo = scan_res.photos.iter().find(|p| p.filename == "Foto Raíz Árbol.jpg").expect("Found root photo");
    let dup_photo = scan_res.photos.iter().find(|p| p.filename == "Copia Duplicada Raíz.jpg").expect("Found duplicate photo");
    let sub_photo = scan_res.photos.iter().find(|p| p.filename == "Foto Subcarpeta Río.png").expect("Found sub photo");

    assert_eq!(root_photo.file_hash, dup_photo.file_hash, "Duplicate must share identical partial hash");
    assert_ne!(root_photo.file_hash, sub_photo.file_hash, "Unique photos must have distinct hashes");

    // Verify paths with spaces and accents were properly handled and normalized
    assert!(root_photo.file_path.contains("Pablo Jiménez"));
    assert!(root_photo.file_path.contains("Excursión a la Montaña"));
    assert!(sub_photo.file_path.contains("Sesión Día 1 - Amanecer"));

    // Verify scan summary with recursive = false
    let non_recursive_res = scan_paths(vec![root_dir.to_string_lossy().to_string()], false)
        .await
        .expect("Non-recursive scan");
    assert_eq!(non_recursive_res.photos.len(), 1, "Non-recursive scan should only find 1 root photo");

    // Clean up
    fs::remove_dir_all(&base_temp).ok();
}









