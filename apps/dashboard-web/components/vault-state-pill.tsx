'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Unlock, AlertCircle } from 'lucide-react';
import { lockVaultAction, isVaultUnlocked } from '../app/actions/vault';

export function VaultStatePill() {
  const router = useRouter();
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);
  const [isBootstrapped, setIsBootstrapped] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkState() {
      const unlocked = await isVaultUnlocked();
      setIsUnlocked(unlocked);

      // Check if bootstrapped by trying to get vault state
      try {
        const { getVaultState } = await import('@qa-platform/vault');
        const state = await getVaultState();
        setIsBootstrapped(state.isBootstrapped);
      } catch (error) {
        setIsBootstrapped(false);
      }
    }
    checkState();

    // Poll every 30 seconds
    const interval = setInterval(checkState, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleLock() {
    setLoading(true);
    await lockVaultAction();
    setIsUnlocked(false);
    setLoading(false);
  }

  async function handleUnlock() {
    router.push('/unlock');
  }

  async function handleBootstrap() {
    router.push('/dashboard/settings/vault/bootstrap');
  }

  if (isBootstrapped === null || isUnlocked === null) {
    return null; // Loading state
  }

  if (!isBootstrapped) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 border border-yellow-300 rounded-full text-yellow-800 text-sm">
        <AlertCircle className="w-4 h-4" />
        <span>Vault not initialized</span>
        <button
          onClick={handleBootstrap}
          className="ml-1 text-yellow-900 hover:text-yellow-700 font-medium"
        >
          Bootstrap
        </button>
      </div>
    );
  }

  if (isUnlocked) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 border border-green-300 rounded-full text-green-800 text-sm">
        <Unlock className="w-4 h-4" />
        <span>Vault unlocked</span>
        <button
          onClick={handleLock}
          disabled={loading}
          className="ml-1 text-green-900 hover:text-green-700 font-medium disabled:opacity-50"
        >
          {loading ? 'Locking...' : 'Lock'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 border border-red-300 rounded-full text-red-800 text-sm">
      <Lock className="w-4 h-4" />
      <span>Vault locked</span>
      <button
        onClick={handleUnlock}
        className="ml-1 text-red-900 hover:text-red-700 font-medium"
      >
        Unlock
      </button>
    </div>
  );
}
