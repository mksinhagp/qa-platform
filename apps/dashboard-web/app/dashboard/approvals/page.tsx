'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { listApprovals, decideApproval, type ApprovalItem } from '@/app/actions/approvals';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Strength badge ────────────────────────────────────────────────────────────

function StrengthBadge({ strength }: { strength: string }) {
  switch (strength) {
    case 'strong':
      return (
        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
          <AlertTriangle className="w-3 h-3" /> Strong
        </span>
      );
    case 'one_click':
      return (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
          One-click
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-500 text-xs px-2 py-0.5 rounded-full">
          None
        </span>
      );
  }
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Pending
        </span>
      );
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
          <CheckCircle className="w-3 h-3" /> Approved
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
          <XCircle className="w-3 h-3" /> Rejected
        </span>
      );
    case 'timed_out':
      return (
        <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-500 text-xs font-medium px-2.5 py-1 rounded-full">
          <Clock className="w-3 h-3" /> Timed out
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-400 text-xs px-2.5 py-1 rounded-full">
          {status}
        </span>
      );
  }
}

// ─── Countdown clock ──────────────────────────────────────────────────────────

function Countdown({ timeoutAt }: { timeoutAt: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    function tick() {
      const diff = new Date(timeoutAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Expired');
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}m ${String(secs).padStart(2, '0')}s`);
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [timeoutAt]);

  const isUrgent = new Date(timeoutAt).getTime() - Date.now() < 2 * 60 * 1000;

  return (
    <span className={`text-xs font-mono ${isUrgent ? 'text-red-600 font-bold animate-pulse' : 'text-zinc-500'}`}>
      {remaining}
    </span>
  );
}

// ─── Approval Card ────────────────────────────────────────────────────────────

function ApprovalCard({
  approval,
  onDecision,
}: {
  approval: ApprovalItem;
  onDecision: (id: number, decision: 'approved' | 'rejected', reason?: string) => void;
}) {
  const [loading, setLoading] = useState<'approved' | 'rejected' | null>(null);
  const [reason, setReason] = useState('');
  const [showReason, setShowReason] = useState(false);
  const isPending = approval.status === 'pending';

  async function handle(decision: 'approved' | 'rejected') {
    setLoading(decision);
    onDecision(approval.id, decision, decision === 'rejected' ? reason.trim() || undefined : undefined);
  }

  return (
    <div className={`bg-white rounded-xl border shadow-sm transition-all ${
      isPending
        ? 'border-amber-200 shadow-amber-50'
        : 'border-zinc-200 opacity-75'
    }`}>
      {/* Card header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-zinc-100">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={approval.status} />
            <StrengthBadge strength={approval.required_strength} />
            <span className="text-xs text-zinc-400 font-mono">{approval.category}</span>
          </div>
          <p className="text-sm font-semibold text-zinc-900 truncate">
            {approval.payload_summary ?? `Step "${approval.step_name}" in flow "${approval.flow_name}"`}
          </p>
        </div>
        {isPending && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-zinc-400 mb-1">Expires in</p>
            <Countdown timeoutAt={approval.timeout_at} />
          </div>
        )}
      </div>

      {/* Context */}
      <div className="px-5 py-3 bg-zinc-50 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <div>
          <span className="text-zinc-400">Run</span>{' '}
          <Link
            href={`/dashboard/runs/${approval.run_id}`}
            className="text-blue-600 hover:underline font-medium inline-flex items-center gap-0.5"
          >
            {approval.run_name} <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div>
          <span className="text-zinc-400">Flow</span>{' '}
          <span className="text-zinc-700 font-medium capitalize">{approval.flow_name}</span>
        </div>
        <div>
          <span className="text-zinc-400">Step</span>{' '}
          <span className="text-zinc-700 font-mono">{approval.step_name}</span>
        </div>
        <div>
          <span className="text-zinc-400">Persona</span>{' '}
          <span className="text-zinc-700">{approval.persona_id}</span>
        </div>
        {approval.decided_by && (
          <div className="col-span-2">
            <span className="text-zinc-400">Decided by</span>{' '}
            <span className="text-zinc-700">{approval.decided_by}</span>
            {approval.decided_at && (
              <span className="text-zinc-400 ml-1">
                at {new Date(approval.decided_at).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}
        {approval.reason && (
          <div className="col-span-2">
            <span className="text-zinc-400">Reason</span>{' '}
            <span className="text-zinc-700 italic">{approval.reason}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {isPending && (
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
          {showReason ? (
            <>
              <input
                type="text"
                placeholder="Reason (optional)"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="flex-1 min-w-0 border border-zinc-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => handle('rejected')}
                disabled={loading !== null}
              >
                {loading === 'rejected' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                )}
                Reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-zinc-500"
                onClick={() => setShowReason(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handle('approved')}
                disabled={loading !== null}
              >
                {loading === 'approved' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setShowReason(true)}
                disabled={loading !== null}
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Reject…
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterTab = 'pending' | 'all';

const POLL_INTERVAL_MS = 5000;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [filter, setFilter] = useState<FilterTab>('pending');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Track optimistic removals: IDs decided locally but not yet reflected in DB poll
  const optimisticDecided = useRef<Set<number>>(new Set());

  const fetchApprovals = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await listApprovals(
        filter === 'pending' ? { status: 'pending' } : undefined,
      );
      if (result.success && result.approvals) {
        // Re-include decided items that are now confirmed by DB
        const confirmed = result.approvals.filter(a => a.status !== 'pending');
        confirmed.forEach(a => optimisticDecided.current.delete(a.id));
        // Keep optimistically-removed items hidden until next poll confirms
        const filtered = result.approvals.filter(
          a => !optimisticDecided.current.has(a.id),
        );
        setApprovals(filter === 'pending' ? filtered : result.approvals);
        setLastRefresh(new Date());
        setError(null);
      } else {
        setError(result.error ?? 'Failed to load approvals');
      }
    } catch {
      setError('An error occurred while loading approvals');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Initial load
  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Live polling
  useEffect(() => {
    const timer = setInterval(() => fetchApprovals(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchApprovals]);

  async function handleDecision(approvalId: number, decision: 'approved' | 'rejected', reason?: string) {
    // Optimistic UI: immediately hide from pending list
    optimisticDecided.current.add(approvalId);
    setApprovals(prev => prev.filter(a => a.id !== approvalId));

    const result = await decideApproval(approvalId, decision, reason);
    if (!result.success) {
      // Revert optimistic remove on failure
      optimisticDecided.current.delete(approvalId);
      await fetchApprovals(true);
    }
  }

  const pendingCount = approvals.filter(a => a.status === 'pending').length;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Approvals</h1>
            {lastRefresh && (
              <p className="text-xs text-zinc-400 mt-1">
                Auto-refreshing every {POLL_INTERVAL_MS / 1000}s ·{' '}
                Last updated {lastRefresh.toLocaleTimeString()}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchApprovals()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            Refresh
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === 'pending'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Pending
            {pendingCount > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === 'all'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            All
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        {loading && approvals.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading approvals…
          </div>
        ) : approvals.length === 0 ? (
          <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center">
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="text-zinc-600 font-medium">
              {filter === 'pending' ? 'No pending approvals' : 'No approvals found'}
            </p>
            <p className="text-zinc-400 text-sm mt-1">
              {filter === 'pending'
                ? 'Approval-gated run steps will appear here when a flow reaches an approval checkpoint.'
                : 'Approvals will appear here once runs with approval-gated steps are started.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map(approval => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                onDecision={handleDecision}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
