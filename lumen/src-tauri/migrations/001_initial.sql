-- Lumen — Migration 001: Initial Schema
-- processVersion lives inside the settings JSON blob, not as a column.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

------------------------------------------------------------------------
-- Schema version tracking
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_version (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO schema_version (version) VALUES (1);

------------------------------------------------------------------------
-- Root folders (volume mounts / import roots)
-- photos.file_path is relative to their root_folder.path.
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS root_folders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  path        TEXT    NOT NULL UNIQUE COLLATE NOCASE, -- absolute normalized with forward slashes
  volume      TEXT    NOT NULL DEFAULT '',            -- volume label for removable media
  name        TEXT    NOT NULL,                       -- display name
  is_missing  INTEGER NOT NULL DEFAULT 0,            -- 1 when volume not mounted
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

------------------------------------------------------------------------
-- Folder tree (mirrors on-disk directory tree under a root)
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  root_id     INTEGER NOT NULL REFERENCES root_folders(id) ON DELETE CASCADE,
  parent_id   INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  rel_path    TEXT    NOT NULL COLLATE NOCASE,        -- relative to root, e.g. "2024/January"
  name        TEXT    NOT NULL,
  expanded    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(root_id, rel_path COLLATE NOCASE)
);
CREATE INDEX IF NOT EXISTS idx_folders_root   ON folders(root_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);

------------------------------------------------------------------------
-- Photos
-- Virtual copies: master_id → photos.id of the original.
--   Original has master_id = NULL.
--   Each row (original or copy) owns its own edits, history, ratings, etc.
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS photos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id       INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  master_id       INTEGER REFERENCES photos(id) ON DELETE CASCADE,  -- NULL = original

  -- File (path relative to root_folder)
  filename        TEXT    NOT NULL COLLATE NOCASE,
  file_path       TEXT    NOT NULL COLLATE NOCASE,
  file_size       INTEGER,
  file_hash       TEXT,                         -- partial: SHA-256(size + first 1 MB + last 1 MB)
  file_hash_full  TEXT,                         -- full SHA-256, on demand
  file_mtime      TEXT,                         -- ISO 8601

  -- Dimensions & format
  width           INTEGER,
  height          INTEGER,
  orientation     INTEGER NOT NULL DEFAULT 1,   -- EXIF orientation 1-8
  format          TEXT,                         -- jpeg, png, tiff, raw …
  color_space     TEXT    NOT NULL DEFAULT 'srgb',

  -- EXIF
  date_taken      TEXT,
  camera_make     TEXT,
  camera_model    TEXT,
  lens            TEXT,
  focal_length    REAL,
  aperture        REAL,
  shutter_speed   TEXT,
  iso             INTEGER,
  gps_lat         REAL,
  gps_lng         REAL,

  -- Organisation
  rating          INTEGER NOT NULL DEFAULT 0 CHECK(rating BETWEEN 0 AND 5),
  flag            TEXT    NOT NULL DEFAULT 'none' CHECK(flag IN ('none','pick','reject')),
  color_label     TEXT    NOT NULL DEFAULT 'none'
                    CHECK(color_label IN ('none','red','yellow','green','blue','purple')),
  stack_id        INTEGER,
  stack_position  INTEGER,

  -- Status
  is_missing      INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  imported_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_unique_file
  ON photos(folder_id, filename COLLATE NOCASE) WHERE master_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_photos_folder   ON photos(folder_id);
CREATE INDEX IF NOT EXISTS idx_photos_master   ON photos(master_id);
CREATE INDEX IF NOT EXISTS idx_photos_date     ON photos(date_taken);
CREATE INDEX IF NOT EXISTS idx_photos_rating   ON photos(rating);
CREATE INDEX IF NOT EXISTS idx_photos_flag     ON photos(flag);
CREATE INDEX IF NOT EXISTS idx_photos_color    ON photos(color_label);
CREATE INDEX IF NOT EXISTS idx_photos_camera   ON photos(camera_make, camera_model);
CREATE INDEX IF NOT EXISTS idx_photos_lens     ON photos(lens);
CREATE INDEX IF NOT EXISTS idx_photos_hash     ON photos(file_hash);
CREATE INDEX IF NOT EXISTS idx_photos_missing  ON photos(is_missing);

------------------------------------------------------------------------
-- Edits — exactly ONE row per photo (including virtual copies).
-- "settings" is a single JSON blob:
--   { "processVersion": 1,
--     "exposure": 0, "contrast": 0, …,
--     "hsl": [{"hue":0,"saturation":0,"luminance":0} × 8],
--     "curvePoints": [[0,0],[1,1]],
--     "geometry": {"rotation":0,"flipH":false,"flipV":false,
--                  "straighten":0,"cropRatio":0},
--     "masks": [],
--     "overlays": [] }
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS edits (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  photo_id    INTEGER NOT NULL UNIQUE REFERENCES photos(id) ON DELETE CASCADE,
  settings    TEXT    NOT NULL DEFAULT '{"processVersion":1}',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

------------------------------------------------------------------------
-- Brush strokes storage (kept outside history step JSON snapshots)
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brush_strokes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  photo_id    INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  stroke_id   TEXT    NOT NULL,
  points_data BLOB    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(photo_id, stroke_id)
);
CREATE INDEX IF NOT EXISTS idx_brush_strokes_photo ON brush_strokes(photo_id);

------------------------------------------------------------------------
-- History steps (undo/redo, max 100 per photo, max 50 MB total per photo)
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS history_steps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  photo_id    INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  step_index  INTEGER NOT NULL,
  label       TEXT    NOT NULL,                 -- e.g. "Exposure +0.5"
  settings    TEXT    NOT NULL,                 -- full settings JSON snapshot (strokes referenced by ID)
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_history_photo ON history_steps(photo_id, step_index);

-- Cap history at 100 steps and 50MB per photo
CREATE TRIGGER IF NOT EXISTS trg_history_cap
AFTER INSERT ON history_steps
BEGIN
  -- 1. Cap at 100 steps: delete steps beyond the 100 most recent
  DELETE FROM history_steps
  WHERE photo_id = NEW.photo_id
    AND id NOT IN (
      SELECT id FROM history_steps
      WHERE photo_id = NEW.photo_id
      ORDER BY step_index DESC
      LIMIT 100
    );

  -- 2. Cap at 50 MB total history JSON size per photo (52428800 bytes)
  -- Uses cumulative sum starting from most recent step DESC to delete only steps exceeding 50 MB
  DELETE FROM history_steps
  WHERE photo_id = NEW.photo_id
    AND id IN (
      SELECT id FROM (
        SELECT id,
               SUM(length(settings)) OVER (
                 PARTITION BY photo_id
                 ORDER BY step_index DESC
                 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
               ) AS cumulative_bytes
        FROM history_steps
        WHERE photo_id = NEW.photo_id
      )
      WHERE cumulative_bytes > 52428800
    );
END;

------------------------------------------------------------------------
-- Snapshots (named save points)
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  photo_id    INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  settings    TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_snapshots_photo ON snapshots(photo_id);

------------------------------------------------------------------------
-- Collections (manual)
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  parent_id   INTEGER REFERENCES collections(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_photos (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  photo_id      INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, photo_id)
);
CREATE INDEX IF NOT EXISTS idx_collphotos_photo ON collection_photos(photo_id);

------------------------------------------------------------------------
-- Smart collections (rule-based)
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS smart_collections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  rules       TEXT    NOT NULL DEFAULT '{}',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

------------------------------------------------------------------------
-- Keywords (hierarchical)
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS keywords (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id   INTEGER REFERENCES keywords(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_keywords_name ON keywords(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_keywords_unique
  ON keywords(COALESCE(parent_id, 0), name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS photo_keywords (
  photo_id    INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  keyword_id  INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  PRIMARY KEY (photo_id, keyword_id)
);
CREATE INDEX IF NOT EXISTS idx_photo_keywords_kw ON photo_keywords(keyword_id);

------------------------------------------------------------------------
-- Presets (develop)
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS presets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  group_name  TEXT    NOT NULL DEFAULT 'User Presets',
  settings    TEXT    NOT NULL DEFAULT '{}',     -- partial settings JSON
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

------------------------------------------------------------------------
-- Export presets
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS export_presets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  settings    TEXT    NOT NULL DEFAULT '{}',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

------------------------------------------------------------------------
-- Import log (audit)
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source_path TEXT    NOT NULL,
  mode        TEXT    NOT NULL CHECK(mode IN ('add','copy','move')),
  photo_count INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

------------------------------------------------------------------------
-- Preview cache metadata
-- edit_hash = SHA-256 of the settings JSON that generated the preview.
-- Regenerate when the hash no longer matches.
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS previews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  photo_id    INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  size        TEXT    NOT NULL CHECK(size IN ('thumb','standard','full')),
  cache_path  TEXT    NOT NULL,
  width       INTEGER,
  height      INTEGER,
  edit_hash   TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(photo_id, size)
);
CREATE INDEX IF NOT EXISTS idx_previews_photo ON previews(photo_id);

------------------------------------------------------------------------
-- FTS5: full-text search on filename and keywords
------------------------------------------------------------------------
CREATE VIRTUAL TABLE IF NOT EXISTS photos_fts USING fts5(
  filename,
  keywords,
  tokenize='unicode61 remove_diacritics 2'
);

-- Trigger: on photo INSERT → insert into FTS
CREATE TRIGGER IF NOT EXISTS trg_photos_fts_insert
AFTER INSERT ON photos
BEGIN
  INSERT INTO photos_fts (rowid, filename, keywords)
  VALUES (
    NEW.id,
    NEW.filename,
    ''
  );
END;

-- Trigger: on photo DELETE → remove from FTS by rowid
CREATE TRIGGER IF NOT EXISTS trg_photos_fts_delete
AFTER DELETE ON photos
BEGIN
  DELETE FROM photos_fts WHERE rowid = OLD.id;
END;

-- Trigger: on photo UPDATE of filename → update filename in FTS by rowid
CREATE TRIGGER IF NOT EXISTS trg_photos_fts_update
AFTER UPDATE OF filename ON photos
BEGIN
  UPDATE photos_fts
  SET filename = NEW.filename
  WHERE rowid = NEW.id;
END;

-- Trigger: on keyword assignment → update keywords in FTS for that photo
CREATE TRIGGER IF NOT EXISTS trg_photo_keywords_insert
AFTER INSERT ON photo_keywords
BEGIN
  UPDATE photos_fts
  SET keywords = COALESCE((
    SELECT group_concat(k.name, ' ')
    FROM photo_keywords pk
    JOIN keywords k ON k.id = pk.keyword_id
    WHERE pk.photo_id = NEW.photo_id
  ), '')
  WHERE rowid = NEW.photo_id;
END;

-- Trigger: on keyword removal → update keywords in FTS for that photo
CREATE TRIGGER IF NOT EXISTS trg_photo_keywords_delete
AFTER DELETE ON photo_keywords
BEGIN
  UPDATE photos_fts
  SET keywords = COALESCE((
    SELECT group_concat(k.name, ' ')
    FROM photo_keywords pk
    JOIN keywords k ON k.id = pk.keyword_id
    WHERE pk.photo_id = OLD.photo_id
  ), '')
  WHERE rowid = OLD.photo_id;
END;

-- Trigger: on keyword rename → recalculate keywords of all photos that have that keyword
CREATE TRIGGER IF NOT EXISTS trg_keywords_update
AFTER UPDATE OF name ON keywords
BEGIN
  UPDATE photos_fts
  SET keywords = COALESCE((
    SELECT group_concat(k.name, ' ')
    FROM photo_keywords pk
    JOIN keywords k ON k.id = pk.keyword_id
    WHERE pk.photo_id = photos_fts.rowid
  ), '')
  WHERE rowid IN (SELECT photo_id FROM photo_keywords WHERE keyword_id = NEW.id);
END;
