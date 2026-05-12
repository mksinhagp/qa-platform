'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/app-shell';
import {
  getSite,
  updateSite,
  listSiteEnvironments,
  createSiteEnvironment,
  updateSiteEnvironment,
  listSiteCredentialBindings,
  createSiteCredentialBinding,
  deleteSiteCredentialBinding,
  listPaymentProfileBindings,
  createPaymentProfileBinding,
  deletePaymentProfileBinding,
  listEmailInboxBindings,
  createEmailInboxBinding,
  deleteEmailInboxBinding,
  type Site,
  type SiteEnvironment,
  type SiteCredentialBinding,
  type PaymentProfileBinding,
  type EmailInboxBinding,
} from '@/app/actions/sites';
import { listSecretRecords, type SecretRecord } from '@/app/actions/credentials';
import { listPaymentProfiles, type PaymentProfile } from '@/app/actions/payment-profiles';
import { listEmailInboxes, type EmailInbox } from '@/app/actions/email-inboxes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Globe, Layers, Key, CreditCard, Mail, Edit2, Plus, Trash2, Save,
  CheckCircle, XCircle, Loader2, X, ArrowLeft,
  Settings2, GitBranch, MousePointer,
} from 'lucide-react';
import {
  listCapabilities,
  upsertCapability,
  batchUpsertCapabilities,
  listFlowMappings,
  upsertFlowMapping,
  listSelectorEntries,
  createSelectorEntry,
  updateSelectorEntry,
  type SiteCapability,
  type SiteFlowMapping,
  type SiteSelectorEntry,
} from '@/app/actions/capabilities';

// ─── Tab definition ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',         label: 'Overview',        icon: Globe },
  { id: 'environments',     label: 'Environments',    icon: Layers },
  { id: 'capabilities',     label: 'Capabilities',    icon: Settings2 },
  { id: 'flows',            label: 'Flows',           icon: GitBranch },
  { id: 'selectors',        label: 'Selectors',       icon: MousePointer },
  { id: 'credentials',      label: 'Credentials',     icon: Key },
  { id: 'payment-profiles', label: 'Payment Profiles',icon: CreditCard },
  { id: 'email-inboxes',    label: 'Email Inboxes',   icon: Mail },
] as const;

type TabId = typeof TABS[number]['id'];

function TabBar({ active, siteId }: { active: TabId; siteId: string }) {
  return (
    <div className="flex gap-1 border-b border-zinc-200 mb-6 overflow-x-auto">
      {TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={`/dashboard/sites/${siteId}?tab=${tab.id}`}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              isActive
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 hover:border-zinc-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

// ─── Shared inline form helpers ───────────────────────────────────────────────

function InlineError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="text-red-500 text-xs mt-1">{msg}</p>;
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
      <CheckCircle className="w-3 h-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-500 text-xs font-medium px-2 py-0.5 rounded-full">
      <XCircle className="w-3 h-3" /> Inactive
    </span>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ site, onUpdated }: { site: Site; onUpdated: (s: Site) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(site.name);
  const [baseUrl, setBaseUrl] = useState(site.base_url);
  const [description, setDescription] = useState(site.description ?? '');
  const [isActive, setIsActive] = useState(site.is_active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim() || !baseUrl.trim()) {
      setError('Name and Base URL are required');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateSite({ id: site.id, name, base_url: baseUrl, description: description || undefined, is_active: isActive });
    setSaving(false);
    if (result.success && result.site) {
      onUpdated(result.site);
      setEditing(false);
    } else {
      setError(result.error ?? 'Failed to update site');
    }
  }

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <h2 className="text-lg font-semibold text-zinc-900">Site details</h2>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Edit2 className="w-4 h-4 mr-1" /> Edit
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm max-w-lg">
          <dt className="text-zinc-500">Name</dt>
          <dd className="text-zinc-900 font-medium">{site.name}</dd>
          <dt className="text-zinc-500">Base URL</dt>
          <dd className="text-zinc-900 break-all">{site.base_url}</dd>
          <dt className="text-zinc-500">Description</dt>
          <dd className="text-zinc-900">{site.description ?? <span className="text-zinc-400 italic">none</span>}</dd>
          <dt className="text-zinc-500">Status</dt>
          <dd><StatusBadge active={site.is_active} /></dd>
          <dt className="text-zinc-500">Created</dt>
          <dd className="text-zinc-900">{new Date(site.created_date).toLocaleDateString()}</dd>
        </dl>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg">
      <h2 className="text-lg font-semibold text-zinc-900">Edit site</h2>
      <div>
        <Label htmlFor="ov-name">Name <span className="text-red-500">*</span></Label>
        <Input id="ov-name" className="mt-1" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="ov-url">Base URL <span className="text-red-500">*</span></Label>
        <Input id="ov-url" className="mt-1" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="ov-desc">Description</Label>
        <textarea
          id="ov-desc"
          rows={2}
          placeholder="Optional description"
          className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="ov-active"
          checked={isActive}
          onCheckedChange={v => setIsActive(v === true)}
        />
        <Label htmlFor="ov-active">Active</Label>
      </div>
      {error && <InlineError msg={error} />}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Save
        </Button>
        <Button variant="outline" onClick={() => { setEditing(false); setError(null); }}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Environments tab ─────────────────────────────────────────────────────────

interface EnvFormState {
  name: string;
  base_url: string;
  description: string;
  is_active: boolean;
}

function EnvironmentsTab({ siteId }: { siteId: number }) {
  const [envs, setEnvs] = useState<SiteEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<EnvFormState>({ name: '', base_url: '', description: '', is_active: true });
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EnvFormState>({ name: '', base_url: '', description: '', is_active: true });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listSiteEnvironments(siteId);
    setLoading(false);
    if (result.success && result.environments) setEnvs(result.environments);
    else setError(result.error ?? 'Failed to load environments');
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.base_url.trim()) {
      setAddError('Name and Base URL are required');
      return;
    }
    setAddSaving(true);
    setAddError(null);
    const result = await createSiteEnvironment({ site_id: siteId, name: addForm.name, base_url: addForm.base_url, description: addForm.description || undefined });
    setAddSaving(false);
    if (result.success) {
      setShowAdd(false);
      setAddForm({ name: '', base_url: '', description: '', is_active: true });
      load();
    } else {
      setAddError(result.error ?? 'Failed to create environment');
    }
  }

  function startEdit(env: SiteEnvironment) {
    setEditingId(env.id);
    setEditForm({ name: env.name, base_url: env.base_url, description: env.description ?? '', is_active: env.is_active });
    setEditError(null);
  }

  async function handleEdit(envId: number) {
    if (!editForm.name.trim() || !editForm.base_url.trim()) {
      setEditError('Name and Base URL are required');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    const result = await updateSiteEnvironment({ id: envId, name: editForm.name, base_url: editForm.base_url, description: editForm.description || undefined, is_active: editForm.is_active });
    setEditSaving(false);
    if (result.success) {
      setEditingId(null);
      load();
    } else {
      setEditError(result.error ?? 'Failed to update environment');
    }
  }

  if (loading) return <div className="flex items-center text-zinc-500 text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  if (error) return <div className="text-red-600 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-zinc-900">Environments</h2>
        <Button size="sm" onClick={() => { setShowAdd(true); setAddError(null); }}>
          <Plus className="w-4 h-4 mr-1" /> Add environment
        </Button>
      </div>

      {showAdd && (
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
          <h3 className="text-sm font-semibold text-blue-900">New environment</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Name *</Label>
              <Input className="mt-1 h-8 text-sm" placeholder="staging" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Base URL *</Label>
              <Input className="mt-1 h-8 text-sm" placeholder="https://staging.example.com" value={addForm.base_url} onChange={e => setAddForm(f => ({ ...f, base_url: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Input className="mt-1 h-8 text-sm" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          {addError && <InlineError msg={addError} />}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={addSaving}>
              {addSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />} Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setAddError(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {envs.length === 0 ? (
        <div className="text-center py-10 text-zinc-500 text-sm">
          No environments configured. Use the button above to add one.
        </div>
      ) : (
        <div className="border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-zinc-600">Name</th>
                <th className="px-4 py-2 text-left font-semibold text-zinc-600">Base URL</th>
                <th className="px-4 py-2 text-center font-semibold text-zinc-600">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {envs.map(env => (
                editingId === env.id ? (
                  <tr key={env.id} className="bg-blue-50">
                    <td className="px-4 py-2">
                      <Input className="h-7 text-sm" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                    </td>
                    <td className="px-4 py-2">
                      <Input className="h-7 text-sm" value={editForm.base_url} onChange={e => setEditForm(f => ({ ...f, base_url: e.target.value }))} />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Checkbox checked={editForm.is_active} onCheckedChange={v => setEditForm(f => ({ ...f, is_active: v === true }))} />
                        <span className="text-xs text-zinc-600">Active</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {editError && <InlineError msg={editError} />}
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleEdit(env.id)} disabled={editSaving}>
                          {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingId(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={env.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-2 font-medium text-zinc-900">{env.name}</td>
                    <td className="px-4 py-2 text-zinc-500 break-all">{env.base_url}</td>
                    <td className="px-4 py-2 text-center"><StatusBadge active={env.is_active} /></td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => startEdit(env)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Generic binding tab ──────────────────────────────────────────────────────
// Reusable for credentials, payment profiles, email inboxes

interface BindingRow {
  id: number;
  env_name: string;
  resource_name: string;
  resource_detail: string;
  role_tag: string;
}

function BindingTab<TResource extends { id: number }>({
  title,
  icon: Icon,
  envs,
  bindings,
  resources,
  getBindingRow,
  resourceLabel,
  resourceOptions,
  onAdd,
  onDelete,
  loading,
}: {
  title: string;
  icon: React.ElementType;
  envs: SiteEnvironment[];
  bindings: BindingRow[];
  resources: TResource[];
  getBindingRow: (b: BindingRow) => React.ReactNode;
  resourceLabel: string;
  resourceOptions: Array<{ value: string; label: string }>;
  onAdd: (envId: number, resourceId: number, roleTag: string) => Promise<{ success: boolean; error?: string }>;
  onDelete: (id: number) => Promise<{ success: boolean; error?: string }>;
  loading: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [envId, setEnvId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [roleTag, setRoleTag] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleAdd() {
    if (!envId || !resourceId || !roleTag.trim()) {
      setAddError('All fields are required');
      return;
    }
    setAddSaving(true);
    setAddError(null);
    const result = await onAdd(parseInt(envId, 10), parseInt(resourceId, 10), roleTag.trim());
    setAddSaving(false);
    if (result.success) {
      setShowAdd(false);
      setEnvId(''); setResourceId(''); setRoleTag('');
    } else {
      setAddError(result.error ?? 'Failed to create binding');
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  }

  if (loading) return <div className="flex items-center text-zinc-500 text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <Button size="sm" onClick={() => { setShowAdd(true); setAddError(null); }} disabled={envs.length === 0 || resources.length === 0}>
          <Plus className="w-4 h-4 mr-1" /> Bind {resourceLabel.toLowerCase()}
        </Button>
      </div>

      {envs.length === 0 && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          Add at least one environment before binding {title.toLowerCase()}.
        </div>
      )}
      {envs.length > 0 && resources.length === 0 && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          No {title.toLowerCase()} configured in settings yet.
        </div>
      )}

      {showAdd && (
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
          <h3 className="text-sm font-semibold text-blue-900">New binding</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor={`bt-${resourceLabel}-env`} className="text-xs">Environment *</Label>
              <select
                id={`bt-${resourceLabel}-env`}
                className="mt-1 w-full text-sm border border-zinc-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={envId}
                onChange={e => setEnvId(e.target.value)}
              >
                <option value="">— select —</option>
                {envs.map(env => <option key={env.id} value={env.id}>{env.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor={`bt-${resourceLabel}-resource`} className="text-xs">{resourceLabel} *</Label>
              <select
                id={`bt-${resourceLabel}-resource`}
                className="mt-1 w-full text-sm border border-zinc-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={resourceId}
                onChange={e => setResourceId(e.target.value)}
              >
                <option value="">— select —</option>
                {resourceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Role tag *</Label>
              <Input className="mt-1 h-8 text-sm" placeholder="registrant" value={roleTag} onChange={e => setRoleTag(e.target.value)} />
            </div>
          </div>
          {addError && <InlineError msg={addError} />}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={addSaving}>
              {addSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />} Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setAddError(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {bindings.length === 0 ? (
        <div className="text-center py-10 text-zinc-500 text-sm">
          No bindings configured. Use the button above to bind a {resourceLabel.toLowerCase()} to an environment.
        </div>
      ) : (
        <div className="border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-zinc-600">Environment</th>
                <th className="px-4 py-2 text-left font-semibold text-zinc-600">{resourceLabel}</th>
                <th className="px-4 py-2 text-left font-semibold text-zinc-600">Role tag</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {bindings.map(b => (
                <tr key={b.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-2 font-medium text-zinc-900">{b.env_name}</td>
                  <td className="px-4 py-2 text-zinc-700">{getBindingRow(b)}</td>
                  <td className="px-4 py-2">
                    <span className="inline-block bg-zinc-100 text-zinc-600 text-xs px-2 py-0.5 rounded font-mono">{b.role_tag}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(b.id)}
                      disabled={deletingId === b.id}
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                      aria-label="Remove binding"
                    >
                      {deletingId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Capabilities tab ────────────────────────────────────────────────────────

const WELL_KNOWN_CAPABILITIES = [
  { key: 'registration', label: 'Registration' },
  { key: 'login', label: 'Login' },
  { key: 'email_verification', label: 'Email Verification' },
  { key: 'password_reset', label: 'Password Reset' },
  { key: 'payment', label: 'Payment / Checkout' },
  { key: 'donation', label: 'Donations' },
  { key: 'profile_management', label: 'Profile Management' },
  { key: 'search', label: 'Search' },
  { key: 'newsletter', label: 'Newsletter Signup' },
  { key: 'contact_form', label: 'Contact Form' },
];

function CapabilitiesTab({ siteId }: { siteId: number }) {
  const [caps, setCaps] = useState<SiteCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [localState, setLocalState] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listCapabilities(siteId);
    setLoading(false);
    if (result.success && 'capabilities' in result) {
      setCaps(result.capabilities);
      const state: Record<string, boolean> = {};
      result.capabilities.forEach(c => { state[c.capability_key] = c.is_enabled; });
      setLocalState(state);
    } else if (!result.success) {
      setError(result.error);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  function toggle(key: string) {
    setLocalState(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      setDirty(true);
      return updated;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const capabilities = WELL_KNOWN_CAPABILITIES.map(c => ({
      key: c.key,
      enabled: localState[c.key] ?? false,
    }));
    const result = await batchUpsertCapabilities({ site_id: siteId, capabilities });
    setSaving(false);
    if (result.success) {
      setDirty(false);
      load();
    } else if (!result.success) {
      setError(result.error);
    }
  }

  if (loading) return <div className="flex items-center text-zinc-500 text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;
  if (error) return <div className="text-red-600 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-zinc-900">Site Capabilities</h2>
        <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Save
        </Button>
      </div>
      <p className="text-sm text-zinc-500">Toggle the capabilities this site supports. This drives which test flows are available.</p>
      <div className="grid grid-cols-2 gap-3">
        {WELL_KNOWN_CAPABILITIES.map(c => (
          <label
            key={c.key}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              localState[c.key]
                ? 'border-blue-300 bg-blue-50'
                : 'border-zinc-200 bg-white hover:bg-zinc-50'
            }`}
          >
            <Checkbox
              checked={localState[c.key] ?? false}
              onCheckedChange={() => toggle(c.key)}
            />
            <div>
              <div className="text-sm font-medium text-zinc-900">{c.label}</div>
              <div className="text-xs text-zinc-400 font-mono">{c.key}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Flow Mappings tab ───────────────────────────────────────────────────────

const WELL_KNOWN_FLOWS = [
  { key: 'registration', name: 'Registration' },
  { key: 'login', name: 'Login' },
  { key: 'email_verification', name: 'Email Verification' },
  { key: 'password_reset', name: 'Password Reset' },
  { key: 'checkout', name: 'Checkout' },
  { key: 'donation', name: 'Donation' },
  { key: 'profile_update', name: 'Profile Update' },
];

function FlowMappingsTab({ siteId }: { siteId: number }) {
  const [mappings, setMappings] = useState<SiteFlowMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addFlowKey, setAddFlowKey] = useState('');
  const [addFlowName, setAddFlowName] = useState('');
  const [addImpl, setAddImpl] = useState('template');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listFlowMappings(siteId);
    setLoading(false);
    if (result.success && 'mappings' in result) setMappings(result.mappings);
    else if (!result.success) setError(result.error);
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!addFlowKey.trim() || !addFlowName.trim()) {
      setAddError('Flow key and name are required');
      return;
    }
    setAddSaving(true);
    setAddError(null);
    const result = await upsertFlowMapping({
      site_id: siteId,
      flow_key: addFlowKey.trim(),
      flow_name: addFlowName.trim(),
      implementation: addImpl,
    });
    setAddSaving(false);
    if (result.success) {
      setShowAdd(false);
      setAddFlowKey(''); setAddFlowName(''); setAddImpl('template');
      load();
    } else if (!result.success) {
      setAddError(result.error);
    }
  }

  function pickWellKnown(key: string) {
    const wk = WELL_KNOWN_FLOWS.find(f => f.key === key);
    if (wk) { setAddFlowKey(wk.key); setAddFlowName(wk.name); }
  }

  if (loading) return <div className="flex items-center text-zinc-500 text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;
  if (error) return <div className="text-red-600 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-zinc-900">Flow Mappings</h2>
        <Button size="sm" onClick={() => { setShowAdd(true); setAddError(null); }}>
          <Plus className="w-4 h-4 mr-1" /> Add flow
        </Button>
      </div>

      {showAdd && (
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
          <h3 className="text-sm font-semibold text-blue-900">New flow mapping</h3>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {WELL_KNOWN_FLOWS.map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => pickWellKnown(f.key)}
                className="text-xs px-2 py-1 rounded border border-zinc-300 bg-white hover:bg-zinc-100 transition-colors"
              >
                {f.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Flow key *</Label>
              <Input className="mt-1 h-8 text-sm font-mono" placeholder="registration" value={addFlowKey} onChange={e => setAddFlowKey(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Display name *</Label>
              <Input className="mt-1 h-8 text-sm" placeholder="Registration" value={addFlowName} onChange={e => setAddFlowName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Implementation</Label>
              <select
                className="mt-1 w-full text-sm border border-zinc-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={addImpl}
                onChange={e => setAddImpl(e.target.value)}
              >
                <option value="template">Template</option>
                <option value="custom">Custom</option>
                <option value="config_driven">Config driven</option>
              </select>
            </div>
          </div>
          {addError && <InlineError msg={addError} />}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={addSaving}>
              {addSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />} Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setAddError(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {mappings.length === 0 ? (
        <div className="text-center py-10 text-zinc-500 text-sm">
          No flow mappings configured. Add a flow to define how test automation interacts with this site.
        </div>
      ) : (
        <div className="border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-zinc-600">Flow key</th>
                <th className="px-4 py-2 text-left font-semibold text-zinc-600">Name</th>
                <th className="px-4 py-2 text-left font-semibold text-zinc-600">Implementation</th>
                <th className="px-4 py-2 text-center font-semibold text-zinc-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {mappings.map(m => (
                <tr key={m.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-zinc-700">{m.flow_key}</td>
                  <td className="px-4 py-2 font-medium text-zinc-900">{m.flow_name}</td>
                  <td className="px-4 py-2">
                    <span className="inline-block bg-zinc-100 text-zinc-600 text-xs px-2 py-0.5 rounded">{m.implementation}</span>
                  </td>
                  <td className="px-4 py-2 text-center"><StatusBadge active={m.is_active} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Selectors tab ───────────────────────────────────────────────────────────

const SELECTOR_TYPES = ['css', 'xpath', 'aria_role', 'visible_text', 'test_id'] as const;

function SelectorsTab({ siteId }: { siteId: number }) {
  const [entries, setEntries] = useState<SiteSelectorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    element_key: '', label: '', selector_type: 'css' as string,
    selector_value: '', flow_key: '', notes: '',
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);
  const [filterFlow, setFilterFlow] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listSelectorEntries(siteId, undefined, filterFlow || undefined);
    setLoading(false);
    if (result.success && 'entries' in result) setEntries(result.entries);
    else if (!result.success) setError(result.error);
  }, [siteId, filterFlow]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!addForm.element_key.trim() || !addForm.label.trim() || !addForm.selector_value.trim()) {
      setAddError('Element key, label, and selector value are required');
      return;
    }
    setAddSaving(true);
    setAddError(null);
    const result = await createSelectorEntry({
      site_id: siteId,
      element_key: addForm.element_key.trim(),
      label: addForm.label.trim(),
      selector_type: addForm.selector_type,
      selector_value: addForm.selector_value.trim(),
      flow_key: addForm.flow_key || undefined,
      notes: addForm.notes || undefined,
    });
    setAddSaving(false);
    if (result.success) {
      setShowAdd(false);
      setAddForm({ element_key: '', label: '', selector_type: 'css', selector_value: '', flow_key: '', notes: '' });
      load();
    } else if (!result.success) {
      setAddError(result.error);
    }
  }

  // Group entries by element_key
  const grouped = entries.reduce<Record<string, SiteSelectorEntry[]>>((acc, e) => {
    (acc[e.element_key] ??= []).push(e);
    return acc;
  }, {});

  if (loading) return <div className="flex items-center text-zinc-500 text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;
  if (error) return <div className="text-red-600 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-zinc-900">Selector Dictionary</h2>
        <div className="flex gap-2 items-center">
          <Input
            className="h-8 text-sm w-40"
            placeholder="Filter by flow..."
            value={filterFlow}
            onChange={e => setFilterFlow(e.target.value)}
          />
          <Button size="sm" onClick={() => { setShowAdd(true); setAddError(null); }}>
            <Plus className="w-4 h-4 mr-1" /> Add selector
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
          <h3 className="text-sm font-semibold text-blue-900">New selector entry</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Element key *</Label>
              <Input className="mt-1 h-8 text-sm font-mono" placeholder="email_input" value={addForm.element_key} onChange={e => setAddForm(f => ({ ...f, element_key: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Label *</Label>
              <Input className="mt-1 h-8 text-sm" placeholder="Email input field" value={addForm.label} onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <select
                className="mt-1 w-full text-sm border border-zinc-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={addForm.selector_type}
                onChange={e => setAddForm(f => ({ ...f, selector_type: e.target.value }))}
              >
                {SELECTOR_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Selector value *</Label>
              <Input className="mt-1 h-8 text-sm font-mono" placeholder="#email, input[name='email'], [data-testid='email']" value={addForm.selector_value} onChange={e => setAddForm(f => ({ ...f, selector_value: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Flow key (optional)</Label>
              <Input className="mt-1 h-8 text-sm font-mono" placeholder="registration" value={addForm.flow_key} onChange={e => setAddForm(f => ({ ...f, flow_key: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input className="mt-1 h-8 text-sm" value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          {addError && <InlineError msg={addError} />}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={addSaving}>
              {addSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />} Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setAddError(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-10 text-zinc-500 text-sm">
          No selectors configured. Add selectors so the automation engine knows how to find elements on this site.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([elementKey, items]) => (
            <div key={elementKey} className="border border-zinc-200 rounded-lg overflow-hidden">
              <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200 flex items-center gap-2">
                <MousePointer className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-mono text-sm font-semibold text-zinc-700">{elementKey}</span>
                <span className="text-xs text-zinc-400 ml-1">({items.length} {items.length === 1 ? 'selector' : 'selectors'})</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-zinc-100">
                  <tr>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-zinc-500">Label</th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-zinc-500">Type</th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-zinc-500">Selector</th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-zinc-500">Flow</th>
                    <th className="px-4 py-1.5 text-center text-xs font-medium text-zinc-500">Order</th>
                    <th className="px-4 py-1.5 text-center text-xs font-medium text-zinc-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {items.map(s => (
                    <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-1.5 text-zinc-900">{s.label}</td>
                      <td className="px-4 py-1.5">
                        <span className="inline-block bg-zinc-100 text-zinc-600 text-xs px-1.5 py-0.5 rounded font-mono">{s.selector_type}</span>
                      </td>
                      <td className="px-4 py-1.5 font-mono text-xs text-zinc-600 max-w-xs truncate">{s.selector_value}</td>
                      <td className="px-4 py-1.5 font-mono text-xs text-zinc-400">{s.flow_key ?? '-'}</td>
                      <td className="px-4 py-1.5 text-center text-zinc-500">{s.fallback_order}</td>
                      <td className="px-4 py-1.5 text-center"><StatusBadge active={s.is_active} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Site detail root ─────────────────────────────────────────────────────────

export default function SiteDetailPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId: siteIdStr } = use(params);
  const siteId = parseInt(siteIdStr, 10);
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab') ?? 'overview';
  const activeTab: TabId = TABS.some(t => t.id === rawTab) ? (rawTab as TabId) : 'overview';

  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data for binding tabs
  const [envs, setEnvs] = useState<SiteEnvironment[]>([]);
  const [secrets, setSecrets] = useState<SecretRecord[]>([]);
  const [paymentProfiles, setPaymentProfiles] = useState<PaymentProfile[]>([]);
  const [emailInboxes, setEmailInboxes] = useState<EmailInbox[]>([]);
  const [credBindings, setCredBindings] = useState<SiteCredentialBinding[]>([]);
  const [payBindings, setPayBindings] = useState<PaymentProfileBinding[]>([]);
  const [emailBindings, setEmailBindings] = useState<EmailInboxBinding[]>([]);
  const [bindingsLoading, setBindingsLoading] = useState(false);

  // Load site on mount
  useEffect(() => {
    if (isNaN(siteId)) { setError('Invalid site ID'); setLoading(false); return; }
    getSite(siteId).then(result => {
      setLoading(false);
      if (result.success && result.site) setSite(result.site);
      else setError(result.error ?? 'Site not found');
    });
  }, [siteId]);

  // Load envs when site loaded (used across multiple tabs)
  useEffect(() => {
    if (!site) return;
    listSiteEnvironments(siteId).then(r => { if (r.success && r.environments) setEnvs(r.environments); });
  }, [site, siteId]);

  // Load binding-tab resources when those tabs are active
  useEffect(() => {
    if (!site) return;
    if (activeTab === 'credentials' || activeTab === 'payment-profiles' || activeTab === 'email-inboxes') {
      setBindingsLoading(true);
      Promise.all([
        listSecretRecords(),
        listPaymentProfiles(),
        listEmailInboxes(),
        listSiteCredentialBindings(siteId),
        listPaymentProfileBindings(siteId),
        listEmailInboxBindings(siteId),
      ]).then(([secs, pays, emails, credB, payB, emailB]) => {
        if (secs.success && secs.secrets) setSecrets(secs.secrets);
        if (pays.success && pays.profiles) setPaymentProfiles(pays.profiles);
        if (emails.success && emails.inboxes) setEmailInboxes(emails.inboxes);
        if (credB.success && credB.bindings) setCredBindings(credB.bindings);
        if (payB.success && payB.bindings) setPayBindings(payB.bindings);
        if (emailB.success && emailB.bindings) setEmailBindings(emailB.bindings);
        setBindingsLoading(false);
      });
    }
  }, [site, siteId, activeTab]);

  // Reload binding data after mutations
  async function reloadBindings() {
    const [credB, payB, emailB] = await Promise.all([
      listSiteCredentialBindings(siteId),
      listPaymentProfileBindings(siteId),
      listEmailInboxBindings(siteId),
    ]);
    if (credB.success && credB.bindings) setCredBindings(credB.bindings);
    if (payB.success && payB.bindings) setPayBindings(payB.bindings);
    if (emailB.success && emailB.bindings) setEmailBindings(emailB.bindings);
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20 text-zinc-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading site…
        </div>
      </AppShell>
    );
  }

  if (error || !site) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Link href="/dashboard/sites" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to sites
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">
            {error ?? 'Site not found'}
          </div>
        </div>
      </AppShell>
    );
  }

  // Helpers for binding tab data shape
  const credBindingRows: BindingRow[] = credBindings.map(b => ({
    id: b.id, env_name: b.site_env_name, resource_name: b.secret_name,
    resource_detail: `Secret #${b.secret_id}`, role_tag: b.role_name,
  }));

  const payBindingRows: BindingRow[] = payBindings.map(b => ({
    id: b.id, env_name: b.site_env_name, resource_name: b.payment_profile_name,
    resource_detail: `${b.payment_type.toUpperCase()}${b.last_4 ? ` ···· ${b.last_4}` : ''}`,
    role_tag: b.role_tag,
  }));

  const emailBindingRows: BindingRow[] = emailBindings.map(b => ({
    id: b.id, env_name: b.site_env_name, resource_name: b.email_inbox_name,
    resource_detail: b.username, role_tag: b.role_tag,
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm">
          <Link href="/dashboard/sites" className="text-blue-600 hover:underline">Sites</Link>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-900">{site.name}</span>
        </div>

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">{site.name}</h1>
            <p className="text-zinc-500 text-sm mt-1">{site.base_url}</p>
          </div>
          <StatusBadge active={site.is_active} />
        </div>

        {/* Tab container */}
        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-6">
          <TabBar active={activeTab} siteId={siteIdStr} />

          {activeTab === 'overview' && (
            <OverviewTab site={site} onUpdated={setSite} />
          )}

          {activeTab === 'environments' && (
            <EnvironmentsTab siteId={siteId} />
          )}

          {activeTab === 'capabilities' && (
            <CapabilitiesTab siteId={siteId} />
          )}

          {activeTab === 'flows' && (
            <FlowMappingsTab siteId={siteId} />
          )}

          {activeTab === 'selectors' && (
            <SelectorsTab siteId={siteId} />
          )}

          {activeTab === 'credentials' && (
            <BindingTab
              title="Credentials"
              icon={Key}
              envs={envs}
              bindings={credBindingRows}
              resources={secrets}
              resourceLabel="Secret"
              resourceOptions={secrets.map(s => ({ value: String(s.id), label: `${s.name}${s.category ? ` (${s.category})` : ''}` }))}
              getBindingRow={b => (
                <span className="flex flex-col">
                  <span className="font-medium">{b.resource_name}</span>
                  <span className="text-xs text-zinc-400">{b.resource_detail}</span>
                </span>
              )}
              onAdd={async (envId, secretId, roleTag) => {
                const r = await createSiteCredentialBinding({ site_id: siteId, site_environment_id: envId, secret_id: secretId, role_name: roleTag });
                if (r.success) reloadBindings();
                return r;
              }}
              onDelete={async id => {
                const r = await deleteSiteCredentialBinding(id);
                if (r.success) reloadBindings();
                return r;
              }}
              loading={bindingsLoading}
            />
          )}

          {activeTab === 'payment-profiles' && (
            <BindingTab
              title="Payment Profiles"
              icon={CreditCard}
              envs={envs}
              bindings={payBindingRows}
              resources={paymentProfiles}
              resourceLabel="Payment profile"
              resourceOptions={paymentProfiles.map(p => ({
                value: String(p.id),
                label: `${p.name} (${p.payment_type.toUpperCase()}${p.last_4 ? ` ···· ${p.last_4}` : ''})`,
              }))}
              getBindingRow={b => (
                <span className="flex flex-col">
                  <span className="font-medium">{b.resource_name}</span>
                  <span className="text-xs text-zinc-400">{b.resource_detail}</span>
                </span>
              )}
              onAdd={async (envId, profileId, roleTag) => {
                const r = await createPaymentProfileBinding({ site_id: siteId, site_environment_id: envId, payment_profile_id: profileId, role_tag: roleTag });
                if (r.success) reloadBindings();
                return r;
              }}
              onDelete={async id => {
                const r = await deletePaymentProfileBinding(id);
                if (r.success) reloadBindings();
                return r;
              }}
              loading={bindingsLoading}
            />
          )}

          {activeTab === 'email-inboxes' && (
            <BindingTab
              title="Email Inboxes"
              icon={Mail}
              envs={envs}
              bindings={emailBindingRows}
              resources={emailInboxes}
              resourceLabel="Email inbox"
              resourceOptions={emailInboxes.map(ei => ({
                value: String(ei.id),
                label: `${ei.name} (${ei.provider} / ${ei.username})`,
              }))}
              getBindingRow={b => (
                <span className="flex flex-col">
                  <span className="font-medium">{b.resource_name}</span>
                  <span className="text-xs text-zinc-400">{b.resource_detail}</span>
                </span>
              )}
              onAdd={async (envId, inboxId, roleTag) => {
                const r = await createEmailInboxBinding({ site_id: siteId, site_environment_id: envId, email_inbox_id: inboxId, role_tag: roleTag });
                if (r.success) reloadBindings();
                return r;
              }}
              onDelete={async id => {
                const r = await deleteEmailInboxBinding(id);
                if (r.success) reloadBindings();
                return r;
              }}
              loading={bindingsLoading}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
