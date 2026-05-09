/**
 * Run lifecycle states for parent matrix runs
 */
export enum RunStatus {
  DRAFT = "draft",
  AWAITING_APPROVAL = "awaiting_approval",
  RUNNING = "running",
  PAUSED_FOR_APPROVAL = "paused_for_approval",
  COMPLETED = "completed",
  ABORTED = "aborted",
  FAILED = "failed",
}

/**
 * Execution lifecycle states for child executions
 */
export enum ExecutionStatus {
  QUEUED = "queued",
  RUNNING = "running",
  PAUSED = "paused",
  PASSED = "passed",
  FAILED = "failed",
  ABORTED = "aborted",
  SKIPPED_BY_APPROVAL = "skipped_by_approval",
  FRICTION_FLAGGED = "friction_flagged",
}

/**
 * Browser types supported by Playwright
 */
export enum BrowserType {
  CHROMIUM = "chromium",
  FIREFOX = "firefox",
  WEBKIT = "webkit",
}

/**
 * Matrix run configuration
 */
export interface MatrixRunConfig {
  site_id: string;
  site_environment_id: string;
  flow_ids: string[];
  persona_ids: string[];
  device_profile_ids: string[];
  network_profile_ids: string[];
  browsers: BrowserType[];
  approval_policy_overrides?: Record<string, ApprovalStrength>;
  artifact_retention_override?: string;
  notes?: string;
}

/**
 * Parent run record
 */
export interface Run {
  id: string;
  site_id: string;
  site_environment_id: string;
  status: RunStatus;
  config: MatrixRunConfig;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
  started_at?: Date;
  completed_at?: Date;
}

/**
 * Child execution record
 */
export interface RunExecution {
  id: string;
  run_id: string;
  persona_id: string;
  device_profile_id: string;
  network_profile_id: string;
  browser: BrowserType;
  flow_id: string;
  status: ExecutionStatus;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
  started_at?: Date;
  completed_at?: Date;
  friction_score?: number;
  error_message?: string;
}

/**
 * Step record within an execution
 */
export interface RunStep {
  id: string;
  execution_id: string;
  step_name: string;
  step_order: number;
  status: ExecutionStatus;
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  artifact_paths?: string[];
}

/**
 * Approval strength levels
 */
export enum ApprovalStrength {
  NONE = "none",
  ONE_CLICK = "one_click",
  STRONG = "strong",
}
