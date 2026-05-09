'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import {
  listPersonaOptions,
  listDeviceProfileOptions,
  listNetworkProfileOptions,
  createRun,
  type PersonaOption,
  type DeviceProfileOption,
  type NetworkProfileOption,
} from '@/app/actions/runs';
import { listSites, listSiteEnvironments, type Site, type SiteEnvironment } from '@/app/actions/sites';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Layers,
  Loader2,
  PlayCircle,
} from 'lucide-react';

// ─── Step configuration ───────────────────────────────────────────────────────

const STEPS = [
  { label: 'Site & Environment', icon: Globe },
  { label: 'Execution Matrix', icon: Layers },
  { label: 'Review & Create', icon: Check },
];

const ALL_BROWSERS = ['chromium', 'firefox', 'webkit'] as const;
type Browser = (typeof ALL_BROWSERS)[number];

const ALL_FLOWS = ['registration', 'login', 'browse'];

// ─── Step indicator ───────────────────────────────────────────────────────────

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

// ─── Multi-select checkbox group ──────────────────────────────────────────────

function CheckGroup<T extends { id: string | number; name?: string; display_name?: string }>({
  label,
  items,
  selected,
  getKey,
  getLabel,
  onToggle,
}: {
  label: string;
  items: T[];
  selected: (string | number)[];
  getKey: (item: T) => string | number;
  getLabel: (item: T) => string;
  onToggle: (key: string | number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-zinc-700 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map(item => {
          const key = getKey(item);
          const checked = selected.includes(key);
          return (
            <label
              key={String(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer transition-colors select-none ${
                checked
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-zinc-300 text-zinc-700 hover:border-zinc-400'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => onToggle(key)}
              />
              {getLabel(item)}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 1: Site & Environment ───────────────────────────────────────────────

function Step1({
  sites,
  selectedSiteId,
  setSelectedSiteId,
  environments,
  envsLoading,
  selectedEnvId,
  setSelectedEnvId,
  runName,
  setRunName,
  runDescription,
  setRunDescription,
  onNext,
}: {
  sites: Site[];
  selectedSiteId: number | null;
  setSelectedSiteId: (id: number | null) => void;
  environments: SiteEnvironment[];
  envsLoading: boolean;
  selectedEnvId: number | null;
  setSelectedEnvId: (id: number | null) => void;
  runName: string;
  setRunName: (v: string) => void;
  runDescription: string;
  setRunDescription: (v: string) => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<{ site?: string; env?: string; name?: string }>({});

  function validate() {
    const e: { site?: string; env?: string; name?: string } = {};
    if (!selectedSiteId) e.site = 'Please select a site';
    if (!selectedEnvId) e.env = 'Please select an environment';
    if (!runName.trim()) e.name = 'Run name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Site &amp; Environment</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Select the site and environment to run tests against.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="site-select">Site <span className="text-red-500">*</span></Label>
          <select
            id="site-select"
            className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={selectedSiteId ?? ''}
            onChange={e => setSelectedSiteId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Select a site —</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {errors.site && <p className="text-red-500 text-xs mt-1">{errors.site}</p>}
        </div>

        <div>
          <Label htmlFor="env-select">Environment <span className="text-red-500">*</span></Label>
          <select
            id="env-select"
            className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
            value={selectedEnvId ?? ''}
            onChange={e => setSelectedEnvId(e.target.value ? Number(e.target.value) : null)}
            disabled={!selectedSiteId || envsLoading}
          >
            <option value="">
              {envsLoading ? 'Loading…' : selectedSiteId ? '— Select an environment —' : '— Select a site first —'}
            </option>
            {environments.map(env => (
              <option key={env.id} value={env.id}>{env.name}</option>
            ))}
          </select>
          {errors.env && <p className="text-red-500 text-xs mt-1">{errors.env}</p>}
        </div>

        <div>
          <Label htmlFor="run-name">Run Name <span className="text-red-500">*</span></Label>
          <Input
            id="run-name"
            className="mt-1"
            placeholder="e.g. My Site – Staging – 1/1/2025"
            value={runName}
            onChange={e => setRunName(e.target.value)}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>

        <div>
          <Label htmlFor="run-desc">Description</Label>
          <textarea
            id="run-desc"
            rows={3}
            className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional notes about this run"
            value={runDescription}
            onChange={e => setRunDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => validate() && onNext()}>
          Next: Execution Matrix <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Execution Matrix ─────────────────────────────────────────────────

function Step2({
  personas,
  selectedPersonaIds,
  setSelectedPersonaIds,
  selectedBrowsers,
  setSelectedBrowsers,
  deviceProfiles,
  selectedDeviceIds,
  setSelectedDeviceIds,
  networkProfiles,
  selectedNetworkIds,
  setSelectedNetworkIds,
  selectedFlows,
  setSelectedFlows,
  onBack,
  onNext,
}: {
  personas: PersonaOption[];
  selectedPersonaIds: string[];
  setSelectedPersonaIds: (ids: string[]) => void;
  selectedBrowsers: Browser[];
  setSelectedBrowsers: (b: Browser[]) => void;
  deviceProfiles: DeviceProfileOption[];
  selectedDeviceIds: number[];
  setSelectedDeviceIds: (ids: number[]) => void;
  networkProfiles: NetworkProfileOption[];
  selectedNetworkIds: number[];
  setSelectedNetworkIds: (ids: number[]) => void;
  selectedFlows: string[];
  setSelectedFlows: (flows: string[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<string | null>(null);

  const executionCount =
    selectedPersonaIds.length *
    selectedBrowsers.length *
    selectedDeviceIds.length *
    selectedNetworkIds.length *
    selectedFlows.length;

  function toggleItem<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
  }

  function validate() {
    if (!selectedPersonaIds.length) { setErrors('Select at least one persona'); return false; }
    if (!selectedBrowsers.length) { setErrors('Select at least one browser'); return false; }
    if (!selectedDeviceIds.length) { setErrors('Select at least one device profile'); return false; }
    if (!selectedNetworkIds.length) { setErrors('Select at least one network profile'); return false; }
    if (!selectedFlows.length) { setErrors('Select at least one flow'); return false; }
    setErrors(null);
    return true;
  }

  const browserItems = ALL_BROWSERS.map(b => ({ id: b, display_name: b.charAt(0).toUpperCase() + b.slice(1) }));
  const flowItems = ALL_FLOWS.map(f => ({ id: f, display_name: f.charAt(0).toUpperCase() + f.slice(1) }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Execution Matrix</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Choose the combination of personas, browsers, devices, networks, and flows to test.
        </p>
      </div>

      {errors && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">{errors}</div>
      )}

      <div className="space-y-5">
        <CheckGroup
          label="Personas"
          items={personas}
          selected={selectedPersonaIds}
          getKey={p => p.id}
          getLabel={p => p.display_name}
          onToggle={id => setSelectedPersonaIds(toggleItem(selectedPersonaIds, id as string))}
        />

        <CheckGroup
          label="Browsers"
          items={browserItems}
          selected={selectedBrowsers}
          getKey={b => b.id}
          getLabel={b => b.display_name}
          onToggle={id => setSelectedBrowsers(toggleItem(selectedBrowsers, id as Browser))}
        />

        <CheckGroup
          label="Device Profiles"
          items={deviceProfiles}
          selected={selectedDeviceIds}
          getKey={d => d.id}
          getLabel={d => d.name}
          onToggle={id => setSelectedDeviceIds(toggleItem(selectedDeviceIds, id as number))}
        />

        <CheckGroup
          label="Network Profiles"
          items={networkProfiles}
          selected={selectedNetworkIds}
          getKey={n => n.id}
          getLabel={n => n.name}
          onToggle={id => setSelectedNetworkIds(toggleItem(selectedNetworkIds, id as number))}
        />

        <CheckGroup
          label="Flows"
          items={flowItems}
          selected={selectedFlows}
          getKey={f => f.id}
          getLabel={f => f.display_name}
          onToggle={id => setSelectedFlows(toggleItem(selectedFlows, id as string))}
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3 text-sm text-blue-800">
        <span className="font-semibold">Estimated executions: </span>
        <span className="font-bold text-blue-900">{executionCount}</span>
        <span className="text-blue-600 ml-2 text-xs">
          ({selectedPersonaIds.length} personas × {selectedBrowsers.length} browsers × {selectedDeviceIds.length} devices × {selectedNetworkIds.length} networks × {selectedFlows.length} flows)
        </span>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button onClick={() => validate() && onNext()}>
          Next: Review &amp; Create <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Review & Create ──────────────────────────────────────────────────

function Step3({
  sites,
  selectedSiteId,
  environments,
  selectedEnvId,
  runName,
  runDescription,
  selectedPersonaIds,
  personas,
  selectedBrowsers,
  selectedDeviceIds,
  deviceProfiles,
  selectedNetworkIds,
  networkProfiles,
  selectedFlows,
  onBack,
  onSubmit,
  submitting,
  submitError,
}: {
  sites: Site[];
  selectedSiteId: number | null;
  environments: SiteEnvironment[];
  selectedEnvId: number | null;
  runName: string;
  runDescription: string;
  selectedPersonaIds: string[];
  personas: PersonaOption[];
  selectedBrowsers: Browser[];
  selectedDeviceIds: number[];
  deviceProfiles: DeviceProfileOption[];
  selectedNetworkIds: number[];
  networkProfiles: NetworkProfileOption[];
  selectedFlows: string[];
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const site = sites.find(s => s.id === selectedSiteId);
  const env = environments.find(e => e.id === selectedEnvId);
  const selectedPersonas = personas.filter(p => selectedPersonaIds.includes(p.id));
  const selectedDevices = deviceProfiles.filter(d => selectedDeviceIds.includes(d.id));
  const selectedNetworks = networkProfiles.filter(n => selectedNetworkIds.includes(n.id));

  const executionCount =
    selectedPersonaIds.length * selectedBrowsers.length * selectedDeviceIds.length *
    selectedNetworkIds.length * selectedFlows.length;

  function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="flex gap-4 py-2 border-b border-zinc-100 last:border-0">
        <span className="w-40 shrink-0 text-sm text-zinc-500">{label}</span>
        <span className="text-sm text-zinc-900 font-medium">{value}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Review &amp; Create</h2>
        <p className="text-sm text-zinc-500 mt-1">Confirm the details before creating the run.</p>
      </div>

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">{submitError}</div>
      )}

      <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-0">
        <SummaryRow label="Run name" value={runName} />
        {runDescription && <SummaryRow label="Description" value={runDescription} />}
        <SummaryRow label="Site" value={site?.name ?? '—'} />
        <SummaryRow label="Environment" value={env?.name ?? '—'} />
        <SummaryRow label="Personas" value={selectedPersonas.map(p => p.display_name).join(', ')} />
        <SummaryRow label="Browsers" value={selectedBrowsers.join(', ')} />
        <SummaryRow label="Device profiles" value={selectedDevices.map(d => d.name).join(', ')} />
        <SummaryRow label="Network profiles" value={selectedNetworks.map(n => n.name).join(', ')} />
        <SummaryRow label="Flows" value={selectedFlows.join(', ')} />
        <SummaryRow
          label="Total executions"
          value={
            <span className="text-blue-700 font-bold">{executionCount}</span>
          }
        />
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? (
            <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Creating…</>
          ) : (
            <><PlayCircle className="w-4 h-4 mr-1" /> Create Run</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewRunPage() {
  const router = useRouter();

  // ── Loading state ───────────────────────────────────────────────────────────
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Reference data ──────────────────────────────────────────────────────────
  const [sites, setSites] = useState<Site[]>([]);
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [deviceProfiles, setDeviceProfiles] = useState<DeviceProfileOption[]>([]);
  const [networkProfiles, setNetworkProfiles] = useState<NetworkProfileOption[]>([]);

  // ── Step 1 state ────────────────────────────────────────────────────────────
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [environments, setEnvironments] = useState<SiteEnvironment[]>([]);
  const [envsLoading, setEnvsLoading] = useState(false);
  const [selectedEnvId, setSelectedEnvId] = useState<number | null>(null);
  const [runName, setRunName] = useState('');
  const [runDescription, setRunDescription] = useState('');

  // ── Step 2 state ────────────────────────────────────────────────────────────
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [selectedBrowsers, setSelectedBrowsers] = useState<Browser[]>(['chromium']);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<number[]>([]);
  const [selectedFlows, setSelectedFlows] = useState<string[]>([...ALL_FLOWS]);

  // ── Wizard state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Initial data load ───────────────────────────────────────────────────────
  useEffect(() => {
    async function loadAll() {
      try {
        setLoadingData(true);
        const [sitesRes, personasRes, devicesRes, networksRes] = await Promise.all([
          listSites(true),
          listPersonaOptions(),
          listDeviceProfileOptions(),
          listNetworkProfileOptions(),
        ]);

        if (!sitesRes.success) { setLoadError(sitesRes.error ?? 'Failed to load sites'); return; }
        if (!personasRes.success) { setLoadError(personasRes.error ?? 'Failed to load personas'); return; }
        if (!devicesRes.success) { setLoadError(devicesRes.error ?? 'Failed to load device profiles'); return; }
        if (!networksRes.success) { setLoadError(networksRes.error ?? 'Failed to load network profiles'); return; }

        const loadedSites = sitesRes.sites ?? [];
        const loadedPersonas = personasRes.personas ?? [];
        const loadedDevices = devicesRes.profiles ?? [];
        const loadedNetworks = networksRes.profiles ?? [];

        setSites(loadedSites);
        setPersonas(loadedPersonas);
        setDeviceProfiles(loadedDevices);
        setNetworkProfiles(loadedNetworks);

        // Default selections
        setSelectedPersonaIds(loadedPersonas.map(p => p.id));
        if (loadedDevices.length > 0) setSelectedDeviceIds([loadedDevices[0].id]);
        if (loadedNetworks.length > 0) setSelectedNetworkIds([loadedNetworks[0].id]);
      } catch {
        setLoadError('An error occurred while loading form data');
      } finally {
        setLoadingData(false);
      }
    }
    loadAll();
  }, []);

  // ── Load environments when site changes ─────────────────────────────────────
  useEffect(() => {
    if (!selectedSiteId) {
      setEnvironments([]);
      setSelectedEnvId(null);
      setRunName('');
      return;
    }
    setEnvsLoading(true);
    setSelectedEnvId(null);
    listSiteEnvironments(selectedSiteId, true)
      .then(res => {
        if (res.success) {
          setEnvironments(res.environments ?? []);
        } else {
          setEnvironments([]);
        }
      })
      .finally(() => setEnvsLoading(false));
  }, [selectedSiteId]);

  // ── Auto-suggest run name when env changes ───────────────────────────────────
  useEffect(() => {
    if (!selectedSiteId || !selectedEnvId) return;
    const site = sites.find(s => s.id === selectedSiteId);
    const env = environments.find(e => e.id === selectedEnvId);
    if (site && env) {
      setRunName(`${site.name} – ${env.name} – ${new Date().toLocaleDateString()}`);
    }
  }, [selectedEnvId, selectedSiteId, sites, environments]);

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!selectedSiteId || !selectedEnvId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await createRun({
        site_id: selectedSiteId,
        site_environment_id: selectedEnvId,
        name: runName,
        description: runDescription || undefined,
        persona_ids: selectedPersonaIds,
        device_profile_ids: selectedDeviceIds,
        network_profile_ids: selectedNetworkIds,
        browsers: selectedBrowsers,
        flow_names: selectedFlows,
      });

      if (result.success && result.runId) {
        router.push(`/dashboard/runs/${result.runId}`);
      } else {
        setSubmitError(result.error ?? 'Failed to create run');
      }
    } catch {
      setSubmitError('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link href="/dashboard/runs" className="text-blue-600 hover:underline">
            Runs
          </Link>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-900">New Run</span>
        </div>

        <h1 className="text-3xl font-bold text-zinc-900">New Matrix Run</h1>

        {loadingData ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading form data…
          </div>
        ) : loadError ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">
            {loadError}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-8">
            <StepIndicator current={step} />

            {step === 0 && (
              <Step1
                sites={sites}
                selectedSiteId={selectedSiteId}
                setSelectedSiteId={setSelectedSiteId}
                environments={environments}
                envsLoading={envsLoading}
                selectedEnvId={selectedEnvId}
                setSelectedEnvId={setSelectedEnvId}
                runName={runName}
                setRunName={setRunName}
                runDescription={runDescription}
                setRunDescription={setRunDescription}
                onNext={() => setStep(1)}
              />
            )}

            {step === 1 && (
              <Step2
                personas={personas}
                selectedPersonaIds={selectedPersonaIds}
                setSelectedPersonaIds={setSelectedPersonaIds}
                selectedBrowsers={selectedBrowsers}
                setSelectedBrowsers={setSelectedBrowsers}
                deviceProfiles={deviceProfiles}
                selectedDeviceIds={selectedDeviceIds}
                setSelectedDeviceIds={setSelectedDeviceIds}
                networkProfiles={networkProfiles}
                selectedNetworkIds={selectedNetworkIds}
                setSelectedNetworkIds={setSelectedNetworkIds}
                selectedFlows={selectedFlows}
                setSelectedFlows={setSelectedFlows}
                onBack={() => setStep(0)}
                onNext={() => setStep(2)}
              />
            )}

            {step === 2 && (
              <Step3
                sites={sites}
                selectedSiteId={selectedSiteId}
                environments={environments}
                selectedEnvId={selectedEnvId}
                runName={runName}
                runDescription={runDescription}
                selectedPersonaIds={selectedPersonaIds}
                personas={personas}
                selectedBrowsers={selectedBrowsers}
                selectedDeviceIds={selectedDeviceIds}
                deviceProfiles={deviceProfiles}
                selectedNetworkIds={selectedNetworkIds}
                networkProfiles={networkProfiles}
                selectedFlows={selectedFlows}
                onBack={() => setStep(1)}
                onSubmit={handleSubmit}
                submitting={submitting}
                submitError={submitError}
              />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
