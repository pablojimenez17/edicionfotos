export interface HelpEntry {
  id: string;
  title: string;
  what: string;
  effect: string;
  tip: string;
  warn?: string;
  shortcut?: string;
}

export const HELP_ES: Record<string, HelpEntry> = {
  // ─── Navegación Global y Módulos ──────────────────────────────────────────
  module_library: {
    id: 'module_library',
    title: 'Módulo Biblioteca',
    what: 'Gestión, organización, clasificación y filtrado del catálogo de fotos.',
    effect: 'Permite buscar fotos rápidamente, asignar estrellas, banderas y palabras clave.',
    tip: 'Usa la vista Cuadrícula (G) para organizar y la vista Lupa (E) para inspeccionar a fondo.',
    shortcut: 'G / E',
  },
  module_develop: {
    id: 'module_develop',
    title: 'Módulo Revelado',
    what: 'Ajuste no destructivo del color, exposición, tono, máscaras y detalle de la imagen.',
    effect: 'Aplica el motor de procesamiento WebGL en tiempo real a 16/32 bits.',
    tip: 'Empieza siempre por el balance de blancos y la exposición antes de curvas o color grading.',
    shortcut: 'D',
  },
  module_map: {
    id: 'module_map',
    title: 'Módulo Mapa',
    what: 'Geolocalización y visualización en mapa de fotos con coordenadas GPS.',
    effect: 'Muestra chinchetas agrupadas por ubicación geográfica.',
    tip: 'Próximamente disponible con soporte de mapas sin conexión.',
  },
  module_book: {
    id: 'module_book',
    title: 'Módulo Libro',
    what: 'Composición y maquetación de fotolibros para impresión.',
    effect: 'Organiza fotos en páginas con plantillas editoriales.',
    tip: 'Próximamente disponible con exportación PDF en alta resolución.',
  },
  module_slideshow: {
    id: 'module_slideshow',
    title: 'Módulo Presentación',
    what: 'Proyección a pantalla completa de pases de diapositivas con transiciones.',
    effect: 'Muestra tus fotos seleccionadas a pantalla completa.',
    tip: 'Próximamente disponible con música y tiempos configurables.',
  },
  module_print: {
    id: 'module_print',
    title: 'Módulo Impresión',
    what: 'Preparación de pliegos de impresión, perfiles de papel ICC y marcas de corte.',
    effect: 'Ajusta la resolución de salida a los DPI exactos de tu impresora.',
    tip: 'Próximamente disponible con soporte de soft-proofing de laboratorio.',
  },
  module_web: {
    id: 'module_web',
    title: 'Módulo Galería Web',
    what: 'Exportación y generación de galerías HTML5 interactivas para compartir en línea.',
    effect: 'Genera una carpeta estática lista para subir a cualquier hosting web.',
    tip: 'Próximamente disponible.',
  },
  theme_toggle: {
    id: 'theme_toggle',
    title: 'Alternar Tema Claro / Oscuro',
    what: 'Cambia el aspecto visual de la aplicación entre modo oscuro neutro y claro.',
    effect: 'El modo oscuro neutro evita distorsionar la percepción del color en la fotografía.',
    tip: 'Se recomienda usar siempre el tema oscuro para edición crítica de color.',
  },
  help_shortcuts: {
    id: 'help_shortcuts',
    title: 'Atajos de Teclado',
    what: 'Abre la guía interactiva completa de atajos de teclado de Lumen.',
    effect: 'Muestra una ventana modal con todos los atajos clasificados por módulo.',
    tip: 'Pulsa ? en cualquier momento para ver los atajos disponibles.',
    shortcut: '?',
  },

  // ─── Biblioteca: Vistas y Herramientas ────────────────────────────────────
  view_grid: {
    id: 'view_grid',
    title: 'Vista Cuadrícula',
    what: 'Muestra todas las fotos de la carpeta o colección en mosaico.',
    effect: 'Permite revisar muchas fotos a la vez y seleccionar varias para operaciones en lote.',
    tip: 'Ajusta el tamaño de miniatura con el control deslizante de la barra de herramientas.',
    shortcut: 'G',
  },
  view_loupe: {
    id: 'view_loupe',
    title: 'Vista Lupa',
    what: 'Muestra la foto activa en tamaño grande para evaluar nitidez y composición.',
    effect: 'Ocupa el lienzo central con una única imagen.',
    tip: 'Haz clic en la imagen o pulsa Espacio / Z para alternar entre encajar y zoom 100%.',
    shortcut: 'E / Espacio',
  },
  view_compare: {
    id: 'view_compare',
    title: 'Vista Comparar (Antes y Candidata)',
    what: 'Compara dos fotos lado a lado: la seleccionada (Focus) y la candidata.',
    effect: 'Permite ver diferencias sutiles de enfoque, expresión o exposición entre dos tomas.',
    tip: 'Usa las flechas para cambiar la candidata y pulsa Intro para elegirla.',
    shortcut: 'C',
  },
  view_survey: {
    id: 'view_survey',
    title: 'Vista Encuesta',
    what: 'Muestra de 3 a 10 fotos seleccionadas simultáneamente para cribar la mejor toma.',
    effect: 'Permite eliminar fotos de la selección una a una hasta quedarte con la ganadora.',
    tip: 'Pulsa la X en una miniatura para descartarla del grupo sin borrar el archivo.',
    shortcut: 'N',
  },
  btn_import: {
    id: 'btn_import',
    title: 'Importar Fotografías',
    what: 'Abre el diálogo para añadir imágenes al catálogo desde disco o tarjeta de memoria.',
    effect: 'Escanea la carpeta origen y genera miniaturas en caché SQLite.',
    tip: 'Puedes importar sin mover los archivos eligiendo el modo "Añadir".',
    shortcut: 'Ctrl+Shift+I',
  },
  btn_export: {
    id: 'btn_export',
    title: 'Exportar Fotografías',
    what: 'Genera copias procesadas en JPEG, TIFF o DNG con perfiles ICC y metadatos.',
    effect: 'Aplica todos los ajustes de revelado y guarda las fotos en el destino seleccionado.',
    tip: 'Selecciona sRGB si la foto se va a ver en pantallas o redes sociales.',
    shortcut: 'Ctrl+Shift+E',
  },

  // ─── Biblioteca: Paneles ──────────────────────────────────────────────────
  panel_folders: {
    id: 'panel_folders',
    title: 'Panel Carpetas',
    what: 'Árbol de directorios locales que han sido importados en el catálogo de Lumen.',
    effect: 'Haz clic en una carpeta para mostrar todas sus fotos en la cuadrícula.',
    tip: 'Lumen respeta la estructura real de tus discos sin duplicar archivos.',
  },
  panel_collections: {
    id: 'panel_collections',
    title: 'Panel Colecciones',
    what: 'Agrupaciones virtuales de fotos independientes de su ubicación física en el disco.',
    effect: 'Una misma foto puede pertenecer a varias colecciones sin ocupar espacio extra.',
    tip: 'Usa la Colección Rápida (tecla B) para seleccionar fotos sobre la marcha.',
    shortcut: 'B',
  },
  panel_keywords: {
    id: 'panel_keywords',
    title: 'Panel Palabras Clave',
    what: 'Gestión de etiquetas descriptivas y jerárquicas asignadas a las fotos.',
    effect: 'Facilita la búsqueda instantánea de temas, personas, lugares o eventos.',
    tip: 'Crea jerarquías (ej: España > Madrid > Retiro) para autocompletar etiquetas padre.',
  },
  panel_publish: {
    id: 'panel_publish',
    title: 'Servicios de Publicación',
    what: 'Sincronización directa con galerías en la nube y servicios de almacenamiento.',
    effect: 'Mantendrá tus fotos exportadas sincronizadas con plataformas en la nube.',
    tip: 'Próximamente disponible.',
  },
  panel_metadata: {
    id: 'panel_metadata',
    title: 'Panel Metadatos EXIF / IPTC',
    what: 'Muestra los datos de captura de la cámara y permite editar títulos, autor y copyright.',
    effect: 'Guarda los metadatos en la base de datos y en archivos XMP asociados.',
    tip: 'Revisa aquí el ISO, apertura, obturador y modelo de lente utilizado.',
  },

  // ─── Revelado: Básico ─────────────────────────────────────────────────────
  exposure: {
    id: 'exposure',
    title: 'Exposición',
    what: 'Ajusta el brillo global de la fotografía en pasos de diafragma (EV).',
    effect: 'Al subir aclara toda la imagen; al bajar la oscurece de forma uniforme.',
    tip: 'Valores habituales entre -1.0 y +1.0 EV. Haz doble clic para restablecer a 0.',
    warn: 'Valores extremos por encima de +2.0 pueden reventar las luces y generar ruido.',
  },
  contrast: {
    id: 'contrast',
    title: 'Contraste',
    what: 'Ajusta la diferencia de luminosidad entre las zonas claras y oscuras.',
    effect: 'Al subir acentúa negros y blancos (imagen más impactante); al bajar aplana los tonos.',
    tip: 'Un valor entre +10 y +25 suele dar viveza sin empastar sombras.',
    warn: 'Un exceso de contraste aplana los medios tonos y satura artificialmente los colores.',
  },
  highlights: {
    id: 'highlights',
    title: 'Altas Luces',
    what: 'Recupera detalle en las zonas muy iluminadas sin afectar a los tonos medios.',
    effect: 'Al bajar recupera textura en nubes o pieles claras; al subir da más brillo al cielo.',
    tip: 'Para paisajes con cielo luminoso, prueba a bajarlo entre -30 y -70.',
  },
  shadows: {
    id: 'shadows',
    title: 'Sombras',
    what: 'Aclara u oscurece las zonas oscuras de la foto para revelar u ocultar detalle.',
    effect: 'Al subir aclara sombras empastadas; al bajar intensifica la profundidad y dramatismo.',
    tip: 'En tomas a contraluz, subir a +20 o +40 rescata los sujetos sin quemar el fondo.',
    warn: 'Levantar excesivamente las sombras (+60) puede hacer visible ruido de sensor.',
  },
  whites: {
    id: 'whites',
    title: 'Blancos',
    what: 'Fija el punto blanco de la imagen, extendiendo el extremo derecho del histograma.',
    effect: 'Al subir hace los blancos más puros y luminosos; al bajar los atenúa.',
    tip: 'Mantén pulsada la tecla Alt al arrastrar para ver exactamente cuándo empiezan a recortarse.',
  },
  blacks: {
    id: 'blacks',
    title: 'Negros',
    what: 'Fija el punto negro de la imagen, extendiendo el extremo izquierdo del histograma.',
    effect: 'Al bajar da cuerpo y fuerza al negro profundo; al subir crea un aspecto mate / faded.',
    tip: 'Mantén pulsado Alt al arrastrar para evitar recortar sombras sin darte cuenta.',
  },
  temperature: {
    id: 'temperature',
    title: 'Temperatura de Color',
    what: 'Compensa la tonalidad de la luz entre tonos fríos (azul) y cálidos (amarillo/ámbar).',
    effect: 'Hacia la izquierda enfría la escena; hacia la derecha aporta calidez dorada.',
    tip: 'Para luz día natural busca el blanco neutro; para atardeceres aporta calidez suave.',
  },
  tint: {
    id: 'tint',
    title: 'Matiz (Tinte)',
    what: 'Compensa las desviaciones entre tonalidades verdes y magentas.',
    effect: 'Hacia la izquierda añade verde (corrige tubos fluorescentes); a la derecha magenta.',
    tip: 'Ajusta primero la temperatura y luego el matiz para neutralizar dominantes de color.',
  },
  vibrance: {
    id: 'vibrance',
    title: 'Intensidad',
    what: 'Saturación inteligente que actúa solo sobre los colores apagados, protegiendo pieles.',
    effect: 'Realza los colores tenues sin sobre-saturar tonos cálidos ni rostros humanos.',
    tip: 'Preferible antes que Saturación general cuando hay personas en la fotografía.',
  },
  saturation: {
    id: 'saturation',
    title: 'Saturación Global',
    what: 'Aumenta o reduce la pureza y viveza de todos los colores por igual.',
    effect: 'Al subir intensifica todos los colores; al bajar (-100) convierte a blanco y negro.',
    tip: 'Úsalo con moderación (+5 a +15). Para blanco y negro selectivo usa el panel B/N.',
    warn: 'Valores altos (+40) crean halos plásticos y pérdida de gradación en colores primarios.',
  },
  texture: {
    id: 'texture',
    title: 'Textura',
    what: 'Acentúa o suaviza detalles de frecuencia media (piel, follaje, pelo, telas).',
    effect: 'Al subir da nitidez a texturas finas sin crear halos; al bajar suaviza la piel con naturalidad.',
    tip: 'Excelente para retratos (-10 a -20) para suavizar arrugas manteniendo ojos enfocados.',
  },
  clarity: {
    id: 'clarity',
    title: 'Claridad',
    what: 'Aumenta el contraste local en los medios tonos de la imagen.',
    effect: 'Aporta tridimensionalidad y volumen; al bajar da un efecto suave y ensoñador.',
    tip: 'Muy eficaz en arquitectura, paisajes rocosos y fotografía callejera (+10 a +25).',
    warn: 'El exceso (+40) genera halos oscuros alrededor de bordes contrastados.',
  },
  dehaze: {
    id: 'dehaze',
    title: 'Borrar Neblina (Dehaze)',
    what: 'Detecta y elimina la pérdida de contraste causada por calima, niebla o reflejos ópticos.',
    effect: 'Al subir restaura el contraste y saturación en fondos lejanos; al bajar añade niebla artística.',
    tip: 'Imprescindible en fotos de montaña o marinas tomadas en días calurosos.',
    warn: 'Al subir mucho (+30) oscurece el cielo y satura intensamente los azules.',
  },

  // ─── Revelado: Curva de Tonos ─────────────────────────────────────────────
  tone_curve: {
    id: 'tone_curve',
    title: 'Curva de Tonos Paramétrica y Puntos',
    what: 'Control fino del contraste y brillo en 4 zonas: Luces, Claros, Oscuros y Sombras.',
    effect: 'Una curva en "S" suave aumenta el contraste orgánico de forma más dulce que el slider.',
    tip: 'Coloca puntos de anclaje para proteger los medios tonos mientras ajustas extremos.',
  },

  // ─── Revelado: HSL / Color ────────────────────────────────────────────────
  hsl_panel: {
    id: 'hsl_panel',
    title: 'Panel HSL / Color',
    what: 'Ajuste selectivo e independiente de Tono, Saturación y Luminancia en 8 bandas de color.',
    effect: 'Permite por ejemplo hacer el cielo más turquesa u oscurecer la vegetación sin tocar el resto.',
    tip: 'Usa la luminancia del naranja para iluminar rostros en retratos sin alterar la exposición.',
  },

  // ─── Revelado: Gradación de Color (Split Toning) ───────────────────────────
  color_grading: {
    id: 'color_grading',
    title: 'Gradación de Color (Color Grading)',
    what: 'Aplica tinte de color independiente a Sombras, Medios Tonos y Altas Luces con ruedas cromáticas.',
    effect: 'Crea estilos cinematográficos (ej: sombras azuladas y luces cálidas doradas "Teal & Orange").',
    tip: 'El control Equilibrio (Balance) define si predomina el tono de las sombras o el de las luces.',
  },

  // ─── Revelado: Detalle y Ruido ────────────────────────────────────────────
  sharpening: {
    id: 'sharpening',
    title: 'Enfoque (Nitidez)',
    what: 'Acentúa los bordes de la imagen para compensar la suavidad del sensor óptico.',
    effect: 'Aumenta la definición aparente en ojos, pestañas, ramas y texturas.',
    tip: 'Usa la Máscara de enfoque (Alt) para enfocar solo los contornos y no el fondo liso.',
    warn: 'Un enfoque excesivo genera grano falso y halos blancos desagradables.',
  },
  noise_reduction: {
    id: 'noise_reduction',
    title: 'Reducción de Ruido',
    what: 'Filtro bilateral que elimina el grano digital de luminancia y ruido de color en ISOs altos.',
    effect: 'Alisa el fondo y limpia manchas de color en tomas con poca luz.',
    tip: 'Ajusta primero la reducción de color (25) y luego luminancia con moderación para no perder nitidez.',
  },

  // ─── Revelado: Óptica y Geometría ─────────────────────────────────────────
  lens_corrections: {
    id: 'lens_corrections',
    title: 'Correcciones de Lente',
    what: 'Corrige la distorsión geométrica en barril/cojín, viñeteo óptico y aberración cromática.',
    effect: 'Endereza líneas rectas y elimina los bordes púrpuras o verdes en contraluces.',
    tip: 'Activa "Quitar aberración cromática" en todas tus fotos angulares de alto contraste.',
  },

  // ─── Revelado: Efectos ────────────────────────────────────────────────────
  vignette: {
    id: 'vignette',
    title: 'Viñeteado Posterior al Recorte',
    what: 'Oscurece o aclara gradualmente las cuatro esquinas de la imagen.',
    effect: 'Al bajar oscurece las esquinas centrando la atención de la mirada en el sujeto principal.',
    tip: 'Valores sutiles entre -10 y -20 suelen ser imperceptibles pero muy efectivos.',
  },
  grain: {
    id: 'grain',
    title: 'Grano Fotográfico Analógico',
    what: 'Simula la textura de haluro de plata de películas analógicas clásicas.',
    effect: 'Añade grano orgánico que da carácter y ayuda a disimular zonas ligeramente desenfocadas.',
    tip: 'Combina cantidad +25 con tamaño pequeño para un toque elegante de 35mm.',
  },

  // ─── Herramientas de Revelado ─────────────────────────────────────────────
  tool_crop: {
    id: 'tool_crop',
    title: 'Herramienta Recortar y Enderezar',
    what: 'Reencuadra la foto, cambia la proporción de aspecto (1:1, 4:5, 16:9) y endereza el horizonte.',
    effect: 'Recorta los márgenes de la imagen de forma no destructiva con guías de composición.',
    tip: 'Pulsa O para alternar entre regla de los tercios, espiral áurea y cuadrícula.',
    shortcut: 'R',
  },
  tool_clipping: {
    id: 'tool_clipping',
    title: 'Avisos de Recorte de Sombras y Luces',
    what: 'Muestra en azul las zonas con negros puros (0) y en rojo las luces reventadas (255).',
    effect: 'Superpone avisos de color sobre el lienzo para garantizar que no pierdes información.',
    tip: 'Pulsa la tecla J para encender y apagar los avisos rápidamente mientras editas.',
    shortcut: 'J',
  },
  tool_before_after: {
    id: 'tool_before_after',
    title: 'Vista Antes y Después',
    what: 'Alterna entre la foto original sin editar y la versión con todos los ajustes actuales.',
    effect: 'Permite juzgar si los cambios realizados han mejorado realmente la imagen.',
    tip: 'Pulsa la tecla barra invertida (\\) para conmutar al instante.',
    shortcut: '\\',
  },
  tool_copy_settings: {
    id: 'tool_copy_settings',
    title: 'Copiar Ajustes de Revelado',
    what: 'Guarda en el portapapeles los valores de los paneles seleccionados.',
    effect: 'Permite aplicar la misma edición a otra fotografía con un solo atajo.',
    tip: 'Úsalo junto a Pegar (Ctrl+Shift+V) para agilizar series de la misma sesión.',
    shortcut: 'Ctrl+Shift+C',
  },
  tool_paste_settings: {
    id: 'tool_paste_settings',
    title: 'Pegar Ajustes de Revelado',
    what: 'Aplica los ajustes del portapapeles a la foto activa.',
    effect: 'Actualiza instantáneamente todos los controles con la receta copiada.',
    tip: 'Asegúrate de haber copiado previamente ajustes de otra foto.',
    shortcut: 'Ctrl+Shift+V',
  },
  tool_sync_settings: {
    id: 'tool_sync_settings',
    title: 'Sincronizar Ajustes en Lote',
    what: 'Transfiere los ajustes de la foto activa a todas las fotos seleccionadas en el carrete.',
    effect: 'Abre un cuadro de diálogo para elegir qué paneles específicos sincronizar.',
    tip: 'Ideal para corregir el balance de blancos o curvas en una sesión completa.',
    shortcut: 'Ctrl+Shift+S',
  },
  tool_reset_settings: {
    id: 'tool_reset_settings',
    title: 'Restablecer Ajustes',
    what: 'Devuelve todos los controles de revelado a su estado inicial por defecto.',
    effect: 'Elimina los ajustes aplicados sin borrar la foto del catálogo.',
    tip: 'Para restablecer un solo slider, haz doble clic sobre su nombre.',
    shortcut: 'Ctrl+Shift+R',
  },

  // ─── Máscaras y Ajustes Locales ───────────────────────────────────────────
  mask_panel: {
    id: 'mask_panel',
    title: 'Ajustes Locales por Máscaras',
    what: 'Crea selecciones geométricas o por pincel para aplicar ajustes solo a una parte de la foto.',
    effect: 'Permite oscurecer solo el cielo, iluminar un rostro o desenfocar el fondo.',
    tip: 'Puedes combinar varias máscaras (sumar, restar, invertir) para aislar elementos complejos.',
    shortcut: 'M',
  },
  mask_radial: {
    id: 'mask_radial',
    title: 'Máscara Radial (Elíptica)',
    what: 'Crea una selección elíptica con transición de desvanecimiento suave desde el centro.',
    effect: 'Perfecta para viñetas creativas personalizadas, focos de luz sobre rostros o destellos.',
    tip: 'Mantén pulsado Mayús para trazar un círculo perfecto.',
  },
  mask_linear: {
    id: 'mask_linear',
    title: 'Máscara Gradiente Lineal',
    what: 'Crea una transición gradual de ajuste a lo largo de una línea directriz.',
    effect: 'Simula el efecto de un filtro de densidad neutra degradado en paisajes.',
    tip: 'Mantén Mayús mientras arrastras para bloquear el ángulo a 90 o 180 grados.',
  },
  mask_brush: {
    id: 'mask_brush',
    title: 'Máscara con Pincel',
    what: 'Pinta libremente sobre la imagen con tamaño, desvanecimiento y flujo ajustables.',
    effect: 'Permite pintar ajustes selectivos en detalles irregulares como ojos, labios o ropa.',
    tip: 'Usa la rueda del ratón para cambiar el tamaño del pincel sobre la marcha.',
    shortcut: 'K',
  },
};
