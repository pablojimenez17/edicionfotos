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
| Exportación por teselas con margen Halo | **REAL** | División en teselas de 1024–2048 px con halo de 16 px. Test automático (`tiledExportSeam.test.ts`) verifica diferencia = 0 en costuras. |
| Formatos de salida (JPEG, PNG, TIFF, WebP) | **REAL** | Implementado en Rust con el crate `image`. |
| Plantillas de nomenclatura (`{filename}`, `{date}`, etc.) | **REAL** | Parseo y reemplazo testeado en Vitest. |
| Presets de exportación | **REAL** | CRUD completo y persistencia en tabla `export_presets` de SQLite. |
| Marca de agua de texto | **PARCIAL** | Renderizado de texto implementado en Rust. *Falta*: soporte de marcas de agua gráficas (PNG con canal alfa) y posicionamiento por arrastre en lienzo. |
| Gestión de color en exportación | **PARCIAL** | Conversión RGB lineal a perfiles en shader. *Falta*: incrustación física de perfiles ICC binarios (`.icc`) en las cabeceras EXIF/APP2 de los archivos generados. |
| **FASE 5: MOTOR RAW** | | |
| Demosaicing Bayer (Bilineal) | **REAL** | Algoritmo implementado en Rust (`raw.rs`) y verificado mediante test unitario (`test_raw_bayer_demosaicing`). |
| Extracción de preview JPEG embebida | **PARCIAL** | Escaneo de marcadores SOI/EOI (0xFFD8–0xFFD9) en memoria Rust. *Falta*: extracción de previews de formatos RAW propietarios complejos que no usan encapsulación estándar. |
| Decodificación RAW de cámaras comerciales (CR2, NEF, ARW) | **PARCIAL** | Arquitectura Tauri implementada. *Falta*: compilación y enlace FFI con `libraw-sys` / LibRaw nativo para Windows x64. |
| Perfiles de cámara (DNG / DCP) | **STUB** | Se utilizan matrices de color genéricas sRGB/AdobeRGB. *Falta*: parser de perfiles DCP de Adobe y matrices de calibración de sensor ColorMatrix1/2. |
| Multiplicadores de Balance de Blancos RAW | **PARCIAL** | Aplicación matemática en shader (`u_wb`). *Falta*: lectura automática de etiquetas EXIF `AsShotNeutral` directamente del fichero RAW. |
| **FASE 6: REVELADO AVANZADO** | | |
| Pases espaciales (Claridad, Textura, Dehaze, Bilateral NR) | **REAL** | Shaders GLSL independientes ejecutados en FBOs ping-pong RGBA16F (`spatialShader.ts`), sin costuras. |
| Sliders Blancos y Negros | **REAL** | Integrados en el uber-shader puntual en espacio lineal. |
| Curvas de tono (Paramétrica y por canal R, G, B) | **REAL** | Textura de consulta LUT generada dinámicamente y evaluada en WebGL2. |
| Gradación de color (Color Grading 3-Way) | **REAL** | Ruedas de Sombras, Tonos Medios y Luces con cálculo de luminancia y controles de balance y fusión. |
| Reducción de ruido y enfoque | **REAL** | Filtro bilateral espacial de 9 muestras y unsharp masking en GPU. |
| Correcciones de lente (Lensfun) | **PARCIAL / STUB** | Shader aplica distorsión analítica radial $r(1 + k_1 r^2)$. *Falta*: integración de la base de datos `lensfun` compilada para Windows con perfiles de aberración y distorsión calibrados por lente. |
| Viñeteo posterior al recorte | **REAL** | Fórmula cuadrática basada en coordenadas normalizadas del recorte. |
| Grano fílmico analógico | **REAL** | Generador pseudo-aleatorio basado en coordenadas globales de píxel, invariante al zoom y teselas. |
| Calibración de cámara | **REAL** | Controles de tinte de sombras y calibración de primarios RGB en el shader puntual. |
| Guías de composición de recorte | **REAL** | SVG interactivo con regla de los tercios, espiral áurea, diagonales y cuadrícula. |
| Eliminación de manchas (Clone / Heal) | **PARCIAL** | Pines con radio y desvanecimiento interactivo en lienzo. *Falta*: solver Poisson (Seamless Cloning) en GPU; actualmente usa copia con máscara suavizada. |
| Pincel de ajuste local | **REAL** | Trazos con flujo, densidad y tamaño guardados en base de datos (`brush_strokes`) y rasterizados. |
| Máscaras de rango de Luminancia y Color | **REAL** | Shaders de selección por rango tonal y distancia cromática en espacio Lab/RGB. |
| Modos Antes / Después (4 modos) | **REAL** | Vista simple, split vertical interactivo, split horizontal y lado a lado. |
| Prueba en pantalla (Soft Proofing) | **PARCIAL** | Simulación de contraste y compresión de gamut en lienzo. *Falta*: enlace con la biblioteca LittleCMS (LCMS2) y carga de archivos `.icc` reales de perfiles de papel e impresora. |
| **FASE 7: MÓDULOS ADICIONALES Y SERVICIOS** | | |
| Módulo Mapa (GPS) | **PARCIAL** | Interfaz, pines de fotos, cálculo Mercator, zoom y geocodificación de ciudades principales funcionando. *Falta*: clave de API de teselas cartográficas (OpenStreetMap / Mapbox) para descargar mapa vectorial o satelital en directo. |
| Módulo Libro (Photobook) | **PARCIAL** | Diseñador de pliegos a doble página, selección de formatos y plantillas de maquetación interactiva. *Falta*: exportador PDF binario nativo que genere el documento final imprimible a 300 ppp. |
| Módulo Presentación (Slideshow) | **REAL** | Reproductor con temporizador, transiciones (Disolución, Ken Burns dinámico), superposición de EXIF y modo pantalla completa funcional. |
| Módulo Impresión | **PARCIAL** | Maquetación de hojas de contacto y copias sueltas a 300 ppp / 240 ppp con llamada nativa a `window.print()`. *Falta*: envío directo de tramas rasterizadas mediante el subsistema de spool de Windows (Winspool GDI) para impresión profesional desatendida. |
| Módulo Web (Galería HTML5) | **PARCIAL** | Diseñador de galerías responsivas con 3 temas y 3 estilos de cuadrícula. *Falta*: empaquetado y escritura física de la carpeta web (`index.html`, assets e imágenes) en disco mediante Tauri FS. |
| Captura Conectada (Tethering) | **STUB** | Interfaz completa con diales de exposición, obturador, ISO y disparador funcional hacia el catálogo. *Falta*: drivers USB físicos (`gphoto2` o Sony SDK / Canon EDSDK por FFI en Rust). |
| Servicios de Publicación | **STUB** | Panel de servicios y colas de publicación en biblioteca. *Falta*: tokens de autenticación OAuth2 y llamadas REST a las APIs de Flickr y Adobe Stock. |

---

## Resumen de Dependencias Externas Requeridas para Producción Comercial

1. **RAW Nativo**: Binarios de `LibRaw` compilados para MSVC x64 vinculados mediante `build.rs`.
2. **Corrección de Objetivos**: Librería y base de datos `lensfun` (ficheros XML de calibración de cámaras y lentes).
3. **Gestión de Color / Soft Proofing**: `LittleCMS 2` (`lcms2`) para transformación precisa de perfiles ICC de impresoras.
4. **Mapas en Vivo**: Endpoint de servidor de tiles (Mapbox, OpenStreetMap o Google Maps API).
5. **Generador PDF**: Crate `printpdf` o `pdf-writer` en Rust para exportación vectorial de libros de fotos.
6. **Tethering USB**: `libgphoto2` o SDKs de fabricantes (Sony Camera Remote SDK, Canon EDSDK, Nikon SDK).
7. **Servicios Cloud**: Registro de aplicaciones en Adobe Developer Console y Flickr App Console para credenciales OAuth2.
