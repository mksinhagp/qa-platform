import { z } from "zod";
import { envSchema, type Env } from "./env.schema";

let cachedEnv: Env | null = null;

/**
 * Parse and validate environment variables using Zod schema.
 * This should be called once at application startup.
 *
 * @throws {z.ZodError} If environment variables are invalid
 * @returns Parsed and validated environment variables
 */
export function loadEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      console.error("❌ Invalid environment variables:");
      result.error.errors.forEach((error) => {
        console.error(`  - ${error.path.join(".")}: ${error.message}`);
      });
      throw result.error;
    }

    cachedEnv = result.data;
    return cachedEnv;
  } catch (error) {
    console.error("Failed to load environment variables");
    throw error;
  }
}

/**
 * Get the current environment configuration.
 * Must call loadEnv() first.
 *
 * @throws {Error} If loadEnv() has not been called
 * @returns Current environment configuration
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    throw new Error("loadEnv() must be called before getEnv()");
  }
  return cachedEnv;
}

/**
 * Reset the cached environment (useful for testing).
 */
export function resetEnv(): void {
  cachedEnv = null;
}

export { envSchema, type Env };
