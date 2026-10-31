use std::fs;
use std::path::Path;

/// Writes an entire standalone HTML5 web gallery package to physical disk.
#[tauri::command]
pub fn export_web_gallery_to_disk(
    destination_folder: String,
    gallery_title: String,
    theme: String,
    layout_style: String,
    photo_urls: Vec<String>,
) -> Result<String, String> {
    let out_dir = Path::new(&destination_folder);
    fs::create_dir_all(out_dir).map_err(|e| format!("Failed creating directory: {}", e))?;

    let bg_color = match theme.as_str() {
        "light" => "#ffffff",
        "sepia" => "#fcfbf7",
        _ => "#0e0e10",
    };
    let text_color = match theme.as_str() {
        "light" => "#18181b",
        "sepia" => "#27272a",
        _ => "#f4f4f5",
    };

    let mut cards_html = String::new();
    for (i, url) in photo_urls.iter().enumerate() {
        cards_html.push_str(&format!(
            r#"<div class="gallery-item"><img src="{}" alt="Photo {}" loading="lazy" /></div>"#,
            url, i + 1
        ));
    }

    let html = format!(
        r#"<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body class="theme-{} layout-{}">
  <header>
    <h1>{}</h1>
    <p>Galería exportada con Lumen</p>
  </header>
  <main class="gallery-container">
    {}
  </main>
</body>
</html>"#,
        gallery_title, theme, layout_style, gallery_title, cards_html
    );

    let css = format!(
        r#"body {{
  margin: 0;
  padding: 2rem;
  background-color: {};
  color: {};
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}}
header {{
  text-align: center;
  margin-bottom: 2.5rem;
}}
header h1 {{
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
}}
.gallery-container {{
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}}
.gallery-item img {{
  width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transition: transform 0.2s ease;
}}
.gallery-item img:hover {{
  transform: scale(1.02);
}}
"#,
        bg_color, text_color
    );

    fs::write(out_dir.join("index.html"), html)
        .map_err(|e| format!("Failed writing index.html: {}", e))?;
    fs::write(out_dir.join("style.css"), css)
        .map_err(|e| format!("Failed writing style.css: {}", e))?;

    Ok(destination_folder)
}
