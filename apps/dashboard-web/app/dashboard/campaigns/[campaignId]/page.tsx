'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import {
  getCampaign,
  listCampaignScenarios,
  listCampaignExecutions,
  generateScenarioMatrix,
  createCampaignExecution,
  type CampaignDetail,
  type CampaignScenario,
  type CampaignExecution,
  type CampaignType,
  type ExecutionStatus,
} from '@/app/actions/campaigns';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  PlayCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Megaphone,
  Shield,
  FlaskConical,
  CreditCard,
  Accessibility,
  Mail,
  Grid3X3,
  History,
  SkipForward,
  AlertCircle,
} from 'lucide-react';

// ─── Campaign type display ────────────────────────────────────────────────────

const CAMPAIGN_TYPE_CONFIG: Record<CampaignType, { label: string; icon: typeof Megaphone; color: string }> = {
  smoke: { label: 'Smoke', icon: FlaskConical, color: 'bg-blue-50 text-blue-700' },
  regression: { label: 'Regression', icon: Shield, color: 'bg-purple-50 text-purple-700' },
  release_certification: { label: 'Release Certification', icon: CheckCircle, color: 'bg-green-50 text-green-700' },
  payment_certification: { label: 'Payment Certification', icon: CreditCard, color: 'bg-amber-50 text-amber-700' },
  accessibility_audit: { label: 'Accessibility Audit', icon: Accessibility, color: 'bg-teal-50 text-teal-700' },
  email_deliverability: { label: 'Email Deliverability', icon: Mail, color: 'bg-indigo-50 text-indigo-700' },
};

function CampaignTypeBadge({ type }: { type: CampaignType }) {
  const config = CAMPAIGN_TYPE_CONFIG[type] ?? { label: type, icon: Megaphone, color: 'bg-zinc-100 text-zinc-600' };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full ${config.color}`}>
      <Icon className="w-4 h-4" /> {config.label}
    </span>
  );
}

function ExecutionStatusBadge({ status }: { status: ExecutionStatus }) {
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
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-500 text-xs font-medium px-2 py-0.5 rounded-full">
          <XCircle className="w-3 h-3" /> Cancelled
        </span>
      );
    case 'pending':
    default:
      return (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3" /> Pending
        </span>
      );
  }
}

function ExecMetrics({ exec: e }: { exec: CampaignExecution }) {
  if (e.total_scenarios === 0) return <span className="text-zinc-400 text-xs">—</span>;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 text-green-700">
        <CheckCircle className="w-3 h-3" /> {e.successful_scenarios}
      </span>
      <span className="inline-flex items-center gap-1 text-red-600">
        <XCircle className="w-3 h-3" /> {e.failed_scenarios}
      </span>
      <span className="inline-flex items-center gap-1 text-zinc-400">
        <SkipForward className="w-3 h-3" /> {e.skipped_scenarios}
      </span>
      <span className="text-zinc-400">/ {e.total_scenarios}</span>
    </div>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ─── Metadata display ─────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-zinc-100 last:border-0">
      <span className="w-44 shrink-0 text-sm text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-900">{value}</span>
    </div>
  );
}

function ArrayBadges({ items, emptyLabel }: { items: (string | number)[] | null; emptyLabel?: string }) {
  if (!items || items.length === 0) {
    return <span className="text-zinc-400 text-xs">{emptyLabel ?? 'None configured'}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 text-xs font-medium">
          {String(item)}
        </span>
      ))}
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  icon: typeof Grid3X3;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-700">{title}</span>
          {count !== undefined && (
            <span className="text-xs text-zinc-400">({count})</span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
      </button>
      {open && <div className="border-t border-zinc-200">{children}</div>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = Number(params.campaignId);

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [scenarios, setScenarios] = useState<CampaignScenario[]>([]);
  const [executions, setExecutions] = useState<CampaignExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [campaignRes, scenariosRes, executionsRes] = await Promise.all([
        getCampaign(campaignId),
        listCampaignScenarios(campaignId, undefined, 500, 0),
        listCampaignExecutions(campaignId),
      ]);

      if (!campaignRes.success || !campaignRes.campaign) {
        setError(campaignRes.error ?? 'Campaign not found');
        return;
      }

      setCampaign(campaignRes.campaign);
      setScenarios(scenariosRes.success ? (scenariosRes.scenarios ?? []) : []);
      setExecutions(executionsRes.success ? (executionsRes.executions ?? []) : []);
    } catch {
      setError('An error occurred while loading campaign details');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (campaignId) loadData();
  }, [campaignId, loadData]);

  // ── Auto-refresh if any execution is running ────────────────────────────────
  useEffect(() => {
    const hasRunning = executions.some(e => e.status === 'running' || e.status === 'pending');
    if (!hasRunning) return;
    const interval = setInterval(() => {
      listCampaignExecutions(campaignId).then(res => {
        if (res.success && res.executions) setExecutions(res.executions);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [executions, campaignId]);

  async function handleRegenerateMatrix() {
    setActionLoading('regenerate');
    setActionMessage(null);
    try {
      const res = await generateScenarioMatrix(campaignId, true);
      if (res.success && res.result) {
        setActionMessage({ type: 'success', text: `Matrix regenerated: ${res.result.total_scenarios} scenarios (${res.result.generated} new, ${res.result.skipped} skipped)` });
        // Reload scenarios
        const scenRes = await listCampaignScenarios(campaignId, undefined, 500, 0);
        if (scenRes.success) setScenarios(scenRes.scenarios ?? []);
      } else {
        setActionMessage({ type: 'error', text: res.error ?? 'Failed to regenerate matrix' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleTriggerExecution() {
    setActionLoading('execute');
    setActionMessage(null);
    try {
      const res = await createCampaignExecution(campaignId, 'manual');
      if (res.success) {
        setActionMessage({ type: 'success', text: `Execution #${res.executionId} created` });
        // Reload executions
        const execRes = await listCampaignExecutions(campaignId);
        if (execRes.success) setExecutions(execRes.executions ?? []);
      } else {
        setActionMessage({ type: 'error', text: res.error ?? 'Failed to trigger execution' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-16 text-zinc-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading campaign…
        </div>
      </AppShell>
    );
  }

  if (error || !campaign) {
    return (
      <AppShell>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/dashboard/campaigns" className="text-blue-600 hover:underline">Campaigns</Link>
            <span className="text-zinc-400">/</span>
            <span className="text-zinc-900">Not Found</span>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">
            {error ?? 'Campaign not found'}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link href="/dashboard/campaigns" className="text-blue-600 hover:underline">
            Campaigns
          </Link>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-900">{campaign.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-zinc-900">{campaign.name}</h1>
              <CampaignTypeBadge type={campaign.campaign_type} />
              {campaign.is_active ? (
                <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-500 text-xs font-medium px-2 py-0.5 rounded-full">
                  Inactive
                </span>
              )}
            </div>
            {campaign.description && (
              <p className="text-sm text-zinc-500">{campaign.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleRegenerateMatrix}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'regenerate' ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Regenerate Matrix
            </Button>
            <Button
              onClick={handleTriggerExecution}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'execute' ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4 mr-1" />
              )}
              Execute Campaign
            </Button>
          </div>
        </div>

        {/* Action message */}
        {actionMessage && (
          <div className={`rounded-md p-3 text-sm ${
            actionMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {actionMessage.text}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-4">
            <p className="text-sm text-zinc-500">Total Scenarios</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{scenarios.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-4">
            <p className="text-sm text-zinc-500">Executions</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{executions.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-4">
            <p className="text-sm text-zinc-500">Concurrency Cap</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{campaign.concurrency_cap}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-4">
            <p className="text-sm text-zinc-500">Approval</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">
              {campaign.requires_approval ? (
                <span className="text-amber-600 flex items-center gap-1"><Shield className="w-5 h-5" /> Required</span>
              ) : (
                <span className="text-zinc-400">None</span>
              )}
            </p>
          </div>
        </div>

        {/* Campaign Configuration */}
        <CollapsibleSection title="Campaign Configuration" icon={Megaphone} defaultOpen>
          <div className="px-4 py-3 space-y-0">
            <MetaRow label="Created" value={new Date(campaign.created_date).toLocaleString()} />
            <MetaRow label="Updated" value={new Date(campaign.updated_date).toLocaleString()} />
            <MetaRow label="Retry on failure" value={campaign.retry_on_failure ? `Yes (max ${campaign.max_retries})` : 'No'} />
          </div>
          <div className="px-4 py-3 border-t border-zinc-100">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Matrix Dimensions</p>
            <div className="space-y-0">
              <MetaRow label="Persona IDs" value={<ArrayBadges items={campaign.persona_ids} />} />
              <MetaRow label="Device Profile IDs" value={<ArrayBadges items={campaign.device_profile_ids} />} />
              <MetaRow label="Network Profile IDs" value={<ArrayBadges items={campaign.network_profile_ids} />} />
              <MetaRow label="Browser Types" value={<ArrayBadges items={campaign.browser_types} />} />
              <MetaRow label="Payment Scenario IDs" value={<ArrayBadges items={campaign.payment_scenario_ids} />} />
              <MetaRow label="Email Provider IDs" value={<ArrayBadges items={campaign.email_provider_ids} />} />
              <MetaRow label="Flow Types" value={<ArrayBadges items={campaign.flow_types} />} />
            </div>
          </div>
        </CollapsibleSection>

        {/* Scenario Matrix */}
        <CollapsibleSection title="Scenario Matrix" icon={Grid3X3} count={scenarios.length} defaultOpen={scenarios.length <= 50}>
          {scenarios.length === 0 ? (
            <div className="p-8 text-center">
              <Grid3X3 className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No scenarios generated yet.</p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={handleRegenerateMatrix}
                disabled={actionLoading !== null}
              >
                <RefreshCw className="w-4 h-4 mr-1" /> Generate Matrix
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-600">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-600">Persona</th>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-600">Device</th>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-600">Network</th>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-600">Browser</th>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-600">Payment</th>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-600">Email</th>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-600">Flow</th>
                    <th className="px-3 py-2 text-center font-semibold text-zinc-600">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {scenarios.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-3 py-2 text-zinc-400">{idx + 1}</td>
                      <td className="px-3 py-2 text-zinc-700">{s.persona_id ?? '—'}</td>
                      <td className="px-3 py-2 text-zinc-700">{s.device_profile_id ?? '—'}</td>
                      <td className="px-3 py-2 text-zinc-700">{s.network_profile_id ?? '—'}</td>
                      <td className="px-3 py-2 text-zinc-700">{s.browser_type ?? '—'}</td>
                      <td className="px-3 py-2 text-zinc-700">{s.payment_scenario_id ?? '—'}</td>
                      <td className="px-3 py-2 text-zinc-700">{s.email_provider_id ?? '—'}</td>
                      <td className="px-3 py-2 text-zinc-700">{s.flow_type ?? '—'}</td>
                      <td className="px-3 py-2 text-center">
                        {s.is_active ? (
                          <CheckCircle className="w-3 h-3 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="w-3 h-3 text-zinc-300 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {scenarios.length >= 500 && (
                <div className="px-4 py-2 text-xs text-zinc-500 bg-zinc-50 border-t border-zinc-200">
                  Showing first 500 scenarios. Total may be higher.
                </div>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* Execution History */}
        <CollapsibleSection title="Execution History" icon={History} count={executions.length} defaultOpen>
          {executions.length === 0 ? (
            <div className="p-8 text-center">
              <History className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No executions yet.</p>
              <p className="text-xs text-zinc-400 mt-1">Trigger a manual execution to get started.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-zinc-600">ID</th>
                  <th className="px-4 py-2 text-left font-semibold text-zinc-600">Type</th>
                  <th className="px-4 py-2 text-center font-semibold text-zinc-600">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-zinc-600">Results</th>
                  <th className="px-4 py-2 text-left font-semibold text-zinc-600">Duration</th>
                  <th className="px-4 py-2 text-left font-semibold text-zinc-600">Triggered</th>
                  <th className="px-4 py-2 text-left font-semibold text-zinc-600">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {executions.map(e => (
                  <tr key={e.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-2 text-zinc-700 font-mono text-xs">#{e.id}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 text-xs font-medium">
                        {e.execution_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <ExecutionStatusBadge status={e.status} />
                    </td>
                    <td className="px-4 py-2">
                      <ExecMetrics exec={e} />
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-500">
                      {formatDuration(e.duration_seconds)}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-500">
                      {e.started_at
                        ? new Date(e.started_at).toLocaleString()
                        : new Date(e.created_date).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      {e.error_message ? (
                        <span className="inline-flex items-center gap-1 text-red-600 text-xs" title={e.error_message}>
                          <AlertCircle className="w-3 h-3" />
                          <span className="truncate max-w-[200px]">{e.error_message}</span>
                        </span>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CollapsibleSection>
      </div>
    </AppShell>
  );
}
