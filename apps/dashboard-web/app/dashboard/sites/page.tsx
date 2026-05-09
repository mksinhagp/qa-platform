'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { listSites, type Site } from '@/app/actions/sites';
import { Button } from '@/components/ui/button';
import {
  Globe,
  Layers,
  Plus,
  ArrowRight,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSites();
  }, []);

  async function loadSites() {
    try {
      setLoading(true);
      const result = await listSites();
      if (result.success && result.sites) {
        setSites(result.sites);
      } else {
        setError(result.error ?? 'Failed to load sites');
      }
    } catch {
      setError('An error occurred while loading sites');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-zinc-900">Sites</h1>
          <Link href="/dashboard/sites/new">
            <Button>
              <Plus className="w-4 h-4 mr-1" /> New Site
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading sites…
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">{error}</div>
        ) : sites.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-12 text-center">
            <Globe className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-zinc-700 mb-1">No sites yet</h2>
            <p className="text-sm text-zinc-500 mb-4">
              Add your first booking site to start running QA tests.
            </p>
            <Link href="/dashboard/sites/new">
              <Button>
                <Plus className="w-4 h-4 mr-1" /> Add site
              </Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-600">Site</th>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-600">Base URL</th>
                  <th className="px-4 py-3 text-center font-semibold text-zinc-600">Environments</th>
                  <th className="px-4 py-3 text-center font-semibold text-zinc-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {sites.map(site => (
                  <tr key={site.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="font-medium text-zinc-900">{site.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">{site.base_url}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-zinc-600">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{site.env_count ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {site.is_active ? (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-500 text-xs font-medium px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/sites/${site.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs font-medium"
                      >
                        Details <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
