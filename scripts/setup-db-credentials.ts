#!/usr/bin/env tsx
/**
 * Interactive Database Credential Setup Script
 * 
 * This script prompts for database credentials at runtime and saves them to .env file.
 * Run this before starting the application to configure database credentials for each environment.
 * 
 * Usage: tsx scripts/setup-db-credentials.ts [environment]
 *   environment: development | staging | production (default: development)
 */

import * as fs from 'fs';
import * as readline from 'readline';

interface DbCredentials {
  POSTGRES_HOST: string;
  POSTGRES_PORT: string;
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  [key: string]: string;
}

const ENV_FILE = '.env';
const ENV_FILES = {
  development: '.env',
  staging: '.env.staging',
  production: '.env.production',
};

function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
}

function questionHidden(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    // Pause readline so it stops consuming stdin before we take raw mode
    rl.pause();

    // Disable echo
    stdin.setRawMode(true);
    stdout.write(query);

    let password = '';

    const onData = (char: Buffer) => {
      const charStr = char.toString();

      if (charStr === '\n' || charStr === '\r' || charStr === '\u0004') {
        // Enter or Ctrl-D
        stdin.setRawMode(false);
        stdin.removeListener('data', onData);
        stdout.write('\n');
        rl.resume();
        resolve(password);
      } else if (charStr === '\u0003') {
        // Ctrl-C
        stdin.setRawMode(false);
        stdin.removeListener('data', onData);
        stdout.write('\n');
        process.exit(1);
      } else if (charStr === '\u007f') {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdout.write('\b \b');
        }
      } else {
        // Regular character
        password += charStr;
        stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

function loadExistingEnv(envFile: string): Record<string, string> {
  if (!fs.existsSync(envFile)) {
    return {};
  }

  const content = fs.readFileSync(envFile, 'utf-8');
  const env: Record<string, string> = {};
  
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  }
  
  return env;
}

function saveEnv(envFile: string, env: Record<string, string>): void {
  const lines: string[] = [];
  
  // Read existing file to preserve comments and order
  if (fs.existsSync(envFile)) {
    const existingContent = fs.readFileSync(envFile, 'utf-8');
    const existingLines = existingContent.split('\n');
    const seenKeys = new Set<string>();
    
    for (const line of existingLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed) {
        lines.push(line);
      } else {
        const [key] = trimmed.split('=');
        if (key && env[key.trim()] !== undefined) {
          lines.push(`${key.trim()}=${env[key.trim()]}`);
          seenKeys.add(key.trim());
        } else {
          // Preserve all existing vars not being updated
          lines.push(line);
        }
      }
    }
    
    // Add new keys
    for (const [key, value] of Object.entries(env)) {
      if (!seenKeys.has(key)) {
        lines.push(`${key}=${value}`);
      }
    }
  } else {
    // New file
    for (const [key, value] of Object.entries(env)) {
      lines.push(`${key}=${value}`);
    }
  }
  
  fs.writeFileSync(envFile, lines.join('\n') + '\n');
}

async function promptCredentials(
  rl: readline.Interface,
  existing: Record<string, string>,
  environment: string
): Promise<DbCredentials> {
  console.log(`\n=== Database Credential Setup for ${environment.toUpperCase()} ===\n`);
  console.log('Press Enter to accept existing values (shown in brackets).\n');

  const host = await question(
    rl,
    `PostgreSQL Host [${existing.POSTGRES_HOST || 'postgres'}]: `
  ) || existing.POSTGRES_HOST || 'postgres';

  const port = await question(
    rl,
    `PostgreSQL Port [${existing.POSTGRES_PORT || '5432'}]: `
  ) || existing.POSTGRES_PORT || '5432';

  const dbName = await question(
    rl,
    `PostgreSQL Database Name [${existing.POSTGRES_DB || 'qa_platform'}]: `
  ) || existing.POSTGRES_DB || 'qa_platform';

  const user = await question(
    rl,
    `PostgreSQL User [${existing.POSTGRES_USER || 'qa_user'}]: `
  ) || existing.POSTGRES_USER || 'qa_user';

  console.log('\n---');
  const rawPassword = await questionHidden(
    rl,
    `PostgreSQL Password [${existing.POSTGRES_PASSWORD ? '(already set)' : 'required'}]: `
  ) || existing.POSTGRES_PASSWORD;

  if (!rawPassword) {
    console.log('\nError: PostgreSQL password is required.');
    process.exit(1);
  }

  // Strip surrounding quotes that may exist in the .env value before length check
  const password = rawPassword.replace(/^["']|["']$/g, '');

  if (password.length < 8) {
    console.log('\nError: PostgreSQL password must be at least 8 characters.');
    process.exit(1);
  }

  return {
    POSTGRES_HOST: host,
    POSTGRES_PORT: port,
    POSTGRES_DB: dbName,
    POSTGRES_USER: user,
    POSTGRES_PASSWORD: password,
  };
}

async function main() {
  const environment = process.argv[2] || 'development';

  if (!['development', 'staging', 'production'].includes(environment)) {
    console.error(`Invalid environment: ${environment}`);
    console.error('Valid environments: development, staging, production');
    process.exit(1);
  }

  const envFile = ENV_FILES[environment as keyof typeof ENV_FILES];

  console.log(`Setting up database credentials for ${environment.toUpperCase()}`);
  console.log(`Credentials will be saved to: ${envFile}\n`);

  const rl = createReadline();
  const existingEnv = loadExistingEnv(envFile);

  const credentials = await promptCredentials(rl, existingEnv, environment);
  rl.close();

  // Save credentials to env file
  saveEnv(envFile, credentials);

  console.log('\n=== Database Credentials Saved ===\n');
  console.log(`File: ${envFile}`);
  console.log('Credentials:');
  console.log(`  POSTGRES_HOST=${credentials.POSTGRES_HOST}`);
  console.log(`  POSTGRES_PORT=${credentials.POSTGRES_PORT}`);
  console.log(`  POSTGRES_DB=${credentials.POSTGRES_DB}`);
  console.log(`  POSTGRES_USER=${credentials.POSTGRES_USER}`);
  console.log(`  POSTGRES_PASSWORD=********\n`);
  
  console.log('You can now start the application with:');
  console.log(`  docker compose --env-file ${envFile} up\n`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
