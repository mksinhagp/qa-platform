'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/components/app-shell';
import { listCredentials, type Credential } from '@/app/actions/credentials';
import { listSites, type Site } from '@/app/actions/sites';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [sites, setSites] = useState<Record<number, Site>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [revealedValues, setRevealedValues] = useState<Record<number, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [credResult, sitesResult] = await Promise.all([
        listCredentials(),
        listSites(),
      ]);

      if (credResult.success && credResult.credentials) {
        setCredentials(credResult.credentials);
      } else {
        setError(credResult.error || 'Failed to load credentials');
      }

      if (sitesResult.success && sitesResult.sites) {
        const sitesMap: Record<number, Site> = {};
        sitesResult.sites.forEach((site) => {
          sitesMap[site.id] = site;
        });
        setSites(sitesMap);
      }
    } catch (err) {
      setError('An error occurred while loading data');
    } finally {
      setLoading(false);
    }
  }

  async function handleReveal(id: number) {
    if (revealedValues[id]) {
      // Hide
      setRevealedValues((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    setRevealingId(id);
    try {
      const { getCredentialWithValue } = await import('@/app/actions/credentials');
      const result = await getCredentialWithValue(id);
      if (result.success && result.credential) {
        setRevealedValues((prev) => ({
          ...prev,
          [id]: result.credential!.credential_value,
        }));
      } else {
        setError(result.error || 'Failed to reveal credential');
      }
    } catch (err) {
      setError('Failed to reveal credential');
    } finally {
      setRevealingId(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-zinc-900">Site Credentials</h1>
          <Link href="/dashboard/settings/credentials/new">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Credential
            </Button>
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Site
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Credential Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    Loading credentials...
                  </td>
                </tr>
              ) : credentials.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    No credentials found. Create your first credential to get started.
                  </td>
                </tr>
              ) : (
                credentials.map((credential) => (
                  <tr key={credential.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-900">
                      {sites[credential.site_id]?.name || `Site ${credential.site_id}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">
                      {credential.role_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600 font-mono">
                      {revealedValues[credential.id] ? (
                        <span className="text-zinc-900">{revealedValues[credential.id]}</span>
                      ) : (
                        <span className="text-zinc-400">••••••••</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {credential.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="h-3 w-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReveal(credential.id)}
                          disabled={revealingId === credential.id}
                        >
                          {revealingId === credential.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : revealedValues[credential.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Link href={`/dashboard/settings/credentials/${credential.id}`}>
                          <Button variant="ghost" size="sm" className="flex items-center gap-1">
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
