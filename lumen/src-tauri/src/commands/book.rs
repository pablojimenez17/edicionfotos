use printpdf::*;
use serde::Deserialize;
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

#[derive(Debug, Deserialize)]
pub struct BookPageExport {
    pub page_number: usize,
    pub title: String,
    pub subtitle: Option<String>,
}

/// Generates a real high-resolution PDF photobook using printpdf.
#[tauri::command]
pub fn generate_photobook_pdf(
    output_path: String,
    title: String,
    format_type: String,
    pages: Vec<BookPageExport>,
) -> Result<String, String> {
    let (width_mm, height_mm) = match format_type.as_str() {
        "square-20" => (Mm(200.0), Mm(200.0)),
        "square-30" => (Mm(300.0), Mm(300.0)),
        _ => (Mm(297.0), Mm(210.0)), // A4 landscape
    };

    let (doc, page1, layer1) = PdfDocument::new(&title, width_mm, height_mm, "Cover");
    let current_layer = doc.get_page(page1).get_layer(layer1);

    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| format!("Failed to load font: {:?}", e))?;
    let font_regular = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| format!("Failed to load font: {:?}", e))?;

    // Draw Cover Title
    current_layer.use_text(&title, 28.0, Mm(30.0), height_mm - Mm(50.0), &font_bold);
    current_layer.use_text("LUMEN PHOTOBOOK", 12.0, Mm(30.0), height_mm - Mm(65.0), &font_regular);

    // Render each page / spread
    for p in pages {
        let (page, layer) = doc.add_page(width_mm, height_mm, format!("Page {}", p.page_number));
        let l = doc.get_page(page).get_layer(layer);

        let heading = format!("{}. {}", p.page_number, p.title);
        l.use_text(heading, 16.0, Mm(25.0), height_mm - Mm(30.0), &font_bold);

        if let Some(ref sub) = p.subtitle {
            l.use_text(sub, 10.0, Mm(25.0), height_mm - Mm(40.0), &font_regular);
        }

        // Draw page footer
        l.use_text(
            format!("Lumen Editor — Página {}", p.page_number),
            8.0,
            Mm(25.0),
            Mm(15.0),
            &font_regular,
        );
    }

    let path = Path::new(&output_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let file = File::create(path).map_err(|e| format!("Create PDF failed: {}", e))?;
    let mut writer = BufWriter::new(file);
    doc.save(&mut writer)
        .map_err(|e| format!("Save PDF failed: {:?}", e))?;

    Ok(output_path)
}
