import { test, expect } from '@playwright/test';

test.describe('Lumen Application E2E', () => {
  test('loads application shell and switches between Library and Develop', async ({ page }) => {
    await page.goto('/');
    
    // Expect title or main shell
    await expect(page).toHaveTitle(/Lumen/i);
    
    // Check module switch buttons
    const libBtn = page.getByRole('button', { name: /Biblioteca/i });
    const devBtn = page.getByRole('button', { name: /Revelado/i });
    
    await expect(libBtn).toBeVisible();
    await expect(devBtn).toBeVisible();

    // Click Revelado
    await devBtn.click();
    await expect(page.getByText(/Exposición|Histograma|Básico/i).first()).toBeVisible();

    // Check all modules
    const mapBtn = page.getByRole('button', { name: /Mapa/i });
    const bookBtn = page.getByRole('button', { name: /Libro/i });
    const slideBtn = page.getByRole('button', { name: /Presentación/i });
    const printBtn = page.getByRole('button', { name: /Impresión/i });
    const webBtn = page.getByRole('button', { name: /Web/i });

    // Click Mapa
    await mapBtn.click();
    await expect(page.getByText(/fotos geolocalizadas|Buscar ciudad/i).first()).toBeVisible();

    // Click Libro
    await bookBtn.click();
    await expect(page.getByText(/Ajustes del Libro|Exportar a PDF/i).first()).toBeVisible();

    // Click Presentación
    await slideBtn.click();
    await expect(page.getByText(/AJUSTES DE PRESENTACIÓN|Reproducir/i).first()).toBeVisible();

    // Click Impresión
    await printBtn.click();
    await expect(page.getByText(/FILAS Y COLUMNAS|Imprimir…/i).first()).toBeVisible();

    // Click Web
    await webBtn.click();
    await expect(page.getByText(/Galería Web|publicación web/i).first()).toBeVisible();

    // Return to Library
    await libBtn.click();
    await expect(page.getByText(/Servicios de Publicación/i).first()).toBeVisible();
  });
});
