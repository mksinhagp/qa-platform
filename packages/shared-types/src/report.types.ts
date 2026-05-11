/**
 * Report types for Phase 9: Reporting and Narrative Layer
 * Defines data structures for narrative reports and technical drill-down
 */

/**
 * Per-persona summary for narrative reporting
 */
export interface PersonaSummary {
  persona_id: string;
  persona_display_name: string;
  total_executions: number;
  passed_executions: number;
  failed_executions: number;
  skipped_executions: number;
  avg_friction_score: number;
  avg_duration_seconds: number;
  top_issue_1: string | null;
  top_issue_2: string | null;
  top_issue_3: string | null;
}

/**
 * Accessibility summary across all executions
 */
export interface AccessibilitySummary {
  total_checks: number;
  passed_checks: number;
  failed_checks: number;
  critical_issues: number;
  serious_issues: number;
  moderate_issues: number;
  minor_issues: number;
  keyboard_nav_pass_rate: number;
  contrast_pass_rate: number;
  reflow_pass_rate: number;
}

/**
 * Deduplicated issue with severity ranking
 */
export interface DeduplicatedIssue {
  issue_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  summary: string;
  first_occurrence_step: string;
  occurrence_count: number;
  affected_personas: string;
  affected_executions: number;
  example_error_message: string | null;
  first_occurrence_time: Date;
}

/**
 * Friction signal aggregation
 */
export interface FrictionSignalAggregate {
  execution_id: number;
  persona_id: string;
  flow_name: string;
  signal_type: string;
  signal_count: number;
  first_occurrence: Date;
  last_occurrence: Date;
  example_step: string | null;
  example_metadata: Record<string, unknown> | null;
}

/**
 * Detailed execution data for technical drill-down
 */
export interface ExecutionDetail {
  execution_id: number;
  run_id: number;
  persona_id: string;
  persona_display_name: string;
  device_profile_id: number;
  device_profile_name: string;
  network_profile_id: number;
  network_profile_name: string;
  browser: string;
  flow_name: string;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  duration_seconds: number | null;
  friction_score: number | null;
  error_message: string | null;
  artifact_path: string | null;
  step_id: number | null;
  step_name: string | null;
  step_order: number | null;
  step_type: string | null;
  step_status: string | null;
  step_started_at: Date | null;
  step_completed_at: Date | null;
  step_error_message: string | null;
  step_details: Record<string, unknown> | null;
  artifact_type: string | null;
  artifact_file_path: string | null;
  artifact_file_size_bytes: number | null;
  artifact_mime_type: string | null;
}

/**
 * High-level run summary for narrative report header
 */
export interface RunSummary {
  run_id: number;
  run_name: string;
  run_description: string | null;
  run_status: string;
  site_id: number;
  site_name: string;
  site_url: string;
  environment_id: number;
  environment_name: string;
  environment_url: string;
  started_by: string;
  started_at: Date | null;
  completed_at: Date | null;
  duration_seconds: number | null;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  skipped_executions: number;
  total_personas_tested: number;
  total_flows_tested: number;
  avg_friction_score: number;
  is_pinned: boolean;
}

/**
 * Complete narrative report data
 */
export interface NarrativeReport {
  run_summary: RunSummary;
  persona_summaries: PersonaSummary[];
  accessibility_summary: AccessibilitySummary;
  issues: DeduplicatedIssue[];
  friction_signals: FrictionSignalAggregate[];
}
