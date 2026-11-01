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
- [x] Importación desde el ordenador (REAL):
  - [x] Selector nativo de carpetas y archivos con filtros (Imágenes, RAW, Todos)
  - [x] Detección de unidades extraíbles / Tarjetas SD (Win32 GetLogicalDrives/GetDriveTypeW)
  - [x] Carpetas recientes (últimas 10 en localStorage)
  - [x] Arrastrar y soltar con Tauri onDragDropEvent y overlay visual
  - [x] Pegar rutas (Ctrl+V) y atajo global Ctrl+Shift+I
  - [x] Diálogo con modos Copiar, Mover, Añadir, escaneo previo, hash parcial y omisión de duplicados
  - [x] Rejilla de miniaturas interactiva con badges de formato y RAW embebido
  - [x] Opciones: presets al importar, palabras clave, renombrado con plantilla
  - [x] Barra de progreso con cancelar y resumen final ("Importadas X, omitidas Y, con error Z")
  - [x] Rutas de Windows con espacios y acentos verificadas en test automático
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
- [x] Tiled offscreen export: 1024–2048 px tiles with halo margins (REAL, verificado en tiledExportSeam.test.ts)
- [x] Binary pixel transfer to Rust (no JSON) (REAL)
- [x] Rust encoder: JPEG, PNG, TIFF, WebP (REAL, crate image)
- [x] ICC embed (sRGB, Display P3, AdobeRGB) (REAL, mediante img-parts verificado en test_export_jpeg_with_icc_profile_and_exif_reread)
- [x] Output sharpening (screen / print) (REAL)
- [x] EXIF/IPTC pass-through and strip (REAL, inyección de metadatos mediante img-parts)
- [ ] Watermark (text + image) — PARCIAL (renderizado de texto en Rust; falta marca gráfica PNG con canal alfa y arrastre libre)
- [x] Filename templates ({date}, {name}, {seq}…) (REAL)
- [x] Background export queue with progress (REAL)

## Phase 5 — RAW
- [x] Rust RAW decode (rawloader sin FFI) a RGB 16 bits para .CR2, .NEF, .ARW, .DNG (REAL, verificado en test_develop_real_raw_camera_pipeline)
- [x] Embedded JPEG preview extraction (REAL)
- [x] Demosaic (bilinear) (REAL)
- [x] Camera colour profiles & colour matrix (REAL, matriz xyz_to_cam y conversión a sRGB D65)
- [x] WB multipliers from RAW metadata (REAL, lectura de wb_coeffs relativos a canal verde)

## Phase 6 — Advanced Develop
- [x] Spatial passes: clarity, texture, dehaze, luminance/color NR (REAL, FBOs ping-pong RGBA16F)
- [x] Whites / Blacks sliders (added to uber-shader) (REAL)
- [x] Parametric tone curve (shadow/dark/light/highlight regions) (REAL)
- [x] Per-channel curves (R, G, B) (REAL)
- [x] Colour grading: 3 wheels + blending + balance (REAL)
- [x] Detail panel: sharpen amount/radius/detail/masking, NR (REAL)
- [x] Lens corrections (lensfun) (REAL, parser XML empaquetado, coeficientes poly3/poly5 y shader de distorsión verificado en test_lensfun_real_lens_pixel_displacement)
- [x] Chromatic aberration removal (REAL)
- [x] Upright / perspective transform (REAL)
- [x] Post-crop vignette (midpoint, roundness, feather) (REAL)
- [x] Grain with size + roughness (REAL)
- [x] Calibration tab, profile browser (REAL)
- [x] Crop guides: thirds, golden spiral, diagonal, triangle, grid (REAL)
- [ ] Spot removal: clone + heal — PARCIAL (pines con radio y difuminado interactivo; falta solver Poisson / Seamless Cloning)
- [x] Red eye removal (REAL)
- [x] Brush mask: flow, density, auto-erase → R16F texture (REAL)
- [x] Luminance range mask (shader-driven) (REAL)
- [x] Colour range mask (shader-driven) (REAL)
- [x] Mask combine / subtract / intersect (CPU composition) (REAL)
- [x] Multiple masks per photo with independent adjustments (REAL)
- [x] Before/after 4 modes (REAL)
- [ ] Soft proofing — PARCIAL (simulación en canvas; falta enlace LittleCMS 2 para perfiles .icc de papel/impresora)

## Phase 7 — Extra Modules
- [ ] Map (GPS) — PARCIAL (pines, zoom y proyección Mercator listos; falta proveedor de teselas en directo con API Key)
- [x] Book (REAL, diseñador interactivo y exportador PDF nativo con printpdf verificado en test_pdf_photobook_and_web_gallery_export)
- [x] Slideshow (REAL, reproductor con transiciones Ken Burns y pantalla completa funcionando)
- [ ] Print — PARCIAL (maquetación a 300 ppp y window.print(); falta spooler nativo directo)
- [x] Web (REAL, exportación física a disco con paquete completo index.html, style.css y miniaturas verificado en test_pdf_photobook_and_web_gallery_export)
- [ ] Tethered capture — STUB (UI con diálogo informativo; falta driver USB PTP/MTP físico)
- [ ] Publish services — STUB (panel y colas listos; falta OAuth2 y endpoints REST reales para Flickr/Adobe Stock)

## Deferred
- [ ] AI masks (MobileSAM / SAM2 via ONNX) — architecture ready
- [ ] AI upscale (Real-ESRGAN via ONNX) — architecture ready
- [ ] AI denoise — architecture ready
- [ ] XMP sidecar read/write
- [ ] HDR merge, panorama stitch, batch merge
- [ ] Auto-stack, painter, auto-sync, batch rename
- [ ] IPTC editor, face detection

