'use client';

/**
 * LLM Benchmark page — Phase 8
 *
 * Displays the latest model benchmark results and history.
 * Allows the operator to trigger a new benchmark run against the configured Ollama instance.
 *
 * Route: /dashboard/settings/llm-benchmark
 */

import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/app-shell';
import { BrainCircuit, CheckCircle, XCircle, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  listLatestBenchmarkResults,
  listBenchmarkRunHistory,
  storeBenchmarkResults,
  type LlmBenchmarkRecord,
  type LlmBenchmarkRunSummary,
} from '@/app/actions/llmAnalysis';

// ─── Quality bar ──────────────────────────────────────────────────────────────

function QualityBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-zinc-400 text-xs">—</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-zinc-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-600">{pct}%</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LlmBenchmarkPage() {
  const [records, setRecords] = useState<LlmBenchmarkRecord[]>([]);
  const [history, setHistory] = useState<LlmBenchmarkRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [benchmarking, setBenchmarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [latestRes, historyRes] = await Promise.all([
        listLatestBenchmarkResults(),
        listBenchmarkRunHistory(),
      ]);
      if (latestRes.success && latestRes.records) {
        setRecords(latestRes.records);
        setLastRunAt(latestRes.records[0]?.run_at ?? null);
      }
      if (historyRes.success && historyRes.runs) {
        setHistory(historyRes.runs);
      }
    } catch {
      setError('Failed to load benchmark data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRunBenchmark() {
    setBenchmarking(true);
    setBenchmarkError(null);
    try {
      // Call the API route to trigger benchmarking on the runner/Ollama side
      const res = await fetch('/api/llm/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setBenchmarkError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as {
        run_at?: string;
        probes?: Array<{
          model_id: string;
          task_type: 'selector_healing' | 'failure_summarization';
          available: boolean;
          latency_ms?: number | null;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          response_parseable?: boolean | null;
          quality_score?: number | null;
          error_message?: string | null;
        }>;
      };
      if (json.run_at && json.probes) {
        await storeBenchmarkResults(json.run_at, json.probes);
        await loadData();
      }
    } catch (err) {
      setBenchmarkError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBenchmarking(false);
    }
  }

  // Group records by model
  const modelIds = Array.from(new Set(records.map(r => r.model_id)));

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrainCircuit className="w-6 h-6 text-violet-500" />
            <div>
              <h1 className="text-xl font-bold text-zinc-900">LLM Benchmark</h1>
              <p className="text-sm text-zinc-500">
                Compare Ollama model performance for selector healing and failure summarization.
                <span className="ml-2 text-violet-500 italic">All results are advisory only.</span>
              </p>
            </div>
          </div>
          <Button
            onClick={handleRunBenchmark}
            disabled={benchmarking}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-2 rounded-lg"
          >
            {benchmarking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {benchmarking ? 'Benchmarking…' : 'Run Benchmark'}
          </Button>
        </div>

        {benchmarkError && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {benchmarkError}
          </div>
        )}

        {/* Latest results */}
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">Latest Benchmark Results</h2>
            {lastRunAt && (
              <span className="ml-auto text-xs text-zinc-400">
                Run at {new Date(lastRunAt).toLocaleString()}
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-600">{error}</div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              No benchmark results yet. Click <strong>Run Benchmark</strong> to test available models.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-zinc-600 text-xs">Model</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-zinc-600 text-xs">Task</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-zinc-600 text-xs">Available</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-zinc-600 text-xs">Latency</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-zinc-600 text-xs">Parseable</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-zinc-600 text-xs">Quality</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-zinc-600 text-xs">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {modelIds.flatMap(modelId => {
                    const modelRecords = records.filter(r => r.model_id === modelId);
                    return modelRecords.map((record, idx) => (
                      <tr key={record.id} className="hover:bg-zinc-50 transition-colors">
                        {idx === 0 && (
                          <td className="px-4 py-2.5 text-zinc-900 text-xs font-mono font-medium align-top" rowSpan={modelRecords.length}>
                            {record.model_id}
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-zinc-600 text-xs capitalize">
                          {record.task_type.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {record.available
                            ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                            : <XCircle className="w-4 h-4 text-zinc-300 mx-auto" />}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-zinc-600 font-mono">
                          {record.latency_ms !== null
                            ? record.latency_ms < 1000
                              ? `${record.latency_ms}ms`
                              : `${(record.latency_ms / 1000).toFixed(1)}s`
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {record.response_parseable === true
                            ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                            : record.response_parseable === false
                            ? <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                            : <span className="text-zinc-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <QualityBar score={record.quality_score} />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-red-600 max-w-xs truncate">
                          {record.error_message ?? <span className="text-zinc-300">—</span>}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Run history */}
        {history.length > 0 && (
          <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50">
              <h2 className="text-sm font-semibold text-zinc-700">Benchmark History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-zinc-600 text-xs">Run At</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-zinc-600 text-xs">Models</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-zinc-600 text-xs">Avg Quality</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-zinc-600 text-xs">Min Latency</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-zinc-600 text-xs">Max Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {history.map((run, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-zinc-700">
                        {new Date(run.run_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs text-zinc-600">{run.model_count}</td>
                      <td className="px-4 py-2.5">
                        <QualityBar score={run.avg_quality_score} />
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-zinc-500 font-mono">
                        {run.min_latency_ms !== null
                          ? run.min_latency_ms < 1000 ? `${run.min_latency_ms}ms` : `${(run.min_latency_ms / 1000).toFixed(1)}s`
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-zinc-500 font-mono">
                        {run.max_latency_ms !== null
                          ? run.max_latency_ms < 1000 ? `${run.max_latency_ms}ms` : `${(run.max_latency_ms / 1000).toFixed(1)}s`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
