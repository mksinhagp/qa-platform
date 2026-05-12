// Test data management types for Phase 19

export interface TestIdentity {
  id: number;
  runExecutionId: number;
  personaId?: number;
  siteId: number;
  siteEnvironmentId: number;
  identityType: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  username?: string;
  phone?: string;
  dateOfBirth?: Date;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  customFields?: Record<string, unknown>;
  isActive: boolean;
  createdDate: Date;
  updatedDate: Date;
}

export interface TestDataLedgerEntry {
  id: number;
  runExecutionId: number;
  dataType: string;
  dataCategory: string;
  entityId?: number;
  entityType?: string;
  identifier: string;
  identifierType: string;
  siteId?: number;
  siteEnvironmentId?: number;
  personaId?: number;
  dataJson?: Record<string, unknown>;
  sensitiveFields?: string[];
  cleanupStatus: 'pending' | 'cleanup_requested' | 'cleanup_completed' | 'cleanup_failed' | 'cleanup_skipped';
  cleanupRequestedAt?: Date;
  cleanupCompletedAt?: Date;
  cleanupErrorMessage?: string;
  retentionDays: number;
  expiresAt: Date;
  isCleanupEligible: boolean;
  createdDate: Date;
  updatedDate: Date;
}

export interface CleanupJob {
  id: number;
  jobType: string;
  jobName: string;
  triggeredBy: string;
  triggeredByOperatorId?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  filters?: Record<string, unknown>;
  dryRun: boolean;
  totalRecordsReviewed: number;
  totalRecordsEligible: number;
  totalRecordsDeleted: number;
  totalRecordsFailed: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  approvalId?: number;
  createdDate: Date;
  updatedDate: Date;
}

export interface DataRedactionRule {
  id: number;
  fieldName: string;
  fieldType: string;
  redactionPattern: string;
  replacementPattern: string;
  appliesToTables: string[];
  isActive: boolean;
  priority: number;
  description?: string;
  createdDate: Date;
  updatedDate: Date;
}

export interface IdentityGeneratorOptions {
  runExecutionId: number;
  personaId?: number;
  siteId: number;
  siteEnvironmentId: number;
  identityType: string;
  customFields?: Record<string, unknown>;
  seed?: string; // For deterministic generation
}

export interface CollisionAvoidanceOptions {
  runExecutionId: number;
  identifierType: 'email' | 'username' | 'phone' | 'custom';
  identifier: string;
  siteId?: number;
}

export interface RedactionOptions {
  data: Record<string, unknown>;
  rules: DataRedactionRule[];
  tableName: string;
}
