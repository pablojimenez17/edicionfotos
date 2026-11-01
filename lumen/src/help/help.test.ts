import { describe, it, expect } from 'vitest';
import { HELP_ES } from './help.es';

describe('Sistema de Ayuda Integrada (help.es.ts)', () => {
  // Lista de identificadores de control que deben estar obligatoriamente registrados
  const REQUIRED_CONTROLS = [
    // Módulos
    'module_library',
    'module_develop',
    'module_map',
    'module_book',
    'module_slideshow',
    'module_print',
    'module_web',
    'theme_toggle',
    'help_shortcuts',

    // Vistas y acciones de biblioteca
    'view_grid',
    'view_loupe',
    'view_compare',
    'view_survey',
    'btn_import',
    'btn_export',

    // Paneles de biblioteca
    'panel_folders',
    'panel_collections',
    'panel_keywords',
    'panel_publish',
    'panel_metadata',

    // Ajustes básicos de revelado
    'exposure',
    'contrast',
    'highlights',
    'shadows',
    'whites',
    'blacks',
    'temperature',
    'tint',
    'vibrance',
    'saturation',
    'texture',
    'clarity',
    'dehaze',

    // Curva y color
    'tone_curve',
    'hsl_panel',
    'color_grading',

    // Detalle y óptica
    'sharpening',
    'noise_reduction',
    'lens_corrections',
    'vignette',
    'grain',

    // Herramientas y máscaras
    'tool_crop',
    'tool_clipping',
    'tool_before_after',
    'tool_copy_settings',
    'tool_paste_settings',
    'tool_sync_settings',
    'tool_reset_settings',
    'mask_panel',
    'mask_radial',
    'mask_linear',
    'mask_brush',
  ];

  it('todos los controles obligatorios existen en el diccionario de ayuda', () => {
    const missing: string[] = [];
    for (const id of REQUIRED_CONTROLS) {
      if (!HELP_ES[id]) {
        missing.push(id);
      }
    }
    expect(missing).toEqual([]);
  });

  it('cada entrada de ayuda contiene todos los campos requeridos con texto significativo', () => {
    for (const [id, entry] of Object.entries(HELP_ES)) {
      expect(entry.id, `ID coincidente en ${id}`).toBe(id);
      expect(entry.title.trim().length, `title en ${id}`).toBeGreaterThan(2);
      expect(entry.what.trim().length, `what en ${id}`).toBeGreaterThan(10);
      expect(entry.effect.trim().length, `effect en ${id}`).toBeGreaterThan(10);
      expect(entry.tip.trim().length, `tip en ${id}`).toBeGreaterThan(10);
    }
  });

  it('los controles con atajos especifican combinaciones válidas', () => {
    for (const [id, entry] of Object.entries(HELP_ES)) {
      if (entry.shortcut) {
        expect(entry.shortcut.trim().length, `shortcut en ${id}`).toBeGreaterThan(0);
      }
    }
  });
});
