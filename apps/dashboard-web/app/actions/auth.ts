'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hashPassword, verifyPassword, createSession, revokeSession } from '@qa-platform/auth';
import { invokeProc } from '@qa-platform/db';

export interface LoginResult {
  success: boolean;
  error?: string;
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

    // Create session
    const session = await createSession(
      operator.o_id,
      '127.0.0.1', // TODO: Get real IP from request
      'User-Agent', // TODO: Get real user agent from request
      login
    );

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set('session_token', session.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 days
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
  operatorId?: number;
  sessionId?: number;
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
