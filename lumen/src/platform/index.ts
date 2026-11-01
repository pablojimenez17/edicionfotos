import type { Platform } from './types';
import { TauriPlatform } from './tauri';
import { WebPlatform } from './web';

export * from './types';
export { TauriPlatform } from './tauri';
export { WebPlatform } from './web';

let currentPlatform: Platform | null = null;

export function isTauri(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);
}

export function getPlatform(): Platform {
  if (!currentPlatform) {
    if (isTauri()) {
      currentPlatform = new TauriPlatform();
    } else {
      currentPlatform = new WebPlatform();
    }
  }
  return currentPlatform;
}

export const platform = getPlatform();

export function getPreviewSource(photoId: number, size: 'thumb' | 'full' = 'full') {
  return getPlatform().getPreviewSource(photoId, size);
}
