/**
 * Photo and catalog types for Lumen.
 */

export type Flag = 'none' | 'pick' | 'reject';
export type ColorLabel = 'none' | 'red' | 'yellow' | 'green' | 'blue' | 'purple';

export interface RootFolder {
  id: number;
  path: string;
  volume: string;
  name: string;
  is_missing: boolean;
}

export interface Folder {
  id: number;
  root_id: number;
  parent_id: number | null;
  rel_path: string;
  name: string;
  expanded: boolean;
  photo_count?: number;
}

export interface Photo {
  id: number;
  folder_id: number;
  master_id: number | null;

  filename: string;
  file_path: string;         // relative to root_folder
  file_size: number;
  file_hash: string;
  file_mtime: string;

  width: number;
  height: number;
  orientation: number;
  format: string;
  color_space: string;

  date_taken: string | null;
  camera_make: string | null;
  camera_model: string | null;
  lens: string | null;
  focal_length: number | null;
  aperture: number | null;
  shutter_speed: string | null;
  iso: number | null;
  gps_lat: number | null;
  gps_lng: number | null;

  rating: number;
  flag: Flag;
  color_label: ColorLabel;
  stack_id: number | null;
  stack_position: number | null;
  is_missing: boolean;

  imported_at: string;
  updated_at: string;

  // Joined from root_folders for resolving absolute paths
  root_path?: string;

  // Thumbnail URL (set at runtime)
  thumbnailUrl?: string;
}

export interface Collection {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  photo_count?: number;
  is_quick?: boolean;
}

export interface Keyword {
  id: number;
  parent_id: number | null;
  name: string;
  children?: Keyword[];
  photo_count?: number;
}

export interface SmartCollection {
  id: number;
  name: string;
  rules: Record<string, unknown>;
}


export interface HistoryStep {
  id: number;
  photo_id: number;
  step_index: number;
  label: string;
  settings: string;        // JSON
  created_at: string;
}

export interface Snapshot {
  id: number;
  photo_id: number;
  name: string;
  settings: string;
  created_at: string;
}

export interface ScannedPhoto {
  filename: string;
  rel_path: string;
  file_path?: string;
  file_size: number;
  file_hash: string;
  file_mtime: string;
  width: number;
  height: number;
  orientation: number;
  format: string;
  color_space: string;
  has_embedded_preview?: boolean;
  warning?: string | null;
  date_taken: string | null;
  camera_make: string | null;
  camera_model: string | null;
  lens: string | null;
  focal_length: number | null;
  aperture: number | null;
  shutter_speed: string | null;
  iso: number | null;
  gps_lat: number | null;
  gps_lng: number | null;
}

export interface ScanResult {
  photos: ScannedPhoto[];
  total_found: number;
  unsupported_count: number;
  corrupted_count: number;
  warnings: string[];
}

export interface RemovableDrive {
  path: string;
  label: string;
  drive_type: string;
}

