/**
 * Artifact type categories
 */
export enum ArtifactType {
  TRACE = "trace",
  VIDEO = "video",
  SCREENSHOT = "screenshot",
  HAR = "har",
  CONSOLE_LOG = "console_log",
  NETWORK_LOG = "network_log",
  MP4_WALKTHROUGH = "mp4_walkthrough",
}

/**
 * Artifact record
 */
export interface Artifact {
  id: string;
  run_execution_id: string;
  artifact_type: ArtifactType;
  file_path: string;
  file_size_bytes: number;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
  is_pinned: boolean;
  retention_days: number;
}
