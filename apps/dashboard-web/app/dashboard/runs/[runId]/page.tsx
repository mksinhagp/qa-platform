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
import {
  listApiTestSuites,
  listApiTestAssertions,
  type ApiTestSuiteRecord,
  type ApiTestAssertionRecord,
} from '@/app/actions/apiTestResults';
import {
  listAdminTestSuites,
  listAdminTestAssertions,
  type AdminTestSuiteRecord,
  type AdminTestAssertionRecord,
} from '@/app/actions/adminTestResults';
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
  Zap,
  Shield,
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
  // Phase 6: API test suite results
  const [apiTestSuites, setApiTestSuites] = useState<ApiTestSuiteRecord[]>([]);
  const [apiTestAssertions, setApiTestAssertions] = useState<Record<number, ApiTestAssertionRecord[]>>({});
  const [expandedApiSuite, setExpandedApiSuite] = useState<number | null>(null);
  const fetchingApiAssertions = useRef<Set<number>>(new Set());
  // Mirror of expandedApiSuite for use inside loadData without triggering the
  // useCallback dep-chain (which would otherwise re-run the initial-load effect
  // and reset the auto-refresh interval on every expand/collapse).
  const expandedApiSuiteRef = useRef<number | null>(null);
  useEffect(() => {
    expandedApiSuiteRef.current = expandedApiSuite;
  }, [expandedApiSuite]);
  // Phase 7: Admin test suite results
  const [adminTestSuites, setAdminTestSuites] = useState<AdminTestSuiteRecord[]>([]);
  const [adminTestAssertions, setAdminTestAssertions] = useState<Record<number, AdminTestAssertionRecord[]>>({});
  const [expandedAdminSuite, setExpandedAdminSuite] = useState<number | null>(null);
  const fetchingAdminAssertions = useRef<Set<number>>(new Set());
  const expandedAdminSuiteRef = useRef<number | null>(null);
  useEffect(() => {
    expandedAdminSuiteRef.current = expandedAdminSuite;
  }, [expandedAdminSuite]);
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

      // Phase 6: Load API test suites for all executions
      const allApiSuites: ApiTestSuiteRecord[] = [];
      await Promise.all(
        loadedExecs.map(async exec => {
          const suiteRes = await listApiTestSuites(exec.id);
          if (suiteRes.success && suiteRes.suites) {
            allApiSuites.push(...suiteRes.suites);
          }
        }),
      );
      setApiTestSuites(allApiSuites);
      // Invalidate cached assertion results so they are re-fetched on next expand,
      // but preserve assertions for the currently expanded suite to avoid UI flash.
      const currentExpanded = expandedApiSuiteRef.current;
      setApiTestAssertions(prev => {
        if (currentExpanded == null) return {};
        const kept = prev[currentExpanded];
        return kept ? { [currentExpanded]: kept } : {};
      });
      // Re-fetch assertions for expanded suite in the background (may have changed)
      if (currentExpanded != null && !fetchingApiAssertions.current.has(currentExpanded)) {
        fetchingApiAssertions.current.add(currentExpanded);
        listApiTestAssertions(currentExpanded).then(res => {
          if (res.success && res.assertions) {
            setApiTestAssertions(p => ({ ...p, [currentExpanded]: res.assertions! }));
          }
        }).finally(() => {
          fetchingApiAssertions.current.delete(currentExpanded);
        });
      }

      // Phase 7: Load admin test suites for all executions with admin flows
      const adminFlows = ['admin-login', 'booking-lookup', 'registration-lookup', 'admin-edit', 'reporting-screens'];
      const adminExecs = loadedExecs.filter(e => adminFlows.includes(e.flow_name));
      if (adminExecs.length > 0) {
        const allAdminSuites: AdminTestSuiteRecord[] = [];
        await Promise.all(
          adminExecs.map(async exec => {
            const suiteRes = await listAdminTestSuites(exec.id);
            if (suiteRes.success && suiteRes.suites) {
              allAdminSuites.push(...suiteRes.suites);
            }
          }),
        );
        setAdminTestSuites(allAdminSuites);
        const currentAdminExpanded = expandedAdminSuiteRef.current;
        setAdminTestAssertions(prev => {
          if (currentAdminExpanded == null) return {};
          const kept = prev[currentAdminExpanded];
          return kept ? { [currentAdminExpanded]: kept } : {};
        });
        if (currentAdminExpanded != null && !fetchingAdminAssertions.current.has(currentAdminExpanded)) {
          fetchingAdminAssertions.current.add(currentAdminExpanded);
          listAdminTestAssertions(currentAdminExpanded).then(res => {
            if (res.success && res.assertions) {
              setAdminTestAssertions(p => ({ ...p, [currentAdminExpanded]: res.assertions! }));
            }
          }).finally(() => {
            fetchingAdminAssertions.current.delete(currentAdminExpanded);
          });
        }
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

  async function handleExpandApiSuite(suiteId: number) {
    if (expandedApiSuite === suiteId) {
      setExpandedApiSuite(null);
      return;
    }
    setExpandedApiSuite(suiteId);
    if (!apiTestAssertions[suiteId] && !fetchingApiAssertions.current.has(suiteId)) {
      fetchingApiAssertions.current.add(suiteId);
      try {
        const res = await listApiTestAssertions(suiteId);
        if (res.success && res.assertions) {
          setApiTestAssertions(prev => ({ ...prev, [suiteId]: res.assertions! }));
        }
      } finally {
        fetchingApiAssertions.current.delete(suiteId);
      }
    }
  }

  async function handleExpandAdminSuite(suiteId: number) {
    if (expandedAdminSuite === suiteId) {
      setExpandedAdminSuite(null);
      return;
    }
    setExpandedAdminSuite(suiteId);
    if (!adminTestAssertions[suiteId] && !fetchingAdminAssertions.current.has(suiteId)) {
      fetchingAdminAssertions.current.add(suiteId);
      try {
        const res = await listAdminTestAssertions(suiteId);
        if (res.success && res.assertions) {
          setAdminTestAssertions(prev => ({ ...prev, [suiteId]: res.assertions! }));
        }
      } finally {
        fetchingAdminAssertions.current.delete(suiteId);
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

            {/* Phase 6: API Test Results panel */}
            {apiTestSuites.length > 0 && (
              <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-zinc-500" />
                  <h2 className="text-sm font-semibold text-zinc-700">
                    API Tests ({apiTestSuites.length} suite{apiTestSuites.length !== 1 ? 's' : ''})
                  </h2>
                  {/* Summary counters */}
                  <div className="ml-auto flex items-center gap-3 text-xs">
                    <span className="text-green-700">
                      {apiTestSuites.reduce((s, t) => s + t.passed_assertions, 0)} passed
                    </span>
                    <span className="text-red-700">
                      {apiTestSuites.reduce((s, t) => s + t.failed_assertions, 0)} failed
                    </span>
                    <span className="text-zinc-400">
                      {apiTestSuites.reduce((s, t) => s + t.skipped_assertions, 0)} skipped
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-zinc-100">
                  {apiTestSuites.map(suite => {
                    const isExpanded = expandedApiSuite === suite.id;
                    const assertions = apiTestAssertions[suite.id] ?? [];
                    const suiteStatusColor =
                      suite.status === 'passed' ? 'text-green-700 bg-green-50' :
                      suite.status === 'failed' ? 'text-red-700 bg-red-50' :
                      suite.status === 'error' ? 'text-red-700 bg-red-50' :
                      suite.status === 'skipped' ? 'text-zinc-500 bg-zinc-100' :
                      'text-blue-700 bg-blue-50';
                    const suiteLabel = suite.suite_type
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, c => c.toUpperCase());

                    return (
                      <div key={suite.id}>
                        <button
                          onClick={() => handleExpandApiSuite(suite.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />}
                          <Zap className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="flex-1 text-xs font-medium text-zinc-900">{suiteLabel}</span>
                          <span className="text-xs text-zinc-500 mr-2">
                            {suite.passed_assertions}/{suite.total_assertions} passed
                          </span>
                          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${suiteStatusColor}`}>
                            {suite.status}
                          </span>
                          {suite.duration_ms !== null && (
                            <span className="text-xs text-zinc-400 shrink-0 ml-2">
                              {suite.duration_ms < 1000
                                ? `${suite.duration_ms}ms`
                                : `${(suite.duration_ms / 1000).toFixed(1)}s`}
                            </span>
                          )}
                        </button>
                        {isExpanded && (
                          <div className="px-10 pb-3 space-y-1">
                            {suite.error_message && (
                              <p className="text-xs text-red-600 mb-2">{suite.error_message}</p>
                            )}
                            {assertions.length === 0 && (
                              <p className="text-xs text-zinc-400">No assertion results yet.</p>
                            )}
                            {assertions.map(a => {
                              const aColor =
                                a.status === 'passed' ? 'text-green-700' :
                                a.status === 'failed' ? 'text-red-700' :
                                a.status === 'skipped' ? 'text-zinc-400' :
                                'text-amber-700';
                              return (
                                <div key={a.id} className="flex items-start gap-2 text-xs">
                                  <span className={`font-mono shrink-0 w-3 mt-0.5 ${aColor}`}>
                                    {a.status === 'passed' ? '✓' : a.status === 'skipped' ? '–' : '✗'}
                                  </span>
                                  <span className="text-zinc-500 shrink-0 w-44 truncate" title={a.assertion_name}>
                                    {a.assertion_name}
                                  </span>
                                  <span className="text-zinc-400 shrink-0 w-16 font-mono">
                                    {a.http_method} {a.response_status ?? ''}
                                  </span>
                                  <span className={`${aColor} flex-1 truncate`} title={a.error_message ?? a.actual_value ?? '—'}>
                                    {a.error_message ?? (a.status === 'passed' ? (a.actual_value ?? 'OK') : a.actual_value) ?? '—'}
                                  </span>
                                  {a.response_time_ms !== null && (
                                    <span className="text-zinc-400 shrink-0 ml-2">
                                      {a.response_time_ms}ms
                                    </span>
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

            {/* Phase 7: Admin Test Results panel */}
            {adminTestSuites.length > 0 && (
              <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-zinc-500" />
                  <h2 className="text-sm font-semibold text-zinc-700">
                    Admin Tests ({adminTestSuites.length} suite{adminTestSuites.length !== 1 ? 's' : ''})
                  </h2>
                  <div className="ml-auto flex items-center gap-3 text-xs">
                    <span className="text-green-700">
                      {adminTestSuites.reduce((s, t) => s + t.passed_assertions, 0)} passed
                    </span>
                    <span className="text-red-700">
                      {adminTestSuites.reduce((s, t) => s + t.failed_assertions, 0)} failed
                    </span>
                    <span className="text-zinc-400">
                      {adminTestSuites.reduce((s, t) => s + t.skipped_assertions, 0)} skipped
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-zinc-100">
                  {adminTestSuites.map(suite => {
                    const isExpanded = expandedAdminSuite === suite.id;
                    const assertions = adminTestAssertions[suite.id] ?? [];
                    const suiteStatusColor =
                      suite.status === 'passed' ? 'text-green-700 bg-green-50' :
                      suite.status === 'failed' ? 'text-red-700 bg-red-50' :
                      suite.status === 'error' ? 'text-red-700 bg-red-50' :
                      suite.status === 'skipped' ? 'text-zinc-500 bg-zinc-100' :
                      'text-blue-700 bg-blue-50';
                    const suiteLabel = suite.suite_type
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, c => c.toUpperCase());

                    return (
                      <div key={suite.id}>
                        <button
                          onClick={() => handleExpandAdminSuite(suite.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />}
                          <Shield className="w-4 h-4 text-violet-500 shrink-0" />
                          <span className="flex-1 text-xs font-medium text-zinc-900">{suiteLabel}</span>
                          <span className="text-xs text-zinc-500 mr-2">
                            {suite.passed_assertions}/{suite.total_assertions} passed
                          </span>
                          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${suiteStatusColor}`}>
                            {suite.status}
                          </span>
                          {suite.duration_ms !== null && (
                            <span className="text-xs text-zinc-400 shrink-0 ml-2">
                              {suite.duration_ms < 1000
                                ? `${suite.duration_ms}ms`
                                : `${(suite.duration_ms / 1000).toFixed(1)}s`}
                            </span>
                          )}
                        </button>
                        {isExpanded && (
                          <div className="px-10 pb-3 space-y-1">
                            {suite.error_message && (
                              <p className="text-xs text-red-600 mb-2">{suite.error_message}</p>
                            )}
                            {assertions.length === 0 && (
                              <p className="text-xs text-zinc-400">No assertion results yet.</p>
                            )}
                            {assertions.map(a => {
                              const aColor =
                                a.status === 'passed' ? 'text-green-700' :
                                a.status === 'failed' ? 'text-red-700' :
                                a.status === 'skipped' ? 'text-zinc-400' :
                                'text-amber-700';
                              return (
                                <div key={a.id} className="flex items-start gap-2 text-xs">
                                  <span className={`font-mono shrink-0 w-3 mt-0.5 ${aColor}`}>
                                    {a.status === 'passed' ? '\u2713' : a.status === 'skipped' ? '\u2013' : '\u2717'}
                                  </span>
                                  <span className="text-zinc-500 shrink-0 w-44 truncate" title={a.assertion_name}>
                                    {a.assertion_name}
                                  </span>
                                  <span className="text-zinc-400 shrink-0 w-48 truncate font-mono" title={a.page_url ?? ''}>
                                    {a.page_url ?? ''}
                                  </span>
                                  <span className={`${aColor} flex-1 truncate`} title={a.error_message ?? a.actual_value ?? '\u2014'}>
                                    {a.error_message ?? (a.status === 'passed' ? (a.actual_value ?? 'OK') : a.actual_value) ?? '\u2014'}
                                  </span>
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
