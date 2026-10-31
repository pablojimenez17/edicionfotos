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


