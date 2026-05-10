'use server';

import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyPassword, createSession, revokeSession, hashPassword } from '@qa-platform/auth';
import { invokeProc, initializePool } from '@qa-platform/db';
import { getEnv, loadEnv } from '@qa-platform/config';

// Load env and initialize PostgreSQL pool for server actions
try {
  loadEnv();
  initializePool();
  console.log('PostgreSQL pool initialized successfully');
} catch (error) {
  console.error('Failed to initialize PostgreSQL pool:', error);
}

export interface LoginResult {
  success: boolean;
  error?: string;
}

// Lazily computed sentinel hash for timing-safe login responses
let sentinelHashPromise: Promise<string> | null = null;
function getSentinelHash(): Promise<string> {
  if (!sentinelHashPromise) {
    sentinelHashPromise = hashPassword('__timing_safe_sentinel__');
  }
  return sentinelHashPromise;
}

export async function login(
  login: string,
  password: string
): Promise<LoginResult> {
  try {
    // Get operator by login
    const result = await invokeProc('sp_operators_get_by_login', {
      i_login: login,
    });

    if (result.length === 0) {
      // Perform a dummy verify to prevent timing-based login enumeration
      await verifyPassword(password, await getSentinelHash());
      return { success: false, error: 'Invalid login or password' };
    }

    const operator = result[0];

    // Check if operator is active
    if (!operator.o_active) {
      return { success: false, error: 'Operator account is inactive' };
    }

    // Verify password
    const verifyResult = await verifyPassword(password, operator.o_password_hash);

    if (!verifyResult.isValid) {
      return { success: false, error: 'Invalid login or password' };
    }

    const headerStore = await headers();
    const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ipAddress = forwardedFor || headerStore.get('x-real-ip') || undefined;
    const userAgent = headerStore.get('user-agent') || undefined;
    const env = (() => {
      try {
        return getEnv();
      } catch {
        return loadEnv();
      }
    })();

    // Create session
    const session = await createSession(
      operator.o_id,
      ipAddress,
      userAgent,
      login
    );

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set('session_token', session.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: env.AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS,
      path: '/',
    });

    return { success: true };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'An error occurred during login' };
  }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;

  if (sessionToken) {
    try {
      await revokeSession(sessionToken, 'operator');
    } catch (error) {
      console.error('Logout error:', error);
    }

    cookieStore.delete('session_token');
  }

  redirect('/login');
}

export async function getSession(): Promise<{
  operatorId: number;
  sessionId: number;
} | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;

  if (!sessionToken) {
    return null;
  }

  try {
    const { validateSession } = await import('@qa-platform/auth');
    const validation = await validateSession(sessionToken);

    if (!validation.isValid || !validation.operatorId || !validation.sessionId) {
      return null;
    }

    return {
      operatorId: validation.operatorId,
      sessionId: validation.sessionId,
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}
