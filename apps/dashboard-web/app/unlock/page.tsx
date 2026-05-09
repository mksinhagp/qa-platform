'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { unlockVaultAction, getVaultStateAction } from '../actions/vault';

export default function UnlockPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isBootstrapped, setIsBootstrapped] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkVaultState() {
      const state = await getVaultStateAction();
      setIsBootstrapped(state.isBootstrapped);
      if (!state.isBootstrapped) {
        router.push('/dashboard/settings/vault/bootstrap');
      }
    }
    checkVaultState();
  }, [router]);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);

    const masterPassword = formData.get('masterPassword') as string;

    const result = await unlockVaultAction(masterPassword);

    setLoading(false);

    if (result.success) {
      // Redirect to the page that requested unlock (or dashboard)
      const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') || '/dashboard';
      router.push(returnUrl);
    } else {
      setError(result.error || 'Invalid master password');
    }
  }

  if (isBootstrapped === null) {
    return null; // Loading state
  }

  if (!isBootstrapped) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-6">Unlock Vault</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="masterPassword" className="block text-sm font-medium text-zinc-700 mb-1">
              Master Password
            </label>
            <input
              type="password"
              id="masterPassword"
              name="masterPassword"
              required
              className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter master password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
          >
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-600">
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
