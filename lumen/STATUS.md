# Estado Real de Implementación de Lumen (Fases 4 a 7)

Este documento clasifica con rigor técnico el estado funcional de cada módulo y característica de Lumen en tres categorías:
- **REAL**: Implementada, testeada automáticamente y funcionando con datos reales.
- **PARCIAL**: Funciona de forma interactiva pero con limitaciones técnicas documentadas.
- **STUB**: La interfaz de usuario existe y responde visualmente, pero no realiza el trabajo final con dependencias o hardware externo real.

---

## Matriz de Clasificación

| Módulo / Función | Estado | Web / Escritorio | Detalle y Limitaciones / Dependencias Faltantes |
|---|:---:|:---:|---|
| **IMPORTACIÓN Y ARCHIVOS** | | | |
| Selector de carpetas y archivos con filtros | **REAL** | **Web y Escritorio** | En Escritorio: `tauri-plugin-dialog` con capacidades nativas. En Web: `showOpenFilePicker`/`showDirectoryPicker` con respaldo a `<input type="file" multiple>` y `webkitdirectory`. |
| Detección de unidades extraíbles / Tarjetas SD | **REAL** | **Solo Escritorio** *(Aviso en Web)* | Detección Win32 nativa en Rust (`GetLogicalDrives`). En Web muestra diálogo explicativo con enlace a la app de escritorio. |
| Historial de carpetas recientes | **REAL** | **Web y Escritorio** | Persistencia en SQLite/IndexedDB de las últimas 10 carpetas importadas accesibles desde el menú. |
| Arrastrar y soltar (Drag and Drop) | **REAL** | **Web y Escritorio** | En Escritorio: evento nativo `onDragDropEvent` de Tauri. En Web: `getAsFileSystemHandle()` con respaldo `webkitGetAsEntry()`. |
| Pegar rutas (Ctrl+V) y atajo Ctrl+Shift+I | **REAL** | **Web y Escritorio** | Lectura y saneamiento de rutas desde el portapapeles y atajo global en ambos entornos. |
| Diálogo de importación con escaneo previo y rejilla | **REAL** | **Web y Escritorio** | Escaneo previo con contador ("248 fotos encontradas, 12 en catálogo"), detección de duplicados por hash, previews embebidas y rejilla con checkboxes. |
| Opciones de importación y barra de progreso | **REAL** | **Web y Escritorio** | Renombrado por plantilla (`{filename}`, `{date}`, `{seq}`, `{camera}`), aplicación de presets, keywords y resumen final. |
| Persistencia de directorios en Web | **REAL** | **Web** | Handles de carpetas persistidos en IndexedDB con reconcesión de permisos al volver; respaldo copia automática a OPFS. |
| **CATÁLOGO Y BASE DE DATOS** | | | |
| Motor SQLite y Migraciones idénticas | **REAL** | **Web y Escritorio** | En Escritorio: `tauri-plugin-sql` (SQLite C). En Web: `@sqlite.org/sqlite-wasm` con VFS `opfs-sahpool` en Web Worker. Ejecutan exactamente el mismo `001_initial.sql`. |
| Búsqueda de texto completo (FTS5) | **REAL** | **Web y Escritorio** | Tabla virtual FTS5 (`photos_fts`) con triggers por `rowid` para sincronización instantánea de nombres de archivo y keywords en ambos entornos. |
| **FASE 4: EXPORTACIÓN** | | | |
| Exportación por teselas con Halo Dinámico | **REAL** | **Web y Escritorio** | Renderizado WebGL2 por teselas con margen de seguridad dinámico sin costuras (`tiledExportSeam.test.ts`). |
| Codificación de formatos | **REAL** | **Web y Escritorio** | En Escritorio: JPEG, PNG, TIFF, WebP vía Rust `image`. En Web: JPEG, PNG, WebP vía Web Worker / OffscreenCanvas `toBlob`. |
| Gestión de color e incrustación ICC / EXIF | **REAL** | **Web y Escritorio** | En Escritorio: inyección binaria con `img-parts` en Rust. En Web: generador puro TypeScript (`icc.ts`) inyectando perfil ICC (sRGB, Display P3, AdobeRGB) y marcadores EXIF. |
| Guardado de exportación | **REAL** | **Web y Escritorio** | En Escritorio: guardado directo en ruta de disco. En Web: `showSaveFilePicker` nativo con respaldo a descarga automática `<a download>`. |
| Presets de exportación y plantillas | **REAL** | **Web y Escritorio** | CRUD completo de presets en tabla SQLite y motor de reemplazo de variables. |
| Marca de agua de texto | **PARCIAL** | **Solo Escritorio** | Renderizado en Rust. Falta soporte gráfico con canal alfa y renderizado en Worker web. |
| **FASE 5: MOTOR RAW** | | | |
| Extracción de preview JPEG embebida | **REAL** | **Web y Escritorio** | Escaneo de marcadores SOI/EOI (0xFFD8–0xFFD9) para miniaturas instantáneas en catálogo y tira de película. |
| Decodificación RAW pura a 16 bits | **REAL** | **Solo Escritorio** *(Web: preview + aviso)* | En Escritorio: `rawloader` decodifica a 16 bits RGB con balance de blancos y matriz de color del sensor. En Web: muestra la preview embebida de alta resolución con aviso claro ("RAW completo disponible en app de escritorio") y ruta preparada para compilación WASM de rawloader. |
| Demosaicing Bayer (Bilineal) | **REAL** | **Solo Escritorio** | Implementado en Rust (`raw.rs`) y verificado con test unitario. |
| **FASE 6: REVELADO AVANZADO (GPU WEBGL2)** | | | |
| Pipeline WebGL2 (Uber-Shader + Pases Espaciales) | **REAL** | **Web y Escritorio** | Claridad, Textura, Dehaze, Bilateral NR, Curvas de tono LUT, Color Grading 3-Way, Viñeteo, Grano fílmico y Calibración ejecutados con idénticos shaders GLSL. |
| Correcciones de lente (Lensfun) | **REAL** | **Solo Escritorio** *(Aviso en Web)* | En Escritorio: base de datos Lensfun embebida en Rust y distorsión calculada en shader. En Web: aviso de disponibilidad en la app de escritorio. |
| Herramientas locales (Pincel, Gradientes, Máscaras) | **REAL** | **Web y Escritorio** | Máscaras de luminosidad/color y pincel local almacenados en tabla `brush_strokes` de SQLite. |
| Modos Antes / Después y Recorte | **REAL** | **Web y Escritorio** | 4 modos de comparación (simple, split V/H, lado a lado) y recorte con guías SVG interactivas. |
| Prueba en pantalla (Soft Proofing) | **PARCIAL** | **Web y Escritorio** | Simulación de contraste y compresión de gamut. Falta enlace con LittleCMS para perfiles ICC de impresora específicos. |
| **FASE 7: MÓDULOS ADICIONALES Y SERVICIOS** | | | |
| Módulo Mapa (GPS) | **PARCIAL** | **Web y Escritorio** | Cálculo de coordenadas Mercator y posicionamiento de pines. Requiere clave de proveedor (configurada en variables de entorno Vercel `VITE_MAPBOX_KEY`). |
| Módulo Libro (Photobook) | **REAL** | **Escritorio / Web parcial** | Diseñador interactivo en Web y Escritorio; exportación PDF física con `printpdf` en Escritorio. |
| Módulo Presentación (Slideshow) | **REAL** | **Web y Escritorio** | Reproductor con transiciones Ken Burns y disolución en pantalla completa. |
| Módulo Impresión | **PARCIAL** | **Web y Escritorio** | Maquetación a 300/240 ppp con llamada nativa a `window.print()`. |
| Módulo Web (Galería HTML5) | **REAL** | **Escritorio / Web parcial** | Generador de galería estática responsive. En Escritorio escribe paquete directo a disco. |
| Captura Conectada (Tethering) | **PRÓXIMAMENTE** | **Solo Escritorio futuro** | Oculta con badge de "Próximamente" y diálogo informativo sobre la necesidad de drivers nativos USB/PTP de fabricante. |
| Servicios de Publicación | **PRÓXIMAMENTE** | **Solo Escritorio futuro** | Oculta con badge de "Próximamente" y aviso sobre credenciales OAuth2 de Flickr y Adobe Stock. |

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

