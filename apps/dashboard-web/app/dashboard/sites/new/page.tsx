'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { createSite, createSiteEnvironment } from '@/app/actions/sites';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Check, Globe, Layers, Loader2, Plus, Trash2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EnvRow {
  id: string; // client-side key only
  name: string;
  base_url: string;
  description: string;
}

// ─── Step indicators ─────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Site identity', icon: Globe },
  { label: 'Environments', icon: Layers },
  { label: 'Review & create', icon: Check },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const state = i < current ? 'done' : i === current ? 'active' : 'upcoming';
        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
                state === 'done'
                  ? 'bg-green-600 text-white'
                  : state === 'active'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-200 text-zinc-500'
              }`}
            >
              {state === 'done' ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
            </div>
            <span
              className={`text-sm font-medium ${
                state === 'active' ? 'text-zinc-900' : 'text-zinc-500'
              }`}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-zinc-300 mx-1" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Site identity ────────────────────────────────────────────────────

function Step1({
  name,
  setName,
  baseUrl,
  setBaseUrl,
  description,
  setDescription,
  onNext,
}: {
  name: string;
  setName: (v: string) => void;
  baseUrl: string;
  setBaseUrl: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<{ name?: string; baseUrl?: string }>({});

  function validate() {
    const e: { name?: string; baseUrl?: string } = {};
    if (!name.trim()) e.name = 'Site name is required';
    if (!baseUrl.trim()) {
      e.baseUrl = 'Base URL is required';
    } else {
      try { new URL(baseUrl); } catch { e.baseUrl = 'Enter a valid URL (e.g. https://example.com)'; }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Site identity</h2>
        <p className="text-sm text-zinc-500 mt-1">
          A site is the booking website you want to test. The base URL is used as the root for all runs.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <Label htmlFor="site-name">Name <span className="text-red-500">*</span></Label>
          <Input
            id="site-name"
            className="mt-1"
            placeholder="My Booking Site"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>
        <div>
          <Label htmlFor="site-url">Base URL <span className="text-red-500">*</span></Label>
          <Input
            id="site-url"
            className="mt-1"
            placeholder="https://example.com"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
          />
          {errors.baseUrl && <p className="text-red-500 text-xs mt-1">{errors.baseUrl}</p>}
        </div>
        <div>
          <Label htmlFor="site-desc">Description</Label>
          <textarea
            id="site-desc"
            rows={3}
            className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional notes about this site"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => validate() && onNext()}>
          Next: Environments <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Environments ─────────────────────────────────────────────────────

function Step2({
  envs,
  setEnvs,
  onBack,
  onNext,
}: {
  envs: EnvRow[];
  setEnvs: (v: EnvRow[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [rowErrors, setRowErrors] = useState<Record<string, { name?: string; base_url?: string }>>({});

  function addRow() {
    setEnvs([...envs, { id: crypto.randomUUID(), name: '', base_url: '', description: '' }]);
  }

  function removeRow(id: string) {
    setEnvs(envs.filter(e => e.id !== id));
  }

  function updateRow(id: string, field: keyof Omit<EnvRow, 'id'>, value: string) {
    setEnvs(envs.map(e => (e.id === id ? { ...e, [field]: value } : e)));
  }

  function validate() {
    const errors: Record<string, { name?: string; base_url?: string }> = {};
    for (const env of envs) {
      const rowErr: { name?: string; base_url?: string } = {};
      if (!env.name.trim()) rowErr.name = 'Environment name is required';
      if (!env.base_url.trim()) {
        rowErr.base_url = 'Base URL is required';
      } else {
        try { new URL(env.base_url); } catch { rowErr.base_url = 'Enter a valid URL'; }
      }
      if (Object.keys(rowErr).length > 0) errors[env.id] = rowErr;
    }
    setRowErrors(errors);
    return Object.keys(errors).length === 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Environments</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Add environments for this site (e.g. staging, production). You can also skip this step and add
          environments later from the site detail page.
        </p>
      </div>

      {envs.length === 0 ? (
        <div className="border border-dashed border-zinc-300 rounded-lg p-8 text-center">
          <Layers className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
          <p className="text-zinc-500 text-sm">No environments added yet.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={addRow}>
            <Plus className="w-4 h-4 mr-1" /> Add environment
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {envs.map(env => (
            <div key={env.id} className="border border-zinc-200 rounded-lg p-4 space-y-3 bg-zinc-50">
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-zinc-700">Environment</span>
                <button
                  type="button"
                  onClick={() => removeRow(env.id)}
                  className="text-zinc-400 hover:text-red-500 transition-colors"
                  aria-label="Remove environment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`env-name-${env.id}`} className="text-xs">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id={`env-name-${env.id}`}
                    className="mt-1 h-8 text-sm"
                    placeholder="staging"
                    value={env.name}
                    onChange={e => updateRow(env.id, 'name', e.target.value)}
                  />
                  {rowErrors[env.id]?.name && (
                    <p className="text-red-500 text-xs mt-0.5">{rowErrors[env.id].name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor={`env-url-${env.id}`} className="text-xs">
                    Base URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id={`env-url-${env.id}`}
                    className="mt-1 h-8 text-sm"
                    placeholder="https://staging.example.com"
                    value={env.base_url}
                    onChange={e => updateRow(env.id, 'base_url', e.target.value)}
                  />
                  {rowErrors[env.id]?.base_url && (
                    <p className="text-red-500 text-xs mt-0.5">{rowErrors[env.id].base_url}</p>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor={`env-desc-${env.id}`} className="text-xs">Description</Label>
                <Input
                  id={`env-desc-${env.id}`}
                  className="mt-1 h-8 text-sm"
                  placeholder="Optional notes"
                  value={env.description}
                  onChange={e => updateRow(env.id, 'description', e.target.value)}
                />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="w-4 h-4 mr-1" /> Add another environment
          </Button>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button onClick={() => (envs.length === 0 || validate()) && onNext()}>
          Next: Review <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Review ───────────────────────────────────────────────────────────

function Step3({
  name,
  baseUrl,
  description,
  envs,
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  name: string;
  baseUrl: string;
  description: string;
  envs: EnvRow[];
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Review & create</h2>
        <p className="text-sm text-zinc-500 mt-1">Review the configuration before creating the site.</p>
      </div>

      <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-zinc-700 mb-3">Site</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Name</dt>
            <dd className="text-zinc-900 font-medium">{name}</dd>
            <dt className="text-zinc-500">Base URL</dt>
            <dd className="text-zinc-900 break-all">{baseUrl}</dd>
            {description && (
              <>
                <dt className="text-zinc-500">Description</dt>
                <dd className="text-zinc-900">{description}</dd>
              </>
            )}
          </dl>
        </div>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-zinc-700 mb-3">
            Environments ({envs.length || 'none — can add later'})
          </h3>
          {envs.length === 0 ? (
            <p className="text-sm text-zinc-500">No environments configured. Add them after creation from the site detail page.</p>
          ) : (
            <div className="space-y-2">
              {envs.map(env => (
                <div key={env.id} className="flex items-start gap-4 text-sm bg-zinc-50 rounded p-2">
                  <span className="font-medium text-zinc-900 w-24 shrink-0">{env.name}</span>
                  <span className="text-zinc-500 break-all">{env.base_url}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">{error}</div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
          ) : (
            <><Check className="w-4 h-4 mr-1" /> Create site</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Wizard root ──────────────────────────────────────────────────────────────

export default function NewSitePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1 state
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [description, setDescription] = useState('');

  // Step 2 state
  const [envs, setEnvs] = useState<EnvRow[]>([]);

  // Step 3 state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    const siteResult = await createSite({ name, base_url: baseUrl, description: description || undefined });
    if (!siteResult.success || !siteResult.site) {
      setSubmitError(siteResult.error ?? 'Failed to create site');
      setSubmitting(false);
      return;
    }

    const siteId = siteResult.site.id;

    // Create environments sequentially
    for (const env of envs) {
      const envResult = await createSiteEnvironment({
        site_id: siteId,
        name: env.name,
        base_url: env.base_url,
        description: env.description || undefined,
      });
      if (!envResult.success) {
        setSubmitError(`Site created (id ${siteId}) but failed to create environment "${env.name}": ${envResult.error}`);
        setSubmitting(false);
        router.push(`/dashboard/sites/${siteId}`);
        return;
      }
    }

    router.push(`/dashboard/sites/${siteId}`);
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center space-x-2 text-sm">
          <Link href="/dashboard/sites" className="text-blue-600 hover:underline">
            Sites
          </Link>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-900">New Site</span>
        </div>

        <div className="flex justify-between items-start">
          <h1 className="text-3xl font-bold text-zinc-900">New Site</h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-6">
          <StepIndicator current={step} />

          {step === 0 && (
            <Step1
              name={name} setName={setName}
              baseUrl={baseUrl} setBaseUrl={setBaseUrl}
              description={description} setDescription={setDescription}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <Step2
              envs={envs} setEnvs={setEnvs}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <Step3
              name={name} baseUrl={baseUrl} description={description}
              envs={envs}
              onBack={() => setStep(1)}
              onSubmit={handleSubmit}
              submitting={submitting}
              error={submitError}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
