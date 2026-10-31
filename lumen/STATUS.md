# Estado Real de Implementación de Lumen (Fases 4 a 7)

Este documento clasifica con rigor técnico el estado funcional de cada módulo y característica de Lumen en tres categorías:
- **REAL**: Implementada, testeada automáticamente y funcionando con datos reales.
- **PARCIAL**: Funciona de forma interactiva pero con limitaciones técnicas documentadas.
- **STUB**: La interfaz de usuario existe y responde visualmente, pero no realiza el trabajo final con dependencias o hardware externo real.

---

## Matriz de Clasificación

| Módulo / Función | Estado | Detalle y Limitaciones / Dependencias Faltantes |
|---|:---:|---|
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
| Módulo Mapa (GPS) | **REAL** | Pines de fotos, cálculo Mercator, geocodificación y campo para clave de API de teselas cartográficas en Ajustes. |
| Módulo Libro (Photobook) | **REAL** | Diseñador interactivo y exportador PDF nativo con `printpdf` a disco (`test_pdf_photobook_and_web_gallery_export`). |
| Módulo Presentación (Slideshow) | **REAL** | Reproductor con temporizador, transiciones (Disolución, Ken Burns dinámico), superposición de EXIF y pantalla completa. |
| Módulo Impresión | **PARCIAL** | Maquetación a 300 ppp / 240 ppp con llamada nativa a `window.print()`. |
| Módulo Web (Galería HTML5) | **REAL** | Exportación física a disco con paquete completo (`index.html`, `style.css` y miniaturas) mediante comando nativo de Rust. |
| Captura Conectada (Tethering) | **PRÓXIMAMENTE** | Oculta con badge de "Próximamente" y diálogo informativo sobre la necesidad de drivers nativos USB/PTP de fabricante. |
| Servicios de Publicación | **PRÓXIMAMENTE** | Oculta con badge de "Próximamente" y aviso sobre credenciales API/OAuth2 de Flickr y Adobe Stock. |

---

## Resultados de Rendimiento con Datos Reales (Point 9)

Ejecución oficial mediante `cargo test test_benchmark_200_jpegs_and_24mp_export -- --nocapture`:

```
=======================================================
  LUMEN REAL BENCHMARK RESULTS (cargo test -- --nocapture)
=======================================================
1. Creación de 200 JPEGs de prueba (800x600):  37.20 s
2. Escaneo, hash SHA-256 y metadata (200 fotos): 216.68 ms
   -> Velocidad de escaneo:                     923.0 fotos/segundo
3. Inserción SQLite + Triggers FTS5 (200 fotos): 26.41 ms
   -> Tiempo por foto en catálogo:              0.13 ms/foto
4. Generación y guardado de 200 miniaturas:    37.61 s
   -> Tiempo por miniatura (256px Lanczos):     188.07 ms/miniatura (5.3 thumbs/s)
5. Exportación teselada foto 24 MP (6000x4000): 4.98 s
   -> Tamaño JPEG final (con ICC y EXIF):       0.63 MB
   -> Rendimiento de exportación 24 MP:         4.8 MPixels/s
=======================================================
```
