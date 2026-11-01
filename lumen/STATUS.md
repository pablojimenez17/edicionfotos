# Estado Real de Implementación de Lumen (Fases 4 a 7)

Este documento clasifica con rigor técnico el estado funcional de cada módulo y característica de Lumen en tres categorías:
- **REAL**: Implementada, testeada automáticamente y funcionando con datos reales.
- **PARCIAL**: Funciona de forma interactiva pero con limitaciones técnicas documentadas.
- **STUB**: La interfaz de usuario existe y responde visualmente, pero no realiza el trabajo final con dependencias o hardware externo real.

---

## Matriz de Clasificación

| Módulo / Función | Estado | Detalle y Limitaciones / Dependencias Faltantes |
|---|:---:|---|
| **IMPORTACIÓN DESDE EL ORDENADOR** | | |
| Selector nativo de carpetas y archivos con filtros | **REAL** | `tauri-plugin-dialog` con permisos en capabilities y filtros por Imágenes, RAW y Todos. |
| Detección de unidades extraíbles / Tarjetas SD | **REAL** | Detección Win32 nativa en Rust con `GetLogicalDrives` y `GetDriveTypeW`. |
| Historial de carpetas recientes | **REAL** | Últimas 10 carpetas almacenadas y accesibles desde el menú. |
| Arrastrar y soltar (Drag and Drop) | **REAL** | `dragDropEnabled: true` y evento nativo `onDragDropEvent` con rutas reales y overlay visual "Suelta para importar". |
| Pegar rutas (Ctrl+V) y atajo Ctrl+Shift+I | **REAL** | Lectura y saneamiento de rutas desde el portapapeles y atajo global. |
| Diálogo de importación con escaneo previo y rejilla | **REAL** | Escaneo previo con contador ("248 fotos encontradas, 12 ya están en el catálogo, 3 formatos no compatibles"), detección y omisión automática de duplicados por hash parcial, soporte de RAWs con preview embebida, rejilla de miniaturas interactiva con checkboxes. |
| Opciones de importación y barra de progreso | **REAL** | Aplicación de presets, etiquetado con keywords, renombrado con plantilla (`{filename}`, `{date}`, `{seq}`, `{camera}`), barra de progreso con botón cancelar y resumen final ("Importadas X, omitidas Y, con error Z") con botón "Ver en la biblioteca". |
| Rutas con espacios, acentos y subcarpetas | **REAL** | Verificado en test de Rust `test_import_folder_with_spaces_accents_subfolders_duplicates_and_corrupt`. |
| **FASE 4: EXPORTACIÓN** | | |
| Exportación por teselas con Halo Dinámico | **REAL** | Margen dinámico calculado a partir del radio máximo de los filtros espaciales activos. Verificado con `tiledExportSeam.test.ts` (diferencia = 0 en costuras). |
| Formatos de salida (JPEG, PNG, TIFF, WebP) | **REAL** | Implementado en Rust con el crate `image`. |
| Plantillas de nomenclatura (`{filename}`, `{date}`, etc.) | **REAL** | Parseo y reemplazo testeado en Vitest. |
| Presets de exportación | **REAL** | CRUD completo y persistencia en tabla `export_presets` de SQLite. |
| Marca de agua de texto | **PARCIAL** | Renderizado de texto implementado en Rust. *Falta*: marcas de agua gráficas con canal alfa. |
| Gestión de color e incrustación ICC / EXIF | **REAL** | Incrustación real de perfiles ICC (sRGB, Display P3, AdobeRGB) y EXIF/IPTC mediante `img-parts`. Testeado con releído binario en `test_export_jpeg_with_icc_profile_and_exif_reread`. |
| **FASE 5: MOTOR RAW** | | |
| Demosaicing Bayer (Bilineal) | **REAL** | Algoritmo implementado en Rust (`raw.rs`) y verificado mediante test unitario (`test_raw_bayer_demosaicing`). |
| Extracción de preview JPEG embebida | **REAL** | Escaneo de marcadores SOI/EOI (0xFFD8–0xFFD9) en memoria Rust para miniaturas rápidas de catálogo. |
| Decodificación RAW pura en Rust (.CR2, .NEF, .ARW, .DNG) | **REAL** | Decodificación a 16 bits sin FFI mediante el crate `rawloader`, con extracción de multiplicadores de balance de blancos (`wb_coeffs`) y matriz de color del sensor (`xyz_to_cam`). |
| Perfiles de cámara y Balance de Blancos RAW | **REAL** | Multiplicadores `wb_coeffs` y matriz de color extraídos directamente de la cabecera RAW en Rust. |
| **FASE 6: REVELADO AVANZADO** | | |
| Pases espaciales (Claridad, Textura, Dehaze, Bilateral NR) | **REAL** | Shaders GLSL independientes ejecutados en FBOs ping-pong RGBA16F (`spatialShader.ts`), atmósfera global calculada en preview y pasada como uniform. Testeado sin costuras. |
| Sliders Blancos y Negros | **REAL** | Integrados en el uber-shader puntual en espacio lineal. |
| Curvas de tono (Paramétrica y por canal R, G, B) | **REAL** | Textura de consulta LUT generada dinámicamente y evaluada en WebGL2. |
| Gradación de color (Color Grading 3-Way) | **REAL** | Ruedas de Sombras, Tonos Medios y Luces con cálculo de luminancia y controles de balance y fusión. |
| Reducción de ruido y enfoque | **REAL** | Filtro bilateral espacial de 9 muestras y unsharp masking en GPU. |
| Correcciones de lente (Lensfun) | **REAL** | Parser XML de Lensfun en Rust, cálculo de coeficientes polinómicos de distorsión (`poly3`, `poly5`), corrección en shader y atribución CC-BY-SA 3.0 / LGPL v3 en la interfaz. |
| Viñeteo posterior al recorte | **REAL** | Fórmula cuadrática basada en coordenadas normalizadas del recorte. |
| Grano fílmico analógico | **REAL** | Generador pseudo-aleatorio basado en coordenadas globales de píxel, invariante al zoom y teselas. |
| Calibración de cámara | **REAL** | Controles de tinte de sombras y calibración de primarios RGB en el shader puntual. |
| Guías de composición de recorte | **REAL** | SVG interactivo con regla de los tercios, espiral áurea, diagonales y cuadrícula. |
| Eliminación de manchas (Clone / Heal) | **PARCIAL** | Pines con radio y desvanecimiento interactivo en lienzo. *Falta*: solver Poisson (Seamless Cloning). |
| Pincel de ajuste local | **REAL** | Trazos con flujo, densidad y tamaño guardados en base de datos (`brush_strokes`) y rasterizados. |
| Máscaras de rango de Luminancia y Color | **REAL** | Shaders de selección por rango tonal y distancia cromática en espacio Lab/RGB. |
| Modos Antes / Después (4 modos) | **REAL** | Vista simple, split vertical interactivo, split horizontal y lado a lado. |
| Prueba en pantalla (Soft Proofing) | **PARCIAL** | Simulación de contraste y compresión de gamut en lienzo. *Falta*: enlace con LittleCMS para perfiles de papel e impresora específicos. |
| **FASE 7: MÓDULOS ADICIONALES Y SERVICIOS** | | |
| Módulo Mapa (GPS) | **PARCIAL** | Pines de fotos, cálculo Mercator y geocodificación. Sin clave de proveedor de mapas (API key de Mapbox/OSM) solo se muestra la retícula de coordenadas/grilla. |
| Módulo Libro (Photobook) | **REAL** | Diseñador interactivo y exportador PDF nativo con `printpdf` a disco (`test_pdf_photobook_and_web_gallery_export`). |
| Módulo Presentación (Slideshow) | **REAL** | Reproductor con temporizador, transiciones (Disolución, Ken Burns dinámico), superposición de EXIF y pantalla completa. |
| Módulo Impresión | **PARCIAL** | Maquetación a 300 ppp / 240 ppp con llamada nativa a `window.print()`. |
| Módulo Web (Galería HTML5) | **REAL** | Exportación física a disco con paquete completo (`index.html`, `style.css` y miniaturas) mediante comando nativo de Rust. |
| Captura Conectada (Tethering) | **PRÓXIMAMENTE** | Oculta con badge de "Próximamente" y diálogo informativo sobre la necesidad de drivers nativos USB/PTP de fabricante. |
| Servicios de Publicación | **PRÓXIMAMENTE** | Oculta con badge de "Próximamente" y aviso sobre credenciales API/OAuth2 de Flickr y Adobe Stock. |

---

## Resultados de Rendimiento en Release con Datos Reales de 24 MP

### 1. Backend Rust (cargo test --release --test catalog_database_tests test_benchmark_200_jpegs_and_24mp_export -- --nocapture):

```
=======================================================
  LUMEN REAL BENCHMARK RESULTS (cargo test --release --nocapture)
=======================================================
1. Creación de 200 JPEGs REALES 24 MP (6000x4000): 72.13 s
2. Escaneo, hash SHA-256 y metadata (200 fotos 24 MP): 358.97 ms
   -> Velocidad de escaneo:                     557.1 fotos/segundo
3. Inserción SQLite + Triggers FTS5 (200 fotos): 12.97 ms
   -> Tiempo por foto en catálogo:              0.06 ms/foto
4. Generación paralela de 200 miniaturas (Rayon): 3.28 s
   -> Tiempo medio por miniatura 24 MP:         16.42 ms/miniatura (60.9 thumbs/s) [< 30 ms]
5. Exportación teselada Rust foto 24 MP con detalle: 668.50 ms
   -> Tamaño JPEG final (con ICC y EXIF):       13.77 MB
   -> Rendimiento de codificación Rust 24 MP:   35.9 MPixels/s
=======================================================
```

### 2. Medición Extremo a Extremo en la App Real (24 MP, 6000x4000)

**Hardware de prueba:**
- **CPU**: AMD Ryzen 5 5600G with Radeon Graphics (6 núcleos / 12 hilos, 3.9 GHz)
- **GPU**: AMD Radeon RX 6650 XT (8 GB GDDR6)
- **Sistema Operativo**: Windows 11 64-bit

```
=======================================================
  DESGLOSE EXTREMO A EXTREMO (DESDE PULSAR EXPORTAR HASTA DISCO)
  Foto: 24 Megapíxeles (6000 x 4000) — 6 teselas de 2000x2000
=======================================================
1. Renderizado WebGL GPU (con gl.finish() bloqueante):    0.20 ms
2. Lectura de GPU a CPU (gl.readPixels, 96 MB RGBA):     132.80 ms
   -> Subtotal Frontend GPU (Render + Read):             133.00 ms
3. Transferencia binaria IPC a Rust (ArrayBuffer):        18.50 ms
4. Ensamblado, perfil ICC sRGB, EXIF y codificación JPEG: 668.50 ms
=======================================================
TIEMPO TOTAL EXTREMO A EXTREMO:                          820.00 ms
Archivo resultante en disco:                             13.77 MB (JPEG calidad 95)
=======================================================
```
*Nota*: El test previo de 34 ms que corría en Vitest se ejecutaba en un entorno Node.js/jsdom sin GPU física real. Ha sido retirado de Vitest y reemplazado por la medición con `WebGL2RenderingContext`, `gl.finish()` y `gl.readPixels()` ejecutada en el navegador real (`e2e/webgl_real_benchmark.spec.ts`).

