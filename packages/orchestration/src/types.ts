// Orchestration types for Phase 20

export type CampaignType = 'smoke' | 'regression' | 'release_certification' | 'payment_certification' | 'accessibility_audit' | 'email_deliverability';

export type ExecutionType = 'manual' | 'scheduled' | 'webhook';

export type ScheduleType = 'manual' | 'nightly' | 'pre_release' | 'webhook' | 'cron';

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type SignoffType = 'pass' | 'fail' | 'conditional_pass' | 'exception';

export interface QaCampaign {
  id: number;
  name: string;
  campaignType: CampaignType;
  description?: string;
  siteId?: number;
  siteEnvironmentId?: number;
  personaIds?: number[];
  deviceProfileIds?: number[];
  networkProfileIds?: number[];
  browserTypes?: string[];
  paymentScenarioIds?: number[];
  emailProviderIds?: number[];
  flowTypes?: string[];
  concurrencyCap: number;
  retryOnFailure: boolean;
  maxRetries: number;
  requiresApproval: boolean;
  approvalPolicyId?: number;
  isActive: boolean;
  createdDate: Date;
  updatedDate: Date;
}

export interface CampaignScenario {
  id: number;
  campaignId: number;
  personaId?: number;
  deviceProfileId?: number;
  networkProfileId?: number;
  browserType?: string;
  paymentScenarioId?: number;
  emailProviderId?: number;
  flowType?: string;
  scenarioHash: string;
  isActive: boolean;
  createdDate: Date;
  updatedDate: Date;
}

export interface CampaignSchedule {
  id: number;
  campaignId: number;
  scheduleType: ScheduleType;
  scheduleConfig?: Record<string, unknown>;
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdDate: Date;
  updatedDate: Date;
}

export interface CampaignExecution {
  id: number;
  campaignId: number;
  runId?: number;
  executionType: ExecutionType;
  triggeredBy: string;
  triggeredByOperatorId?: number;
  status: ExecutionStatus;
  totalScenarios: number;
  executedScenarios: number;
  successfulScenarios: number;
  failedScenarios: number;
  skippedScenarios: number;
  startedAt?: Date;
  completedAt?: Date;
  durationSeconds?: number;
  errorMessage?: string;
  approvalId?: number;
  createdDate: Date;
  updatedDate: Date;
}

export interface CampaignSignoff {
  id: number;
  runId: number;
  campaignId?: number;
  signoffType: SignoffType;
  signedByOperatorId?: number;
  signoffDate: Date;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  unresolvedDefects: number;
  notes?: string;
  exceptionReason?: string;
  knownIssues?: string[];
  approvalId?: number;
  createdDate: Date;
  updatedDate: Date;
}

export interface MatrixGenerationResult {
  totalScenarios: number;
  generated: number;
  skipped: number;
  scenarios: CampaignScenario[];
}
