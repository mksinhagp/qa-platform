'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import {
  getNarrativeReport,
  getExecutionDetail,
  getLlmAnalysisForRun,
  type NarrativeReport,
  type PersonaSummary,
  type AccessibilitySummary,
  type DeduplicatedIssue,
  type ExecutionDetail,
} from '@/app/actions/reports';
import { type LlmAnalysisRecord } from '@/app/actions/llmAnalysis';
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Shield,
  Users,
  Activity,
  FileText,
  Download,
  type LucideIcon,
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
    default:
      return (
        <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-500 text-xs font-medium px-2.5 py-1 rounded-full">
          {status}
        </span>
      );
  }
}

// ─── Severity badge ─────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded">
          <AlertTriangle className="w-3 h-3" /> Critical
        </span>
      );
    case 'high':
      return (
        <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-xs font-medium px-2 py-0.5 rounded">
          <AlertTriangle className="w-3 h-3" /> High
        </span>
      );
    case 'medium':
      return (
        <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded">
          <AlertTriangle className="w-3 h-3" /> Medium
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-600 text-xs font-medium px-2 py-0.5 rounded">
          Low
        </span>
      );
  }
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  colorClass,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  colorClass: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${colorClass}`} />
        <span className="text-sm text-zinc-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

// ─── Persona summary card ─────────────────────────────────────────────────────

function PersonaSummaryCard({ persona }: { persona: PersonaSummary }) {
  const passRate = persona.total_executions > 0
    ? ((persona.passed_executions / persona.total_executions) * 100).toFixed(1)
    : '0';

  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-zinc-900">{persona.persona_display_name}</h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
          persona.failed_executions === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {passRate}% pass
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <p className="text-lg font-semibold text-zinc-900">{persona.total_executions}</p>
          <p className="text-xs text-zinc-500">Total</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-green-600">{persona.passed_executions}</p>
          <p className="text-xs text-zinc-500">Passed</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-red-600">{persona.failed_executions}</p>
          <p className="text-xs text-zinc-500">Failed</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
        <span>Avg friction: {persona.avg_friction_score.toFixed(1)}</span>
        <span>Avg duration: {persona.avg_duration_seconds.toFixed(0)}s</span>
      </div>

      {(persona.top_issue_1 || persona.top_issue_2 || persona.top_issue_3) && (
        <div className="border-t border-zinc-100 pt-2 mt-2">
          <p className="text-xs font-medium text-zinc-700 mb-1">Top Issues:</p>
          <ul className="text-xs text-zinc-600 space-y-0.5">
            {persona.top_issue_1 && <li>• {persona.top_issue_1.substring(0, 60)}...</li>}
            {persona.top_issue_2 && <li>• {persona.top_issue_2.substring(0, 60)}...</li>}
            {persona.top_issue_3 && <li>• {persona.top_issue_3.substring(0, 60)}...</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Accessibility scorecard ──────────────────────────────────────────────────

function AccessibilityScorecard({ summary }: { summary: AccessibilitySummary }) {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4">
      <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-purple-600" />
        Accessibility Scorecard
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-zinc-500 mb-1">Total Checks</p>
          <p className="text-2xl font-bold text-zinc-900">{summary.total_checks}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-500 mb-1">Pass Rate</p>
          <p className="text-2xl font-bold text-green-600">
            {summary.total_checks > 0 
              ? ((summary.passed_checks / summary.total_checks) * 100).toFixed(1)
              : '0'}%
          </p>
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-4 mb-4">
        <p className="text-sm font-medium text-zinc-700 mb-2">Axe-Core Violations</p>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-red-50 rounded p-2 text-center">
            <p className="text-lg font-bold text-red-600">{summary.critical_issues}</p>
            <p className="text-xs text-red-700">Critical</p>
          </div>
          <div className="bg-orange-50 rounded p-2 text-center">
            <p className="text-lg font-bold text-orange-600">{summary.serious_issues}</p>
            <p className="text-xs text-orange-700">Serious</p>
          </div>
          <div className="bg-yellow-50 rounded p-2 text-center">
            <p className="text-lg font-bold text-yellow-600">{summary.moderate_issues}</p>
            <p className="text-xs text-yellow-700">Moderate</p>
          </div>
          <div className="bg-zinc-50 rounded p-2 text-center">
            <p className="text-lg font-bold text-zinc-600">{summary.minor_issues}</p>
            <p className="text-xs text-zinc-700">Minor</p>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-4">
        <p className="text-sm font-medium text-zinc-700 mb-2">WCAG 2.2 AA Pass Rates</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600">Keyboard Navigation</span>
            <span className={`text-sm font-medium ${summary.keyboard_nav_pass_rate >= 90 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.keyboard_nav_pass_rate.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600">Color Contrast</span>
            <span className={`text-sm font-medium ${summary.contrast_pass_rate >= 90 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.contrast_pass_rate.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600">Reflow</span>
            <span className={`text-sm font-medium ${summary.reflow_pass_rate >= 90 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.reflow_pass_rate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Issues list ─────────────────────────────────────────────────────────────

function IssuesList({ issues }: { issues: DeduplicatedIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-zinc-200 p-6 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
        <p className="text-zinc-600">No issues found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-zinc-200">
      <div className="p-4 border-b border-zinc-200">
        <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          Severity-Ranked Issues ({issues.length})
        </h3>
      </div>
      <div className="divide-y divide-zinc-100">
        {issues.map((issue) => (
          <div key={issue.issue_id} className="p-4 hover:bg-zinc-50">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={issue.severity} />
                <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">
                  {issue.category}
                </span>
              </div>
              <span className="text-xs text-zinc-500">
                {issue.affected_executions} execution{issue.affected_executions !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-sm text-zinc-900 mb-2">{issue.summary}</p>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span>First: {issue.first_occurrence_step}</span>
              <span>Personas: {issue.affected_personas}</span>
            </div>
            {issue.example_error_message && (
              <details className="mt-2">
                <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-700">
                  View example error
                </summary>
                <pre className="text-xs bg-zinc-100 p-2 rounded mt-1 overflow-x-auto">
                  {issue.example_error_message}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Technical drill-down ─────────────────────────────────────────────────────

function TechnicalDrillDown({
  executionId,
  details,
  loading,
}: {
  executionId: number;
  details: ExecutionDetail[] | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-zinc-200 p-6 text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-zinc-600">Loading execution details...</p>
      </div>
    );
  }

  if (!details || details.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-zinc-200 p-6 text-center">
        <p className="text-zinc-600">No execution details available</p>
      </div>
    );
  }

  const execInfo = details[0];

  return (
    <div className="bg-white rounded-lg border border-zinc-200">
      <div className="p-4 border-b border-zinc-200">
        <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Technical Drill-Down: {execInfo.persona_display_name} • {execInfo.flow_name}
        </h3>
      </div>

      {/* Execution metadata */}
      <div className="p-4 border-b border-zinc-100 bg-zinc-50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-zinc-500">Status:</span>{' '}
            <span className={`font-medium ${
              execInfo.status === 'passed' ? 'text-green-600' : 
              execInfo.status === 'failed' ? 'text-red-600' : 'text-zinc-900'
            }`}>
              {execInfo.status}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Duration:</span>{' '}
            <span className="font-medium">{execInfo.duration_seconds?.toFixed(1)}s</span>
          </div>
          <div>
            <span className="text-zinc-500">Friction:</span>{' '}
            <span className="font-medium">{execInfo.friction_score?.toFixed(1)}</span>
          </div>
          <div>
            <span className="text-zinc-500">Browser:</span>{' '}
            <span className="font-medium">{execInfo.browser}</span>
          </div>
        </div>
        {execInfo.error_message && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-xs font-medium text-red-800 mb-1">Error:</p>
            <p className="text-xs text-red-700">{execInfo.error_message}</p>
          </div>
        )}
      </div>

      {/* Steps timeline */}
      <div className="p-4">
        <h4 className="text-sm font-medium text-zinc-900 mb-3">Steps Timeline</h4>
        <div className="space-y-2">
          {details
            .filter(d => d.step_id !== null)
            .map((step) => (
              <div key={step.step_id} className="flex items-start gap-3 p-3 bg-zinc-50 rounded">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${
                  step.step_status === 'passed' ? 'bg-green-500' :
                  step.step_status === 'failed' ? 'bg-red-500' :
                  'bg-zinc-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-zinc-900">{step.step_name}</span>
                    <span className="text-xs bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded">
                      {step.step_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span>Order: {step.step_order}</span>
                    {step.step_started_at && (
                      <span>
                        {step.step_completed_at 
                          ? `${((new Date(step.step_completed_at).getTime() - new Date(step.step_started_at).getTime()) / 1000).toFixed(1)}s`
                          : 'Running...'}
                      </span>
                    )}
                  </div>
                  {step.step_error_message && (
                    <p className="text-xs text-red-600 mt-1">{step.step_error_message}</p>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Artifacts */}
      {details.some(d => d.artifact_file_path) && (
        <div className="p-4 border-t border-zinc-100">
          <h4 className="text-sm font-medium text-zinc-900 mb-3">Artifacts</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {details
              .filter(d => d.artifact_file_path)
              .map((artifact, idx) => (
                <div key={idx} className="p-3 bg-zinc-50 rounded text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-zinc-900">{artifact.artifact_type}</span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{artifact.artifact_file_path}</p>
                  {artifact.artifact_file_size_bytes && (
                    <p className="text-xs text-zinc-400">
                      {(artifact.artifact_file_size_bytes / 1024).toFixed(1)} KB
                    </p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LLM Analysis section ─────────────────────────────────────────────────────

function LlmAnalysisSection({ analysis }: { analysis: LlmAnalysisRecord[] }) {
  if (!analysis || analysis.length === 0) {
    return null;
  }

  const failureSummaries = analysis.filter(a => a.task_type === 'failure_summarization' && a.status === 'completed');

  if (failureSummaries.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-zinc-200">
      <div className="p-4 border-b border-zinc-200">
        <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-purple-600" />
          AI Failure Analysis
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded ml-2">
            Advisory Only
          </span>
        </h3>
      </div>
      <div className="divide-y divide-zinc-100">
        {failureSummaries.map((record) => (
          <div key={record.id} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">
                Model: {record.model_used}
              </span>
              <span className="text-xs text-zinc-500">
                {record.duration_ms ? `${record.duration_ms}ms` : ''}
              </span>
            </div>
            {record.result_json && (
              <div className="bg-purple-50 border border-purple-100 rounded p-3">
                <p className="text-sm text-purple-900 whitespace-pre-wrap">
                  {typeof record.result_json === 'string' 
                    ? record.result_json 
                    : JSON.stringify(record.result_json, null, 2)}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NarrativeReportPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = use(params);
  const id = Number(runId);

  const [report, setReport] = useState<NarrativeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<number | null>(null);
  const [executionDetail, setExecutionDetail] = useState<ExecutionDetail[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [llmAnalysis, setLlmAnalysis] = useState<LlmAnalysisRecord[]>([]);

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true);
        const result = await getNarrativeReport(id);
        if (result.success && result.data) {
          setReport(result.data);
        } else {
          setError(result.error || 'Failed to load report');
        }
      } catch {
        setError('An error occurred while loading the report');
      } finally {
        setLoading(false);
      }
    }
    loadReport();

    // Load LLM analysis in parallel
    async function loadLlmAnalysis() {
      try {
        const result = await getLlmAnalysisForRun(id);
        if (result.success && result.data) {
          setLlmAnalysis(result.data);
        }
      } catch {
        console.error('Failed to load LLM analysis');
      }
    }
    loadLlmAnalysis();
  }, [id]);

  async function loadExecutionDetail(executionId: number) {
    try {
      setLoadingDetail(true);
      const result = await getExecutionDetail(executionId);
      if (result.success && result.data) {
        setExecutionDetail(result.data);
      } else {
        console.error('Failed to load execution detail:', result.error);
      }
    } catch {
      console.error('Error loading execution detail');
    } finally {
      setLoadingDetail(false);
    }
  }

  function handleExecutionClick(executionId: number) {
    if (selectedExecution === executionId) {
      setSelectedExecution(null);
      setExecutionDetail(null);
    } else {
      setSelectedExecution(executionId);
      loadExecutionDetail(executionId);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-600">Loading report...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !report) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-zinc-600">{error || 'Failed to load report'}</p>
            <Link
              href="/dashboard/runs"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mt-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to runs
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const { run_summary, persona_summaries, accessibility_summary, issues } = report;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/dashboard/runs/${runId}`}
            className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to run details
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 mb-1">
                {run_summary.run_name}
              </h1>
              <p className="text-sm text-zinc-500">
                {run_summary.site_name} • {run_summary.environment_name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={run_summary.run_status} />
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 text-sm">
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            </div>
          </div>
        </div>

        {/* Run Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            label="Total Executions"
            value={run_summary.total_executions}
            icon={Activity}
            colorClass="text-blue-600"
          />
          <SummaryCard
            label="Successful"
            value={run_summary.successful_executions}
            icon={CheckCircle}
            colorClass="text-green-600"
          />
          <SummaryCard
            label="Failed"
            value={run_summary.failed_executions}
            icon={XCircle}
            colorClass="text-red-600"
          />
          <SummaryCard
            label="Avg Friction"
            value={run_summary.avg_friction_score.toFixed(1)}
            icon={AlertTriangle}
            colorClass="text-amber-600"
          />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Persona Summaries */}
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Persona Performance
            </h2>
            <div className="space-y-3">
              {persona_summaries.map((persona) => (
                <PersonaSummaryCard key={persona.persona_id} persona={persona} />
              ))}
            </div>
          </div>

          {/* Accessibility Scorecard */}
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Accessibility
            </h2>
            <AccessibilityScorecard summary={accessibility_summary} />
          </div>
        </div>

        {/* Issues List */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            Issues Analysis
          </h2>
          <IssuesList issues={issues} />
        </div>

        {/* LLM Analysis */}
        {llmAnalysis.length > 0 && (
          <div className="mb-6">
            <LlmAnalysisSection analysis={llmAnalysis} />
          </div>
        )}

        {/* Technical Drill-Down */}
        {selectedExecution && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Technical Drill-Down
              </h2>
              <button
                onClick={() => setSelectedExecution(null)}
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                Close
              </button>
            </div>
            <TechnicalDrillDown
              executionId={selectedExecution}
              details={executionDetail}
              loading={loadingDetail}
            />
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-zinc-500 py-4 border-t border-zinc-200">
          <p>Report generated on {new Date().toLocaleString()}</p>
          <p className="mt-1">
            Run duration:{' '}
            {run_summary.duration_seconds
              ? `${Math.floor(run_summary.duration_seconds / 60)}m ${Math.floor(run_summary.duration_seconds % 60)}s`
              : '—'}
          </p>
        </div>
      </div>
    </AppShell>
  );
}
