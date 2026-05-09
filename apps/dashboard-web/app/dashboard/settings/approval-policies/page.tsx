'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/app-shell';
import { listApprovalPolicies, type ApprovalPolicy } from '@/app/actions/approval-policies';
import { Shield, ShieldCheck, ShieldAlert, ShieldOff, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

function getStrengthBadge(strength: string) {
  switch (strength) {
    case 'none':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700">
          <ShieldOff className="h-3 w-3" />
          None
        </span>
      );
    case 'one_click':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <ShieldCheck className="h-3 w-3" />
          One-Click
        </span>
      );
    case 'strong':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <ShieldAlert className="h-3 w-3" />
          Strong
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
          {strength}
        </span>
      );
  }
}

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function ApprovalPoliciesPage() {
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPolicies();
  }, []);

  async function loadPolicies() {
    try {
      setLoading(true);
      setError(null);
      const result = await listApprovalPolicies();
      if (result.success && result.policies) {
        setPolicies(result.policies);
      } else {
        setError(result.error || 'Failed to load approval policies');
      }
    } catch (err) {
      setError('An error occurred while loading approval policies');
    } finally {
      setLoading(false);
    }
  }

  const noneCount = policies.filter((p) => p.default_strength === 'none').length;
  const oneClickCount = policies.filter((p) => p.default_strength === 'one_click').length;
  const strongCount = policies.filter((p) => p.default_strength === 'strong').length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Approval Policies</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Default approval strength for each action category. Overrides per site environment can be configured in future releases.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadPolicies}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {!loading && policies.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-4">
              <div className="flex items-center gap-2">
                <ShieldOff className="h-5 w-5 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-600">No Approval</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900">{noneCount}</p>
              <p className="text-xs text-zinc-400">categories</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium text-zinc-600">One-Click</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900">{oneClickCount}</p>
              <p className="text-xs text-zinc-400">categories</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-medium text-zinc-600">Strong</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900">{strongCount}</p>
              <p className="text-xs text-zinc-400">categories</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Action Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Default Strength
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                    Loading approval policies...
                  </td>
                </tr>
              ) : policies.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                    No approval policies found. Run the seed script to load defaults.
                  </td>
                </tr>
              ) : (
                policies.map((policy) => (
                  <tr key={policy.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm font-medium text-zinc-900">
                          {formatCategory(policy.action_category)}
                        </span>
                      </div>
                      <span className="ml-6 text-xs text-zinc-400 font-mono">
                        {policy.action_category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStrengthBadge(policy.default_strength)}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600 max-w-md">
                      {policy.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {policy.is_system ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
                          System
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
                          Custom
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-medium">About Approval Tiers</p>
            <ul className="mt-1 list-disc list-inside space-y-1 text-blue-600">
              <li><strong>None</strong> - Action proceeds automatically with no operator intervention.</li>
              <li><strong>One-Click</strong> - Operator sees a confirmation card and approves with a single click.</li>
              <li><strong>Strong</strong> - Operator must provide a typed reason and/or re-confirm credentials before the action proceeds.</li>
            </ul>
            <p className="mt-2 text-blue-500">
              Per-site environment overrides will be available in a future release.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
