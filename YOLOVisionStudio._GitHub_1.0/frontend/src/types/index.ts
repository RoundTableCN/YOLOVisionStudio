export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  thumbnail_path: string | null;
}

export interface Image {
  id: number;
  project_id: number;
  filename: string;
  original_path: string;
  thumbnail_path: string | null;
  width: number;
  height: number;
  file_size: number;
  imported_at: string;
}

export interface Label {
  id: number;
  project_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Annotation {
  id: number;
  image_id: number;
  label_id: number;
  x_center: number;
  y_center: number;
  width: number;
  height: number;
  created_at: string;
}

export interface Model {
  id: number;
  project_id: number;
  name: string;
  path: string;
  base_model: string;
  is_trained: boolean;
  created_at: string;
  training_id: number | null;
}

export interface Training {
  id: number;
  project_id: number;
  model_id: number;
  status: "running" | "completed" | "failed" | "stopped";
  params: TrainingParams;
  started_at: string | null;
  finished_at: string | null;
  metrics: TrainingMetrics | null;
  log_path: string | null;
}

export interface TrainingParams {
  model: string;
  epochs: number;
  batch_size: number;
  image_size: number;
  gpu_enabled: boolean;
}

export interface TrainingMetrics {
  mAP50: number;
  mAP50_95: number;
  precision: number;
  recall: number;
}

export interface GPUInfo {
  available: boolean;
  name: string | null;
  memory_total_mb: number | null;
  memory_used_mb: number | null;
  utilization_pct: number | null;
  temperature_c: number | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface DetectionResult {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  class_name: string;
  confidence: number;
}
