'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import {
  getRun,
  listRunExecutions,
  updateRunStatus,
  abortRun,
  type RunDetail,
  type RunExecution,
} from '@/app/actions/runs';
import { listPendingApprovals, decideApproval, type ApprovalItem } from '@/app/actions/approvals';
import {
  listEmailValidationRuns,
  listEmailValidationChecks,
  type EmailValidationRunRecord,
  type EmailValidationCheckRecord,
} from '@/app/actions/emailValidation';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  PlayCircle,
  StopCircle,
  Clock,
  SkipForward,
  Bell,
  Mail,
  ChevronDown,
  ChevronRight,
  Link2,
} from 'lucide-react';

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return (
        <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Running
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
          <CheckCircle className="w-3 h-3" /> Completed
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
          <XCircle className="w-3 h-3" /> Failed
        </span>
      );
    case 'aborted':
      return (
        <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-500 text-xs font-medium px-2.5 py-1 rounded-full">
          <XCircle className="w-3 h-3" /> Aborted
        </span>
      );
    case 'paused_for_approval':
      return (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full">
          <Clock className="w-3 h-3" /> Awaiting Approval
        </span>
      );
    case 'awaiting_approval':
      return (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full">
          <Clock className="w-3 h-3" /> Awaiting Approval
        </span>
      );
    case 'draft':
    default:
      return (
        <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-500 text-xs font-medium px-2.5 py-1 rounded-full">
          Draft
        </span>
      );
  }
}

// ─── Execution status badge (small) ──────────────────────────────────────────

function ExecStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'passed':
    case 'completed':
      return <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" /> Passed</span>;
    case 'failed':
      return <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Failed</span>;
    case 'skipped':
      return <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-500 text-xs px-2 py-0.5 rounded-full"><SkipForward className="w-3 h-3" /> Skipped</span>;
    case 'running':
      return <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Running</span>;
    default:
      return <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-400 text-xs px-2 py-0.5 rounded-full">{status}</span>;
  }
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4 text-center">
      <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-sm text-zinc-500 mt-1">{label}</p>
    </div>
  );
}

// ─── Duration helper ──────────────────────────────────────────────────────────

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return '—';
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) return '—';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  return `${minutes}m ${remainingSecs}s`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = ['running', 'paused_for_approval'];

export default function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = use(params);
  const id = Number(runId);

  const [run, setRun] = useState<RunDetail | null>(null);
  const [executions, setExecutions] = useState<RunExecution[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalItem[]>([]);
  const [emailValRuns, setEmailValRuns] = useState<EmailValidationRunRecord[]>([]);
  const [emailValChecks, setEmailValChecks] = useState<Record<number, EmailValidationCheckRecord[]>>({});
  const [expandedEmailRun, setExpandedEmailRun] = useState<number | null>(null);
  // Tracks in-flight check fetches to prevent duplicate concurrent requests
  const fetchingChecks = useRef<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [runRes, execRes, approvalRes] = await Promise.all([
        getRun(id),
        listRunExecutions(id),
        listPendingApprovals(id),
      ]);
      if (runRes.success && runRes.run) {
        setRun(runRes.run);
      } else {
        setError(runRes.error ?? 'Failed to load run');
      }
      const loadedExecs = execRes.success ? (execRes.executions ?? []) : [];
      if (execRes.success) setExecutions(loadedExecs);
      if (approvalRes.success && approvalRes.approvals) {
        setPendingApprovals(approvalRes.approvals);
      }

      // Load email validation runs for all executions with email-sending flows
      const emailFlows = ['registration', 'checkout'];
      const emailExecs = loadedExecs.filter(e => emailFlows.includes(e.flow_name));
      if (emailExecs.length > 0) {
        const allEmailValRuns: EmailValidationRunRecord[] = [];
        await Promise.all(
          emailExecs.map(async exec => {
            const evRes = await listEmailValidationRuns(exec.id);
            if (evRes.success && evRes.runs) {
              allEmailValRuns.push(...evRes.runs);
            }
          }),
        );
        setEmailValRuns(allEmailValRuns);
        // Invalidate cached check results so they are re-fetched on next expand.
        // Validation check rows can change status (pending → delivered/failed) during
        // active polling, so stale cached checks must not persist across refreshes.
        setEmailValChecks({});
      }
    } catch {
      setError('An error occurred while loading run');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 5 seconds when run is active
  useEffect(() => {
    if (!run || !ACTIVE_STATUSES.includes(run.status)) return;
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    return () => clearInterval(interval);
  }, [run, loadData]);

  async function handleExpandEmailRun(evRunId: number) {
    if (expandedEmailRun === evRunId) {
      setExpandedEmailRun(null);
      return;
    }
    setExpandedEmailRun(evRunId);
    if (!emailValChecks[evRunId] && !fetchingChecks.current.has(evRunId)) {
      fetchingChecks.current.add(evRunId);
      try {
        const checksRes = await listEmailValidationChecks(evRunId);
        if (checksRes.success && checksRes.checks) {
          setEmailValChecks(prev => ({ ...prev, [evRunId]: checksRes.checks! }));
        }
      } finally {
        fetchingChecks.current.delete(evRunId);
      }
    }
  }

  async function handleStartRun() {
    if (!run) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await updateRunStatus(run.id, 'running', {
        started_at: new Date().toISOString(),
      });
      if (result.success) {
        await loadData();
      } else {
        setActionError(result.error ?? 'Failed to start run');
      }
    } catch {
      setActionError('An unexpected error occurred');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprovalDecision(approvalId: number, decision: 'approved' | 'rejected') {
    const reason = decision === 'rejected'
      ? window.prompt('Reason for rejection (optional)')?.trim() || undefined
      : undefined;
    setApprovalLoading(approvalId);
    setActionError(null);
    try {
      const result = await decideApproval(approvalId, decision, reason);
      if (!result.success) {
        setActionError(result.error ?? `Failed to ${decision === 'approved' ? 'approve' : 'reject'} approval`);
        return;
      }
      await loadData();
    } catch {
      setActionError('An unexpected error occurred while recording the approval decision');
    } finally {
      setApprovalLoading(null);
    }
  }

  async function handleAbortRun() {
    if (!run) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await abortRun(run.id);
      if (result.success) {
        await loadData();
      } else {
        setActionError(result.error ?? 'Failed to abort run');
      }
    } catch {
      setActionError('An unexpected error occurred');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link href="/dashboard/runs" className="text-blue-600 hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Runs
          </Link>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-900">{run ? run.name : `Run ${runId}`}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading run…
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">{error}</div>
        ) : run ? (
          <>
            {/* Header */}
            <div className="bg-white rounded-lg border border-zinc-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-zinc-900">{run.name}</h1>
                    <StatusBadge status={run.status} />
                    {ACTIVE_STATUSES.includes(run.status) && (
                      <span className="text-xs text-zinc-400 animate-pulse">Auto-refreshing…</span>
                    )}
                  </div>
                  {run.description && (
                    <p className="text-sm text-zinc-500">{run.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-zinc-500 pt-1">
                    <span>
                      <span className="font-medium text-zinc-700">{run.site_name}</span>
                      <span className="mx-1 text-zinc-300">/</span>
                      {run.site_env_name}
                    </span>
                    {run.started_by && (
                      <span>Started by <span className="font-medium text-zinc-700">{run.started_by}</span></span>
                    )}
                    <span>Created {new Date(run.created_date).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {actionError && (
                    <span className="text-red-600 text-xs">{actionError}</span>
                  )}
                  {run.status === 'draft' && (
                    <Button onClick={handleStartRun} disabled={actionLoading}>
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <PlayCircle className="w-4 h-4 mr-1" />
                      )}
                      Start Run
                    </Button>
                  )}
                  {run.status === 'running' && (
                    <Button
                      variant="outline"
                      onClick={handleAbortRun}
                      disabled={actionLoading}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <StopCircle className="w-4 h-4 mr-1" />
                      )}
                      Abort
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4">
              <SummaryCard label="Total" value={run.total_executions} colorClass="text-zinc-900" />
              <SummaryCard label="Passed" value={run.successful_executions} colorClass="text-green-600" />
              <SummaryCard label="Failed" value={run.failed_executions} colorClass="text-red-600" />
              <SummaryCard label="Skipped" value={run.skipped_executions} colorClass="text-zinc-400" />
            </div>

            {/* Pending approvals banner */}
            {pendingApprovals.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="w-4 h-4 text-amber-600" />
                  <h2 className="text-sm font-semibold text-amber-800">
                    {pendingApprovals.length} pending approval{pendingApprovals.length !== 1 ? 's' : ''} — run is paused
                  </h2>
                  <Link
                    href="/dashboard/approvals"
                    className="ml-auto text-xs text-amber-700 hover:underline font-medium"
                  >
                    View all approvals
                  </Link>
                </div>
                <div className="space-y-2">
                  {pendingApprovals.map(a => (
                    <div key={a.id} className="flex items-center gap-3 bg-white rounded-md border border-amber-100 px-3 py-2">
                      <span className="text-xs text-zinc-600 min-w-0 flex-1 truncate">
                        <span className="font-medium text-zinc-900">{a.step_name}</span>
                        {' '}in flow <span className="font-medium capitalize">{a.flow_name}</span>
                        {a.payload_summary && (
                          <span className="text-zinc-400 ml-1">· {a.payload_summary}</span>
                        )}
                      </span>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white px-3"
                          onClick={() => handleApprovalDecision(a.id, 'approved')}
                          disabled={approvalLoading === a.id}
                        >
                          {approvalLoading === a.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50 px-3"
                          onClick={() => handleApprovalDecision(a.id, 'rejected')}
                          disabled={approvalLoading === a.id}
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email Validation Results panel */}
            {emailValRuns.length > 0 && (
              <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-zinc-500" />
                  <h2 className="text-sm font-semibold text-zinc-700">Email Validation ({emailValRuns.length})</h2>
                </div>
                <div className="divide-y divide-zinc-100">
                  {emailValRuns.map(evRun => {
                    const isExpanded = expandedEmailRun === evRun.id;
                    const checks = emailValChecks[evRun.id] ?? [];
                    const statusColor =
                      evRun.status === 'delivered' ? 'text-green-700 bg-green-50' :
                      evRun.status === 'timed_out' || evRun.status === 'not_found' ? 'text-amber-700 bg-amber-50' :
                      evRun.status === 'error' ? 'text-red-700 bg-red-50' :
                      'text-zinc-600 bg-zinc-100';
                    return (
                      <div key={evRun.id}>
                        <button
                          onClick={() => handleExpandEmailRun(evRun.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />}
                          <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="flex-1 text-xs font-medium text-zinc-900 truncate">
                            {evRun.inbox_name}
                            <span className="ml-2 font-mono text-zinc-400">{evRun.correlation_token}</span>
                          </span>
                          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
                            {evRun.status}
                          </span>
                          {evRun.delivery_latency_ms !== null && (
                            <span className="text-xs text-zinc-400 shrink-0 ml-2">
                              {evRun.delivery_latency_ms < 1000
                                ? `${evRun.delivery_latency_ms}ms`
                                : `${(evRun.delivery_latency_ms / 1000).toFixed(1)}s`}
                            </span>
                          )}
                        </button>
                        {isExpanded && (
                          <div className="px-10 pb-3 space-y-1">
                            {evRun.error_message && (
                              <p className="text-xs text-red-600 mb-2">{evRun.error_message}</p>
                            )}
                            {checks.length === 0 && (
                              <p className="text-xs text-zinc-400">No check results yet.</p>
                            )}
                            {checks.map(check => {
                              const checkColor =
                                check.status === 'passed' ? 'text-green-700' :
                                check.status === 'failed' ? 'text-red-700' :
                                check.status === 'skipped' ? 'text-zinc-400' :
                                'text-amber-700';
                              return (
                                <div key={check.id} className="flex items-start gap-2 text-xs">
                                  <span className={`font-mono shrink-0 w-3 mt-0.5 ${checkColor}`}>
                                    {check.status === 'passed' ? '✓' : check.status === 'skipped' ? '–' : '✗'}
                                  </span>
                                  <span className="text-zinc-500 shrink-0 w-28">{check.check_type}</span>
                                  <span className={`${checkColor} flex-1`}>{check.detail ?? '—'}</span>
                                  {check.url_tested && (
                                    <a
                                      href={check.url_tested}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label={`Open checked URL: ${check.url_tested}`}
                                      className="text-blue-500 hover:underline shrink-0"
                                    >
                                      <Link2 className="w-3 h-3" aria-hidden="true" />
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Executions table */}
            <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50">
                <h2 className="text-sm font-semibold text-zinc-700">Executions ({executions.length})</h2>
              </div>

              {executions.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-sm">
                  No executions yet.{run.status === 'draft' ? ' Start the run to generate executions.' : ''}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold text-zinc-600 text-xs">Persona</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-zinc-600 text-xs">Device</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-zinc-600 text-xs">Network</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-zinc-600 text-xs">Browser</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-zinc-600 text-xs">Flow</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-zinc-600 text-xs">Status</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-zinc-600 text-xs">Friction</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-zinc-600 text-xs">Duration</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-zinc-600 text-xs">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {executions.map(exec => (
                        <tr key={exec.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-4 py-2.5 text-zinc-900 text-xs">{exec.persona_display_name}</td>
                          <td className="px-4 py-2.5 text-zinc-600 text-xs">{exec.device_profile_name}</td>
                          <td className="px-4 py-2.5 text-zinc-600 text-xs">{exec.network_profile_name}</td>
                          <td className="px-4 py-2.5 text-zinc-600 text-xs capitalize">{exec.browser}</td>
                          <td className="px-4 py-2.5 text-zinc-600 text-xs capitalize">{exec.flow_name}</td>
                          <td className="px-4 py-2.5 text-center">
                            <ExecStatusBadge status={exec.status} />
                          </td>
                          <td className="px-4 py-2.5 text-center text-xs text-zinc-600">
                            {exec.friction_score !== null ? exec.friction_score.toFixed(2) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-zinc-500">
                            {formatDuration(exec.started_at, exec.completed_at)}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-red-600 max-w-xs truncate">
                            {exec.error_message ?? <span className="text-zinc-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
