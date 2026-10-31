# Lumen — Roadmap

## Architecture Decisions (v2.1)

### Pipeline Design
- **Single uber-shader** for all point-wise operations (exposure, WB, highlights/shadows,
  gamma, contrast, curve, HSL, saturation, B/N, matte, masks, vignette, grain).
- **Separate passes** only for spatial operations (sharpen, blur; Phase 6: clarity,
  texture, dehaze, noise reduction) that need pixel-neighbor access.
- Pipeline order: spatial passes → uber-shader (point-wise) → screen/export FBO.
- All intermediate FBOs are RGBA16F for linear-light precision.

### Tiled Export
- Tiles of 1024–2048 px with halo margins for spatial passes (e.g., sharpen radius).
- Uber-shader receives global image coordinates so vignette and grain are
  position-correct across tiles.
- Pixel data transferred to Rust as raw binary (ArrayBuffer via IPC), not JSON.
- Rust stitches tiles, encodes (JPEG/PNG/TIFF/WebP), embeds ICC, writes to disk.

### Coordinates
- Masks and overlays stored in normalised coordinates of the **original image**,
  transformed by the current geometry before rendering.
- Brush strokes stored as normalised polylines; rasterised at tile resolution
  during export.

---

## Phase 1 — Base ✅ Completada
- [x] Tauri 2 + React 18 + TypeScript + Vite scaffold
- [x] SQLite schema (001_initial.sql) with FTS5 triggers
- [x] Rust commands: scan_folder, import_folder, generate_thumbnail
- [x] Zustand stores: catalog, UI
- [x] Frontend: folder panel, grid view, thumbnail display
- [x] 3-level preview cache metadata & loaders

## Phase 2 — Library ✅ Completada y Verificada
- [x] Rating (0-5), flags (P/X/U), color labels (6-9)
- [x] Keywords: panel con jerarquía en árbol, añadir y quitar a la selección, filtro de catálogo
- [x] Colecciones y Colección Rápida (B): crear, añadir fotos y navegar
- [x] Vistas Comparar (C) lado a lado con swap y Encuesta (N) multi-foto con descarte
- [x] Filtros por metadatos: cámara, lente, fecha y keyword en FilterBar
- [x] Diálogo de importación con modos Copiar, Mover y Añadir con escaneo previo y checkboxes
- [x] Panel de metadatos EXIF con histograma RGB en vivo
- [x] Vista Lupa (E) interactiva con zoom (Ajustar, 1:1, 2:1), paneo y HUD EXIF (tecla I)
- [x] Tira de película (Filmstrip) inferior persistente
- [x] Búsqueda instantánea FTS5 sincronizada por triggers

## Phase 3 — Develop (Essential) ✅ Completada y Verificada
- [x] Pases espaciales separados (sharpen, blur) en FBOs ping-pong RGBA16F
- [x] Uber-shader unificado v2.1: todas las operaciones puntuales en un único fragment shader
- [x] Coordenadas de imagen globales para viñeta y grano en cualquier recorte
- [x] Máscaras radiales y lineales (MaskPanel) con inversión, overlay (tecla O) y ajustes locales
      (exposición, contraste, saturación, temperatura)
- [x] Pincel y texto (overlays) en coordenadas normalizadas
- [x] Sincronización de ajustes entre fotos seleccionadas (SyncSettingsModal / Ctrl+Shift+S)
- [x] Vista previa rápida en baja resolución al arrastrar sliders (draftMode) y render completo al soltar
- [x] Tests de referencia de color: 3 imágenes de prueba y presets con salida esperada estricta
- [x] Paneles: Básico, Curva de tonos spline, HSL (8 bandas), Detalle, Efectos, Geometría, Máscaras
- [x] Histograma interactivo con advertencias de recorte (J)
- [x] Historial (100 pasos) limitado por trigger SQLite y snapshots
- [x] Copiar y pegar ajustes (Ctrl+Shift+C / Ctrl+Shift+V)
- [x] Comparativa Antes/Después (tecla \)
- [x] Ajustes preestablecidos integrados (Original, Vivo, Cálido, Frío, B/N, Vintage, Cine, Mate, Dramático)
- [x] Copias virtuales y pilas (UI)
- [x] Colecciones inteligentes (UI)
- [x] Guardar presets de usuario

## Phase 4 — Export
- [x] Tiled offscreen export: 1024–2048 px tiles with halo margins
- [x] Binary pixel transfer to Rust (no JSON)
- [x] Rust encoder: JPEG, PNG, TIFF, WebP
- [x] ICC embed (sRGB, Display P3, AdobeRGB)
- [x] Output sharpening (screen / print)
- [x] EXIF/IPTC pass-through and strip
- [x] Watermark (text + image)
- [x] Filename templates ({date}, {name}, {seq}…)
- [x] Background export queue with progress

## Phase 5 — RAW
- [x] Rust RAW decode (rawloader or LibRaw via FFI)
- [x] Embedded JPEG preview extraction
- [x] Demosaic (bilinear, AHD)
- [x] Camera colour profiles (DNG-style)
- [x] WB multipliers from RAW metadata

## Phase 6 — Advanced Develop
- [x] Spatial passes: clarity, texture, dehaze, luminance/color NR
- [x] Whites / Blacks sliders (added to uber-shader)
- [x] Parametric tone curve (shadow/dark/light/highlight regions)
- [x] Per-channel curves (R, G, B)
- [x] Colour grading: 3 wheels + blending + balance
- [x] Detail panel: sharpen amount/radius/detail/masking, NR
- [x] Lens corrections (lensfun)
- [x] Chromatic aberration removal
- [x] Upright / perspective transform
- [x] Post-crop vignette (midpoint, roundness, feather)
- [x] Grain with size + roughness
- [x] Calibration tab, profile browser
- [x] Crop guides: thirds, golden spiral, diagonal, triangle, grid
- [x] Spot removal: clone + heal
- [x] Red eye removal
- [x] Brush mask: flow, density, auto-erase → R16F texture
- [x] Luminance range mask (shader-driven)
- [x] Colour range mask (shader-driven)
- [x] Mask combine / subtract / intersect (CPU composition)
- [x] Multiple masks per photo with independent adjustments
- [x] Before/after 4 modes
- [x] Soft proofing

## Phase 7 — Extra Modules
- [x] Map (GPS), Book, Slideshow, Print, Web
- [x] Tethered capture
- [x] Publish services

## Deferred
- [ ] AI masks (MobileSAM / SAM2 via ONNX) — architecture ready
- [ ] AI upscale (Real-ESRGAN via ONNX) — architecture ready
- [ ] AI denoise — architecture ready
- [ ] XMP sidecar read/write
- [ ] HDR merge, panorama stitch, batch merge
- [ ] Auto-stack, painter, auto-sync, batch rename
- [ ] IPTC editor, face detection
