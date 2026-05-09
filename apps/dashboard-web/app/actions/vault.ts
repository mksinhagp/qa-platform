'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getVaultState, bootstrapVault, unlockVault, lockVault } from '@qa-platform/vault';
import { getSession } from './auth';

export interface VaultBootstrapResult {
  success: boolean;
  error?: string;
  unlockToken?: string;
}

export interface VaultUnlockResult {
  success: boolean;
  error?: string;
  unlockToken?: string;
}

export async function bootstrapVaultAction(
  masterPassword: string,
  confirmPassword: string
): Promise<VaultBootstrapResult> {
  // Validate password length
  if (masterPassword.length < 12) {
    return { success: false, error: 'Password must be at least 12 characters' };
  }

  // Validate password match
  if (masterPassword !== confirmPassword) {
    return { success: false, error: 'Passwords do not match' };
  }

  try {
    const session = await getSession();

    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if vault is already bootstrapped
    const state = await getVaultState();
    if (state.isBootstrapped) {
      return { success: false, error: 'Vault is already bootstrapped' };
    }

    // Bootstrap vault
    const result = await bootstrapVault(
      masterPassword,
      session.operatorId,
      session.sessionId
    );

    if (!result.success) {
      return { success: false, error: 'Failed to bootstrap vault' };
    }

    // Set unlock token cookie
    if (result.unlockToken) {
      const cookieStore = await cookies();
      cookieStore.set('unlock_token', result.unlockToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 30, // 30 minutes
        path: '/',
      });
    }

    return { success: true, unlockToken: result.unlockToken };
  } catch (error) {
    console.error('Vault bootstrap error:', error);
    return { success: false, error: 'An error occurred during vault bootstrap' };
  }
}

export async function unlockVaultAction(
  masterPassword: string
): Promise<VaultUnlockResult> {
  try {
    const session = await getSession();

    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if vault is bootstrapped
    const state = await getVaultState();
    if (!state.isBootstrapped) {
      return { success: false, error: 'Vault is not bootstrapped' };
    }

    // Unlock vault
    const result = await unlockVault(
      masterPassword,
      session.sessionId,
      session.operatorId
    );

    if (!result.success) {
      return { success: false, error: 'Invalid master password' };
    }

    // Set unlock token cookie
    if (result.unlockToken) {
      const cookieStore = await cookies();
      cookieStore.set('unlock_token', result.unlockToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 30, // 30 minutes
        path: '/',
      });
    }

    return { success: true, unlockToken: result.unlockToken };
  } catch (error) {
    console.error('Vault unlock error:', error);
    return { success: false, error: 'An error occurred during vault unlock' };
  }
}

export async function lockVaultAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();

    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const cookieStore = await cookies();
    const unlockToken = cookieStore.get('unlock_token')?.value;

    if (!unlockToken) {
      return { success: false, error: 'Vault is not unlocked' };
    }

    // Lock vault
    await lockVault(unlockToken, session.operatorId);

    // Clear unlock token cookie
    cookieStore.delete('unlock_token');

    return { success: true };
  } catch (error) {
    console.error('Vault lock error:', error);
    return { success: false, error: 'An error occurred during vault lock' };
  }
}

export async function getVaultStateAction() {
  try {
    const state = await getVaultState();
    return state;
  } catch (error) {
    console.error('Get vault state error:', error);
    return { isBootstrapped: false, kdfMemory: 0, kdfIterations: 0, kdfParallelism: 0 };
  }
}

export async function isVaultUnlocked(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const unlockToken = cookieStore.get('unlock_token')?.value;

    if (!unlockToken) {
      return false;
    }

    const { validateUnlockSession } = await import('@qa-platform/vault');
    return await validateUnlockSession(unlockToken);
  } catch (error) {
    console.error('Vault unlock check error:', error);
    return false;
  }
}
