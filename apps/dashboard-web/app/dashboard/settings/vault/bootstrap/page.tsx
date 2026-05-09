'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { bootstrapVaultAction, getVaultStateAction } from '../../../../actions/vault';

export default function VaultBootstrapPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isBootstrapped, setIsBootstrapped] = useState(false);

  useEffect(() => {
    async function checkVaultState() {
      const state = await getVaultStateAction();
      if (state.isBootstrapped) {
        setIsBootstrapped(true);
        router.push('/dashboard/settings/vault');
      }
    }
    checkVaultState();
  }, [router]);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);

    const masterPassword = formData.get('masterPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    const result = await bootstrapVaultAction(masterPassword, confirmPassword);

    setLoading(false);

    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || 'Vault bootstrap failed');
    }
  }

  if (isBootstrapped) {
    return null; // Will redirect
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Bootstrap Vault</h1>
        <p className="text-zinc-600 mt-1">
          Initialize the vault with a master password. This password will be used to encrypt all secrets.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
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
              minLength={12}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter a master password (min 12 characters)"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Must be at least 12 characters long. Store this password securely - it cannot be recovered.
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              required
              minLength={12}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Confirm your master password"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
            >
              {loading ? 'Bootstrapping...' : 'Bootstrap Vault'}
            </button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">Important Security Notes</h3>
          <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
            <li>The master password is used to derive encryption keys for all secrets</li>
            <li>There is no password recovery mechanism - if you lose it, you lose access to all secrets</li>
            <li>Use a strong, unique password that you don't use elsewhere</li>
            <li>Consider using a password manager to store this password</li>
          </ul>
        </div>
      </div>

      <div className="mt-4">
        <Link
          href="/dashboard/settings"
          className="text-sm text-blue-600 hover:underline"
        >
          Back to Settings
        </Link>
      </div>
    </div>
  );
}
