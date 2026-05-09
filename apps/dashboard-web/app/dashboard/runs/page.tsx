'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { listRuns, type Run } from '@/app/actions/runs';
import { Button } from '@/components/ui/button';
import {
  PlayCircle,
  Plus,
  ArrowRight,
  CheckCircle,
  XCircle,
  Loader2,
  SkipForward,
  Clock,
} from 'lucide-react';

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return (
        <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Running
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
          <CheckCircle className="w-3 h-3" /> Completed
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
          <XCircle className="w-3 h-3" /> Failed
        </span>
      );
    case 'aborted':
      return (
        <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-500 text-xs font-medium px-2 py-0.5 rounded-full">
          <XCircle className="w-3 h-3" /> Aborted
        </span>
      );
    case 'paused_for_approval':
      return (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3" /> Awaiting Approval
        </span>
      );
    case 'awaiting_approval':
      return (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3" /> Awaiting Approval
        </span>
      );
    case 'draft':
    default:
      return (
        <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-500 text-xs font-medium px-2 py-0.5 rounded-full">
          Draft
        </span>
      );
  }
}

// ─── Execution count pills ────────────────────────────────────────────────────

function ExecCounts({ run }: { run: Run }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 text-green-700">
        <CheckCircle className="w-3 h-3" />
        {run.successful_executions}
      </span>
      <span className="inline-flex items-center gap-1 text-red-600">
        <XCircle className="w-3 h-3" />
        {run.failed_executions}
      </span>
      <span className="inline-flex items-center gap-1 text-zinc-400">
        <SkipForward className="w-3 h-3" />
        {run.skipped_executions}
      </span>
      <span className="text-zinc-400">/ {run.total_executions}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRuns(0);
  }, []);

  async function loadRuns(pageIndex: number) {
    try {
      if (pageIndex === 0) setLoading(true);
      else setLoadingMore(true);
      const result = await listRuns(undefined, undefined, pageIndex);
      if (result.success && result.runs) {
        setRuns(prev => pageIndex === 0 ? result.runs! : [...prev, ...result.runs!]);
        setHasMore(result.hasMore ?? false);
        setPage(pageIndex);
      } else {
        setError(result.error ?? 'Failed to load runs');
      }
    } catch {
      setError('An error occurred while loading runs');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-zinc-900">Runs</h1>
          <Link href="/dashboard/runs/new">
            <Button>
              <Plus className="w-4 h-4 mr-1" /> New Run
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading runs…
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">
            {error}
          </div>
        ) : runs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-12 text-center">
            <PlayCircle className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-zinc-700 mb-1">No runs yet</h2>
            <p className="text-sm text-zinc-500 mb-4">
              Create a matrix run to start automated QA testing across personas, devices, and browsers.
            </p>
            <Link href="/dashboard/runs/new">
              <Button>
                <Plus className="w-4 h-4 mr-1" /> New Run
              </Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-600">Run Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-600">Site / Env</th>
                  <th className="px-4 py-3 text-center font-semibold text-zinc-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-600">Executions</th>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-600">Started</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {runs.map(run => (
                  <tr key={run.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-900">{run.name}</span>
                      {run.description && (
                        <p className="text-zinc-400 text-xs truncate max-w-xs mt-0.5">
                          {run.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      <span className="font-medium">{run.site_name}</span>
                      <span className="text-zinc-400 mx-1">/</span>
                      <span>{run.site_env_name}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ExecCounts run={run} />
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {run.started_at
                        ? new Date(run.started_at).toLocaleString()
                        : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/runs/${run.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs font-medium"
                      >
                        View <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMore && (
              <div className="border-t border-zinc-100 px-4 py-3 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadRuns(page + 1)}
                  disabled={loadingMore}
                  className="text-zinc-600 hover:text-zinc-900"
                >
                  {loadingMore
                    ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Loading…</>
                    : 'Load more runs'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
