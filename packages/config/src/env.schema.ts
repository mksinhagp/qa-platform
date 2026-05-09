import { z } from "zod";

// Environment variable schema
export const envSchema = z.object({
  // Application Environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Dashboard Web (Next.js)
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DASHBOARD_PORT: z.coerce.number().int().positive().default(3000),
  DASHBOARD_SESSION_SECRET: z
    .string()
    .min(32, "Session secret must be at least 32 characters"),

  // PostgreSQL
  POSTGRES_HOST: z.string().default("postgres"),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().default("qa_platform"),
  POSTGRES_USER: z.string().default("qa_user"),
  POSTGRES_PASSWORD: z.string().min(8, "PostgreSQL password must be at least 8 characters"),
  POSTGRES_SSL_MODE: z.enum(["disable", "require", "prefer"]).default("disable"),

  // Vault (Argon2id + AES-256-GCM)
  VAULT_BOOTSTRAP_REQUIRED: z.coerce.boolean().default(true),
  VAULT_MASTER_PASSWORD_MIN_LENGTH: z.coerce.number().int().positive().default(12),
  VAULT_UNLOCK_TTL_SECONDS: z.coerce.number().int().positive().default(1800),
  VAULT_UNLOCK_IDLE_RESET_SECONDS: z.coerce.number().int().positive().default(300),
  VAULT_ARGON2ID_MEMORY: z.coerce.number().int().positive().default(131072),
  VAULT_ARGON2ID_ITERATIONS: z.coerce.number().int().positive().default(3),
  VAULT_ARGON2ID_PARALLELISM: z.coerce.number().int().positive().default(2),
  VAULT_ARGON2ID_SALT_LENGTH: z.coerce.number().int().positive().default(16),

  // Runner Service
  RUNNER_HOST: z.string().default("runner"),
  RUNNER_PORT: z.coerce.number().int().positive().default(4000),
  RUNNER_API_BASE_URL: z.string().url().default("http://runner:4000"),
  RUNNER_CONCURRENCY_CAP: z.coerce.number().int().positive().default(4),

  // Artifacts
  ARTIFACT_ROOT_PATH: z.string().default("/artifacts"),
  ARTIFACT_RETENTION_TRACE_DAYS: z.coerce.number().int().positive().default(30),
  ARTIFACT_RETENTION_VIDEO_DAYS: z.coerce.number().int().positive().default(30),
  ARTIFACT_RETENTION_SCREENSHOT_DAYS: z.coerce.number().int().positive().default(90),
  ARTIFACT_RETENTION_HAR_DAYS: z.coerce.number().int().positive().default(30),
  ARTIFACT_RETENTION_LOG_DAYS: z.coerce.number().int().positive().default(90),
  ARTIFACT_RETENTION_MP4_DAYS: z.coerce.number().int().positive().default(180),
  ARTIFACT_RETENTION_RECORD_DAYS: z.coerce.number().int().positive().default(365),

  // Ollama (Local LLM)
  OLLAMA_ENABLED: z.coerce.boolean().default(false),
  OLLAMA_BASE_URL: z.string().url().default("http://ollama:11434"),
  OLLAMA_FAST_MODEL: z.string().default("llama3.1:8b"),
  OLLAMA_RICH_MODEL: z.string().default("qwen2.5:14b"),

  // Email Integration
  EMAIL_ENABLED: z.coerce.boolean().default(false),
  EMAIL_DEFAULT_IMAP_HOST: z.string().default("imap.example.com"),
  EMAIL_DEFAULT_IMAP_PORT: z.coerce.number().int().positive().default(993),
  EMAIL_DEFAULT_IMAP_SECURE: z.coerce.boolean().default(true),

  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  LOG_FORMAT: z.enum(["json", "text"]).default("json"),

  // Feature Flags
  FEATURE_ACCESSIBILITY: z.coerce.boolean().default(true),
  FEATURE_PERSONA_ENGINE: z.coerce.boolean().default(true),
  FEATURE_MATRIX_RUNS: z.coerce.boolean().default(true),
  FEATURE_APPROVALS: z.coerce.boolean().default(true),

  // Auth (Custom)
  AUTH_SESSION_IDLE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(28800),
  AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(2592000),
  AUTH_PASSWORD_MIN_LENGTH: z.coerce.number().int().positive().default(8),
  AUTH_PASSWORD_REQUIRE_SPECIAL: z.coerce.boolean().default(true),
  AUTH_PASSWORD_REQUIRE_NUMBER: z.coerce.boolean().default(true),

  // Business Rules
  BUSINESS_RULES_PATH: z.string().default("./sites"),

  // Docker Compose Override
  COMPOSE_PROFILES: z.string().default("default"),
});

export type Env = z.infer<typeof envSchema>;
