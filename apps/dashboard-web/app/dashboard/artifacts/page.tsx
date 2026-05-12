'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import AppShell from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import {
  Trash2,
  Clock,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  getRetentionAudit,
  getRetentionConfig,
  updateRetentionConfig,
  listExpiredArtifacts,
  runInlineCleanup,
  type RetentionAuditRow,
  type RetentionConfigRow,
  type ExpiredArtifact,
  type CleanupResult,
} from '@/app/actions/artifacts';

// ─── Utility helpers ──────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Retention Config row (inline edit) ───────────────────────────────────────

function ConfigRow({
  row,
  onSaved,
}: {
  row: RetentionConfigRow;
  onSaved: (updated: RetentionConfigRow) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState(String(row.retention_days));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editingRef = useRef(editing);
  editingRef.current = editing;

  // Keep local days in sync when the parent updates the row (e.g. after save)
  // but only when the row is not currently being edited.
  useEffect(() => {
    if (!editingRef.current) {
      setDays(String(row.retention_days));
    }
  }, [row.retention_days]);

  async function handleSave() {
    const parsed = parseInt(days, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setError('Must be a positive integer');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await updateRetentionConfig(row.artifact_type, parsed);
      if (result.success && result.row) {
        onSaved(result.row);
        setEditing(false);
      } else {
        setError(result.error ?? 'Save failed');
      }
    } catch {
      setError('Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDays(String(row.retention_days));
    setEditing(false);
    setError(null);
  }

  return (
    <tr className="hover:bg-zinc-50 transition-colors">
      <td className="px-4 py-3 font-mono text-sm text-zinc-700">{row.artifact_type}</td>
      <td className="px-4 py-3 text-sm text-zinc-500">{row.notes ?? '—'}</td>
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={days}
              onChange={e => setDays(e.target.value)}
              className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-zinc-500">days</span>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-zinc-700">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            {row.retention_days} days
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {row.is_active ? (
          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
            <CheckCircle className="w-3 h-3" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-500 text-xs font-medium px-2 py-0.5 rounded-full">
            Inactive
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-400">{formatDate(row.updated_date)}</td>
      <td className="px-4 py-3 text-right">
        {editing ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </td>
    </tr>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export default function ArtifactsPage() {
  const [auditRows, setAuditRows] = useState<RetentionAuditRow[]>([]);
  const [config, setConfig] = useState<RetentionConfigRow[]>([]);
  const [expired, setExpired] = useState<ExpiredArtifact[]>([]);
  const [expiredOpen, setExpiredOpen] = useState(false);

  const [loadingAudit, setLoadingAudit] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingExpired, setLoadingExpired] = useState(false);

  const [auditError, setAuditError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [expiredError, setExpiredError] = useState<string | null>(null);

  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);
    setAuditError(null);
    try {
      const result = await getRetentionAudit();
      if (result.success && result.rows) {
        setAuditRows(result.rows);
      } else {
        setAuditError(result.error ?? 'Failed to load audit');
      }
    } catch {
      setAuditError('Unexpected error loading audit');
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    setConfigError(null);
    try {
      const result = await getRetentionConfig();
      if (result.success && result.config) {
        setConfig(result.config);
      } else {
        setConfigError(result.error ?? 'Failed to load config');
      }
    } catch {
      setConfigError('Unexpected error loading config');
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  const loadExpired = useCallback(async () => {
    setLoadingExpired(true);
    setExpiredError(null);
    try {
      const result = await listExpiredArtifacts(200);
      if (result.success && result.artifacts) {
        setExpired(result.artifacts);
      } else {
        setExpiredError(result.error ?? 'Failed to load expired artifacts');
      }
    } catch {
      setExpiredError('Unexpected error loading expired artifacts');
    } finally {
      setLoadingExpired(false);
    }
  }, []);

  useEffect(() => {
    loadAudit();
    loadConfig();
  }, [loadAudit, loadConfig]);

  // Load expired list when the section is expanded
  function handleToggleExpired() {
    const opening = !expiredOpen;
    setExpiredOpen(opening);
    if (opening && expired.length === 0 && !loadingExpired) {
      loadExpired();
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  async function handleRunCleanup() {
    setCleanupRunning(true);
    setCleanupResult(null);
    setCleanupError(null);
    try {
      const result = await runInlineCleanup();
      if (result.success && result.result) {
        setCleanupResult(result.result);
        // Refresh audit after cleanup
        await loadAudit();
        if (expiredOpen) {
          // Section is open — refresh immediately
          await loadExpired();
        } else {
          // Section is closed — clear stale list so it reloads on next open
          setExpired([]);
        }
      } else {
        setCleanupError(result.error ?? 'Cleanup failed');
      }
    } catch {
      setCleanupError('Unexpected error during cleanup');
    } finally {
      setCleanupRunning(false);
    }
  }

  // ── Config row update callback ──────────────────────────────────────────────

  function handleConfigSaved(updated: RetentionConfigRow) {
    setConfig(prev =>
      prev.map(r => (r.artifact_type === updated.artifact_type ? { ...r, ...updated } : r)),
    );
  }

  // ── Totals ──────────────────────────────────────────────────────────────────

  const totalExpired = auditRows.reduce((s, r) => s + r.expired_count, 0);
  const totalSize = auditRows.reduce((s, r) => s + r.total_size_bytes, 0);
  const totalArtifacts = auditRows.reduce((s, r) => s + r.total_count, 0);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="space-y-8">

        {/* ── Header ── */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-zinc-900">Artifacts</h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => { loadAudit(); loadConfig(); }}
              disabled={loadingAudit || loadingConfig}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${(loadingAudit || loadingConfig) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="destructive"
              onClick={handleRunCleanup}
              disabled={cleanupRunning}
            >
              {cleanupRunning
                ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Running…</>
                : <><Trash2 className="w-4 h-4 mr-1" /> Run Cleanup Now</>
              }
            </Button>
          </div>
        </div>

        {/* ── Cleanup result banner ── */}
        {cleanupError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{cleanupError}</span>
          </div>
        )}
        {cleanupResult && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-start gap-3 text-green-800 text-sm">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
            <div>
              <p className="font-semibold mb-1">Cleanup completed</p>
              <ul className="list-disc list-inside space-y-0.5 text-green-700">
                <li>Found: {cleanupResult.found} expired artifact(s)</li>
                <li>Files deleted from disk: {cleanupResult.files_deleted}</li>
                <li>Files already missing: {cleanupResult.files_missing}</li>
                <li>File errors (retained): {cleanupResult.file_errors}</li>
                <li>DB records removed: {cleanupResult.db_deleted}</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-5 flex items-center gap-4">
            <div className="bg-blue-50 rounded-full p-3">
              <HardDrive className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Total artifacts</p>
              <p className="text-2xl font-bold text-zinc-900">{totalArtifacts.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-5 flex items-center gap-4">
            <div className="bg-amber-50 rounded-full p-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Expired</p>
              <p className="text-2xl font-bold text-zinc-900">{totalExpired.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-5 flex items-center gap-4">
            <div className="bg-zinc-100 rounded-full p-3">
              <HardDrive className="w-5 h-5 text-zinc-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Total size</p>
              <p className="text-2xl font-bold text-zinc-900">{formatBytes(totalSize)}</p>
            </div>
          </div>
        </div>

        {/* ── Audit Summary section ── */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-800 mb-3">Audit Summary</h2>
          {auditError ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">{auditError}</div>
          ) : loadingAudit ? (
            <div className="flex items-center gap-2 text-zinc-500 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading audit…
            </div>
          ) : auditRows.length === 0 ? (
            <div className="bg-white rounded-lg border border-zinc-200 p-8 text-center text-zinc-500 text-sm">
              No artifact records found.
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-600">Artifact Type</th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-600">Total</th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-600">Expired</th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-600">Total Size</th>
                    <th className="px-4 py-3 text-center font-semibold text-zinc-600">Oldest</th>
                    <th className="px-4 py-3 text-center font-semibold text-zinc-600">Retention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {auditRows.map(row => (
                    <tr key={row.artifact_type} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-zinc-700">{row.artifact_type}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">{row.total_count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        {row.expired_count > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> {row.expired_count.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500">{formatBytes(row.total_size_bytes)}</td>
                      <td className="px-4 py-3 text-center text-zinc-500 text-xs">{formatDate(row.oldest_artifact)}</td>
                      <td className="px-4 py-3 text-center">
                        {row.retention_days !== null ? (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
                            <Clock className="w-3 h-3" /> {row.retention_days}d
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">not configured</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Retention Config section ── */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-800 mb-3">Retention Configuration</h2>
          {configError ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">{configError}</div>
          ) : loadingConfig ? (
            <div className="flex items-center gap-2 text-zinc-500 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading config…
            </div>
          ) : config.length === 0 ? (
            <div className="bg-white rounded-lg border border-zinc-200 p-8 text-center text-zinc-500 text-sm">
              No retention config rows found. Run migration 0019 to seed defaults.
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-600">Artifact Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-600">Notes</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-600">Retention</th>
                    <th className="px-4 py-3 text-center font-semibold text-zinc-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-600">Updated</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {config.map(row => (
                    <ConfigRow key={row.id} row={row} onSaved={handleConfigSaved} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Expired Artifacts section (collapsible) ── */}
        <section>
          <button
            type="button"
            onClick={handleToggleExpired}
            className="flex items-center gap-2 text-lg font-semibold text-zinc-800 hover:text-zinc-900 mb-3 w-full text-left"
          >
            {expiredOpen
              ? <ChevronDown className="w-5 h-5 text-zinc-500" />
              : <ChevronRight className="w-5 h-5 text-zinc-500" />
            }
            Expired Artifacts
            {totalExpired > 0 && (
              <span className="ml-1 text-sm font-normal text-red-600">
                ({totalExpired.toLocaleString()} expired)
              </span>
            )}
          </button>

          {expiredOpen && (
            <>
              {expiredError ? (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">{expiredError}</div>
              ) : loadingExpired ? (
                <div className="flex items-center gap-2 text-zinc-500 py-8 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading expired artifacts…
                </div>
              ) : expired.length === 0 ? (
                <div className="bg-white rounded-lg border border-zinc-200 p-8 text-center text-sm">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-zinc-600">No expired artifacts found.</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Showing up to 200 expired artifacts. Use &quot;Run Cleanup Now&quot; to remove them.
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-zinc-600">Type</th>
                        <th className="px-4 py-3 text-left font-semibold text-zinc-600">File Path</th>
                        <th className="px-4 py-3 text-right font-semibold text-zinc-600">Size</th>
                        <th className="px-4 py-3 text-center font-semibold text-zinc-600">Retention Date</th>
                        <th className="px-4 py-3 text-center font-semibold text-zinc-600">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {expired.map(artifact => (
                        <tr key={artifact.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-4 py-2 font-mono text-xs text-zinc-600">{artifact.artifact_type}</td>
                          <td className="px-4 py-2 text-xs text-zinc-500 max-w-md truncate" title={artifact.file_path}>
                            {artifact.file_path}
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-zinc-500">
                            {artifact.file_size_bytes !== null
                              ? formatBytes(artifact.file_size_bytes)
                              : '—'}
                          </td>
                          <td className="px-4 py-2 text-center text-xs text-red-600">
                            {formatDate(artifact.retention_date)}
                          </td>
                          <td className="px-4 py-2 text-center text-xs text-zinc-400">
                            {formatDate(artifact.created_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

      </div>
    </AppShell>
  );
}
