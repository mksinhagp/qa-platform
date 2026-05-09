'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/app-shell';
import { queryAuditLogs, type AuditLogEntry } from '@/app/actions/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, CheckCircle, XCircle, AlertCircle, Search } from 'lucide-react';

const STATUS_ICONS = {
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
  failure: <XCircle className="h-4 w-4 text-red-500" />,
  error: <AlertCircle className="h-4 w-4 text-amber-500" />,
};

const STATUS_COLORS = {
  success: 'bg-green-100 text-green-800',
  failure: 'bg-red-100 text-red-800',
  error: 'bg-amber-100 text-amber-800',
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    actor_id: '',
    action: '',
    target: '',
    status: '',
  });

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    try {
      setLoading(true);
      const result = await queryAuditLogs(
        filters.actor_id || undefined,
        filters.action || undefined,
        filters.target || undefined,
        filters.status || undefined,
        100
      );
      if (result.success && result.logs) {
        setLogs(result.logs);
      } else {
        setError(result.error || 'Failed to load audit logs');
      }
    } catch (err) {
      setError('An error occurred while loading audit logs');
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(key: keyof typeof filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleSearch() {
    loadLogs();
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  function getStatusIcon(status: string) {
    return STATUS_ICONS[status as keyof typeof STATUS_ICONS] || STATUS_ICONS.error;
  }

  function getStatusColor(status: string) {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.error;
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-zinc-900">Audit Log</h1>
          <Button
            variant="outline"
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-zinc-500" />
            <span className="text-sm font-medium text-zinc-700">Filters</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label htmlFor="actor_id" className="text-xs">Actor ID</Label>
              <Input
                id="actor_id"
                type="text"
                value={filters.actor_id}
                onChange={(e) => handleFilterChange('actor_id', e.target.value)}
                placeholder="Operator ID"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="action" className="text-xs">Action</Label>
              <Input
                id="action"
                type="text"
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                placeholder="e.g., login, vault.unlock"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="target" className="text-xs">Target</Label>
              <Input
                id="target"
                type="text"
                value={filters.target}
                onChange={(e) => handleFilterChange('target', e.target.value)}
                placeholder="e.g., credential:123"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status" className="text-xs">Status</Label>
              <select
                id="status"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="flex h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
              >
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSearch} disabled={loading} size="sm">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Apply Filters'
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Results */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-500 font-mono">
                      {formatDate(log.created_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-900">
                      <span className="px-2 py-0.5 bg-zinc-100 rounded text-xs">
                        {log.actor_type}:{log.actor_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-zinc-900">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-600">
                      <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">{log.target}</code>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                        {getStatusIcon(log.status)}
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500 max-w-xs truncate">
                      {log.details ? (
                        <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">{log.details}</code>
                      ) : (
                        '-'
                      )}
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
