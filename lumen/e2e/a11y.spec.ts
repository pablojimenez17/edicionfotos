import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Pruebas de Accesibilidad Automatizada (axe-core)', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss initial walkthrough by default so views can be tested directly
    await page.addInitScript(() => {
      localStorage.setItem('lumen_walkthrough_seen', 'true');
    });
  });

  test('Biblioteca: cumple con accesibilidad en pantalla principal (1280x720)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForTimeout(500);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Revelado: cumple con accesibilidad con sliders, histograma y paneles', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForTimeout(300);

    // Switch to Develop module
    await page.getByRole('button', { name: /Revelado/i }).click();
    await page.waitForTimeout(500);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Modales de Orientación: Atajos, Guía y Glosario accesibles', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForTimeout(300);

    // Open shortcuts modal
    await page.getByRole('button', { name: /Atajos/i }).click();
    await page.waitForTimeout(300);

    const shortcutsResults = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();

    expect(shortcutsResults.violations).toEqual([]);

    // Close shortcuts modal with ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Open glossary modal
    await page.getByRole('button', { name: /Glosario/i }).click();
    await page.waitForTimeout(300);

    const glossaryResults = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();

    expect(glossaryResults.violations).toEqual([]);
  });
});
