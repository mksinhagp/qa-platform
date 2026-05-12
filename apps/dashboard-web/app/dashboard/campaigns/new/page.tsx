'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import {
  createCampaign,
  generateScenarioMatrix,
  type CampaignType,
} from '@/app/actions/campaigns';
import {
  listPersonaOptions,
  listDeviceProfileOptions,
  listNetworkProfileOptions,
  type PersonaOption,
  type DeviceProfileOption,
  type NetworkProfileOption,
} from '@/app/actions/runs';
import { listSites, listSiteEnvironments, type Site, type SiteEnvironment } from '@/app/actions/sites';
import { listPaymentScenarios, type PaymentScenario } from '@/app/actions/payment-scenarios';
import { listApprovalPolicies, type ApprovalPolicy } from '@/app/actions/approval-policies';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Layers,
  Settings2,
  Loader2,
  Megaphone,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Campaign Identity', icon: Globe },
  { label: 'Test Matrix', icon: Layers },
  { label: 'Execution Settings', icon: Settings2 },
  { label: 'Review & Create', icon: Check },
];

const CAMPAIGN_TYPES: { value: CampaignType; label: string; description: string }[] = [
  { value: 'smoke', label: 'Smoke', description: 'Quick sanity check across key paths' },
  { value: 'regression', label: 'Regression', description: 'Full regression across all test dimensions' },
  { value: 'release_certification', label: 'Release Certification', description: 'Formal certification for a release' },
  { value: 'payment_certification', label: 'Payment Certification', description: 'Payment gateway validation suite' },
  { value: 'accessibility_audit', label: 'Accessibility Audit', description: 'Accessibility compliance testing' },
  { value: 'email_deliverability', label: 'Email Deliverability', description: 'Email delivery and content verification' },
];

const ALL_BROWSERS = ['chromium', 'firefox', 'webkit'] as const;
type Browser = (typeof ALL_BROWSERS)[number];

const ALL_FLOWS = ['registration', 'login', 'browse', 'checkout'];

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

// ─── Step 1: Campaign Identity ────────────────────────────────────────────────

function Step1({
  campaignName,
  setCampaignName,
  campaignType,
  setCampaignType,
  campaignDescription,
  setCampaignDescription,
  sites,
  selectedSiteId,
  setSelectedSiteId,
  environments,
  envsLoading,
  selectedEnvId,
  setSelectedEnvId,
  onNext,
}: {
  campaignName: string;
  setCampaignName: (v: string) => void;
  campaignType: CampaignType;
  setCampaignType: (v: CampaignType) => void;
  campaignDescription: string;
  setCampaignDescription: (v: string) => void;
  sites: Site[];
  selectedSiteId: number | null;
  setSelectedSiteId: (id: number | null) => void;
  environments: SiteEnvironment[];
  envsLoading: boolean;
  selectedEnvId: number | null;
  setSelectedEnvId: (id: number | null) => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!campaignName.trim()) e.name = 'Campaign name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Campaign Identity</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Define the campaign name, type, and target site.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="campaign-name">Campaign Name <span className="text-red-500">*</span></Label>
          <Input
            id="campaign-name"
            className="mt-1"
            placeholder="e.g. Q4 Release Regression"
            value={campaignName}
            onChange={e => setCampaignName(e.target.value)}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>

        <div>
          <Label htmlFor="campaign-type">Campaign Type</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {CAMPAIGN_TYPES.map(ct => (
              <label
                key={ct.value}
                className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-colors ${
                  campaignType === ct.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="campaign-type"
                  className="sr-only"
                  checked={campaignType === ct.value}
                  onChange={() => setCampaignType(ct.value)}
                />
                <span className={`text-sm font-medium ${campaignType === ct.value ? 'text-blue-700' : 'text-zinc-900'}`}>
                  {ct.label}
                </span>
                <span className="text-xs text-zinc-500 mt-0.5">{ct.description}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="campaign-desc">Description</Label>
          <textarea
            id="campaign-desc"
            rows={3}
            className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional description of the campaign goals"
            value={campaignDescription}
            onChange={e => setCampaignDescription(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="site-select">Target Site</Label>
          <select
            id="site-select"
            className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={selectedSiteId ?? ''}
            onChange={e => setSelectedSiteId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Any site (optional) —</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {selectedSiteId && (
          <div>
            <Label htmlFor="env-select">Target Environment</Label>
            <select
              id="env-select"
              className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
              value={selectedEnvId ?? ''}
              onChange={e => setSelectedEnvId(e.target.value ? Number(e.target.value) : null)}
              disabled={envsLoading}
            >
              <option value="">
                {envsLoading ? 'Loading…' : '— Any environment (optional) —'}
              </option>
              {environments.map(env => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => validate() && onNext()}>
          Next: Test Matrix <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Test Matrix ──────────────────────────────────────────────────────

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
  paymentScenarios,
  selectedPaymentIds,
  setSelectedPaymentIds,
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
  paymentScenarios: PaymentScenario[];
  selectedPaymentIds: number[];
  setSelectedPaymentIds: (ids: number[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<string | null>(null);

  function toggleItem<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
  }

  function validate() {
    if (!selectedPersonaIds.length) { setErrors('Select at least one persona'); return false; }
    if (!selectedBrowsers.length) { setErrors('Select at least one browser'); return false; }
    if (!selectedFlows.length) { setErrors('Select at least one flow'); return false; }
    setErrors(null);
    return true;
  }

  const browserItems = ALL_BROWSERS.map(b => ({ id: b, display_name: b.charAt(0).toUpperCase() + b.slice(1) }));
  const flowItems = ALL_FLOWS.map(f => ({ id: f, display_name: f.charAt(0).toUpperCase() + f.slice(1) }));

  // Scenario count estimate
  const dims = [
    selectedPersonaIds.length || 1,
    selectedBrowsers.length || 1,
    selectedDeviceIds.length || 1,
    selectedNetworkIds.length || 1,
    selectedFlows.length || 1,
    selectedPaymentIds.length || 1,
  ];
  const estimatedScenarios = dims.reduce((a, b) => a * b, 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Test Matrix</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Select the dimensions for the campaign scenario matrix. All combinations will be generated.
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

        {paymentScenarios.length > 0 && (
          <CheckGroup
            label="Payment Scenarios"
            items={paymentScenarios}
            selected={selectedPaymentIds}
            getKey={p => p.id}
            getLabel={p => p.name}
            onToggle={id => setSelectedPaymentIds(toggleItem(selectedPaymentIds, id as number))}
          />
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3 text-sm text-blue-800">
        <span className="font-semibold">Estimated scenarios: </span>
        <span className="font-bold text-blue-900">{estimatedScenarios}</span>
        <span className="text-blue-600 ml-2 text-xs">
          ({selectedPersonaIds.length} personas
          {' \u00D7 '}{selectedBrowsers.length} browsers
          {selectedDeviceIds.length > 0 && <>{' \u00D7 '}{selectedDeviceIds.length} devices</>}
          {selectedNetworkIds.length > 0 && <>{' \u00D7 '}{selectedNetworkIds.length} networks</>}
          {' \u00D7 '}{selectedFlows.length} flows
          {selectedPaymentIds.length > 0 && <>{' \u00D7 '}{selectedPaymentIds.length} payments</>})
        </span>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button onClick={() => validate() && onNext()}>
          Next: Execution Settings <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Execution Settings ───────────────────────────────────────────────

function Step3({
  concurrencyCap,
  setConcurrencyCap,
  retryOnFailure,
  setRetryOnFailure,
  maxRetries,
  setMaxRetries,
  requiresApproval,
  setRequiresApproval,
  approvalPolicies,
  selectedPolicyId,
  setSelectedPolicyId,
  onBack,
  onNext,
}: {
  concurrencyCap: number;
  setConcurrencyCap: (v: number) => void;
  retryOnFailure: boolean;
  setRetryOnFailure: (v: boolean) => void;
  maxRetries: number;
  setMaxRetries: (v: number) => void;
  requiresApproval: boolean;
  setRequiresApproval: (v: boolean) => void;
  approvalPolicies: ApprovalPolicy[];
  selectedPolicyId: number | null;
  setSelectedPolicyId: (id: number | null) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Execution Settings</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Configure concurrency, retry behavior, and approval requirements.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <Label htmlFor="concurrency">Concurrency Cap</Label>
          <p className="text-xs text-zinc-500 mt-0.5 mb-1">Maximum parallel scenario executions</p>
          <Input
            id="concurrency"
            type="number"
            min={1}
            max={20}
            value={concurrencyCap}
            onChange={e => setConcurrencyCap(Math.max(1, Math.min(20, Number(e.target.value))))}
            className="w-24"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="retry-on-failure"
            className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            checked={retryOnFailure}
            onChange={e => setRetryOnFailure(e.target.checked)}
          />
          <div>
            <Label htmlFor="retry-on-failure">Retry on Failure</Label>
            <p className="text-xs text-zinc-500">Automatically retry failed scenarios</p>
          </div>
        </div>

        {retryOnFailure && (
          <div className="ml-7">
            <Label htmlFor="max-retries">Max Retries</Label>
            <Input
              id="max-retries"
              type="number"
              min={1}
              max={5}
              value={maxRetries}
              onChange={e => setMaxRetries(Math.max(1, Math.min(5, Number(e.target.value))))}
              className="w-24 mt-1"
            />
          </div>
        )}

        <div className="border-t border-zinc-200 pt-5">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="requires-approval"
              className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              checked={requiresApproval}
              onChange={e => setRequiresApproval(e.target.checked)}
            />
            <div>
              <Label htmlFor="requires-approval">Requires Approval</Label>
              <p className="text-xs text-zinc-500">Campaign execution must be approved before starting</p>
            </div>
          </div>

          {requiresApproval && approvalPolicies.length > 0 && (
            <div className="ml-7 mt-3">
              <Label htmlFor="approval-policy">Approval Policy</Label>
              <select
                id="approval-policy"
                className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={selectedPolicyId ?? ''}
                onChange={e => setSelectedPolicyId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Select a policy —</option>
                {approvalPolicies.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.action_category} ({p.default_strength})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button onClick={onNext}>
          Next: Review &amp; Create <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4: Review & Create ──────────────────────────────────────────────────

function Step4({
  campaignName,
  campaignType,
  campaignDescription,
  sites,
  selectedSiteId,
  environments,
  selectedEnvId,
  selectedPersonaIds,
  personas,
  selectedBrowsers,
  selectedDeviceIds,
  deviceProfiles,
  selectedNetworkIds,
  networkProfiles,
  selectedFlows,
  selectedPaymentIds,
  paymentScenarios,
  concurrencyCap,
  retryOnFailure,
  maxRetries,
  requiresApproval,
  onBack,
  onSubmit,
  submitting,
  submitError,
}: {
  campaignName: string;
  campaignType: CampaignType;
  campaignDescription: string;
  sites: Site[];
  selectedSiteId: number | null;
  environments: SiteEnvironment[];
  selectedEnvId: number | null;
  selectedPersonaIds: string[];
  personas: PersonaOption[];
  selectedBrowsers: Browser[];
  selectedDeviceIds: number[];
  deviceProfiles: DeviceProfileOption[];
  selectedNetworkIds: number[];
  networkProfiles: NetworkProfileOption[];
  selectedFlows: string[];
  selectedPaymentIds: number[];
  paymentScenarios: PaymentScenario[];
  concurrencyCap: number;
  retryOnFailure: boolean;
  maxRetries: number;
  requiresApproval: boolean;
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
  const selectedPayments = paymentScenarios.filter(p => selectedPaymentIds.includes(p.id));

  const typeLabel = CAMPAIGN_TYPES.find(ct => ct.value === campaignType)?.label ?? campaignType;

  function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="flex gap-4 py-2 border-b border-zinc-100 last:border-0">
        <span className="w-44 shrink-0 text-sm text-zinc-500">{label}</span>
        <span className="text-sm text-zinc-900 font-medium">{value}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Review &amp; Create</h2>
        <p className="text-sm text-zinc-500 mt-1">Confirm the campaign settings before creating.</p>
      </div>

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">{submitError}</div>
      )}

      <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-0">
        <SummaryRow label="Campaign name" value={campaignName} />
        <SummaryRow label="Type" value={typeLabel} />
        {campaignDescription && <SummaryRow label="Description" value={campaignDescription} />}
        <SummaryRow label="Site" value={site?.name ?? 'Any'} />
        <SummaryRow label="Environment" value={env?.name ?? 'Any'} />
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-0">
        <SummaryRow label="Personas" value={selectedPersonas.map(p => p.display_name).join(', ') || 'None'} />
        <SummaryRow label="Browsers" value={selectedBrowsers.join(', ')} />
        <SummaryRow label="Device profiles" value={selectedDevices.map(d => d.name).join(', ') || 'None'} />
        <SummaryRow label="Network profiles" value={selectedNetworks.map(n => n.name).join(', ') || 'None'} />
        <SummaryRow label="Flows" value={selectedFlows.join(', ')} />
        {selectedPayments.length > 0 && (
          <SummaryRow label="Payment scenarios" value={selectedPayments.map(p => p.name).join(', ')} />
        )}
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-0">
        <SummaryRow label="Concurrency cap" value={concurrencyCap} />
        <SummaryRow label="Retry on failure" value={retryOnFailure ? `Yes (max ${maxRetries})` : 'No'} />
        <SummaryRow label="Requires approval" value={requiresApproval ? 'Yes' : 'No'} />
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? (
            <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Creating…</>
          ) : (
            <><Megaphone className="w-4 h-4 mr-1" /> Create Campaign</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewCampaignPage() {
  const router = useRouter();

  // ── Loading state ───────────────────────────────────────────────────────────
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Reference data ──────────────────────────────────────────────────────────
  const [sites, setSites] = useState<Site[]>([]);
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [deviceProfiles, setDeviceProfiles] = useState<DeviceProfileOption[]>([]);
  const [networkProfiles, setNetworkProfiles] = useState<NetworkProfileOption[]>([]);
  const [paymentScenarios, setPaymentScenarios] = useState<PaymentScenario[]>([]);
  const [approvalPolicies, setApprovalPolicies] = useState<ApprovalPolicy[]>([]);

  // ── Step 1 state ────────────────────────────────────────────────────────────
  const [campaignName, setCampaignName] = useState('');
  const [campaignType, setCampaignType] = useState<CampaignType>('smoke');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [environments, setEnvironments] = useState<SiteEnvironment[]>([]);
  const [envsLoading, setEnvsLoading] = useState(false);
  const [selectedEnvId, setSelectedEnvId] = useState<number | null>(null);

  // ── Step 2 state ────────────────────────────────────────────────────────────
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [selectedBrowsers, setSelectedBrowsers] = useState<Browser[]>(['chromium']);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<number[]>([]);
  const [selectedFlows, setSelectedFlows] = useState<string[]>([...ALL_FLOWS]);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<number[]>([]);

  // ── Step 3 state ────────────────────────────────────────────────────────────
  const [concurrencyCap, setConcurrencyCap] = useState(5);
  const [retryOnFailure, setRetryOnFailure] = useState(false);
  const [maxRetries, setMaxRetries] = useState(1);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | null>(null);

  // ── Wizard state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Initial data load ───────────────────────────────────────────────────────
  useEffect(() => {
    async function loadAll() {
      try {
        setLoadingData(true);
        const [sitesRes, personasRes, devicesRes, networksRes, paymentRes, policiesRes] = await Promise.all([
          listSites(true),
          listPersonaOptions(),
          listDeviceProfileOptions(),
          listNetworkProfileOptions(),
          listPaymentScenarios(undefined, true),
          listApprovalPolicies(),
        ]);

        if (!sitesRes.success) { setLoadError(sitesRes.error ?? 'Failed to load sites'); return; }
        if (!personasRes.success) { setLoadError(personasRes.error ?? 'Failed to load personas'); return; }
        if (!devicesRes.success) { setLoadError(devicesRes.error ?? 'Failed to load device profiles'); return; }
        if (!networksRes.success) { setLoadError(networksRes.error ?? 'Failed to load network profiles'); return; }

        const loadedSites = sitesRes.sites ?? [];
        const loadedPersonas = personasRes.personas ?? [];
        const loadedDevices = devicesRes.profiles ?? [];
        const loadedNetworks = networksRes.profiles ?? [];
        const loadedPayments = paymentRes.success ? (paymentRes.scenarios ?? []) : [];
        const loadedPolicies = policiesRes.success ? (policiesRes.policies ?? []) : [];

        setSites(loadedSites);
        setPersonas(loadedPersonas);
        setDeviceProfiles(loadedDevices);
        setNetworkProfiles(loadedNetworks);
        setPaymentScenarios(loadedPayments);
        setApprovalPolicies(loadedPolicies);

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

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Convert persona string IDs to numbers for the campaign array columns
      const personaIdNumbers = selectedPersonaIds.map(id => Number(id)).filter(n => !isNaN(n));

      const result = await createCampaign({
        name: campaignName,
        campaign_type: campaignType,
        description: campaignDescription || undefined,
        site_id: selectedSiteId ?? undefined,
        site_environment_id: selectedEnvId ?? undefined,
        persona_ids: personaIdNumbers.length > 0 ? personaIdNumbers : undefined,
        device_profile_ids: selectedDeviceIds.length > 0 ? selectedDeviceIds : undefined,
        network_profile_ids: selectedNetworkIds.length > 0 ? selectedNetworkIds : undefined,
        browser_types: selectedBrowsers.length > 0 ? selectedBrowsers : undefined,
        payment_scenario_ids: selectedPaymentIds.length > 0 ? selectedPaymentIds : undefined,
        flow_types: selectedFlows.length > 0 ? selectedFlows : undefined,
        concurrency_cap: concurrencyCap,
        retry_on_failure: retryOnFailure,
        max_retries: retryOnFailure ? maxRetries : 1,
        requires_approval: requiresApproval,
        approval_policy_id: requiresApproval ? (selectedPolicyId ?? undefined) : undefined,
      });

      if (result.success && result.campaignId) {
        // Auto-generate scenario matrix after creating campaign
        await generateScenarioMatrix(result.campaignId);
        router.push(`/dashboard/campaigns/${result.campaignId}`);
      } else {
        setSubmitError(result.error ?? 'Failed to create campaign');
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
          <Link href="/dashboard/campaigns" className="text-blue-600 hover:underline">
            Campaigns
          </Link>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-900">New Campaign</span>
        </div>

        <h1 className="text-3xl font-bold text-zinc-900">New Campaign</h1>

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
                campaignName={campaignName}
                setCampaignName={setCampaignName}
                campaignType={campaignType}
                setCampaignType={setCampaignType}
                campaignDescription={campaignDescription}
                setCampaignDescription={setCampaignDescription}
                sites={sites}
                selectedSiteId={selectedSiteId}
                setSelectedSiteId={setSelectedSiteId}
                environments={environments}
                envsLoading={envsLoading}
                selectedEnvId={selectedEnvId}
                setSelectedEnvId={setSelectedEnvId}
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
                paymentScenarios={paymentScenarios}
                selectedPaymentIds={selectedPaymentIds}
                setSelectedPaymentIds={setSelectedPaymentIds}
                onBack={() => setStep(0)}
                onNext={() => setStep(2)}
              />
            )}

            {step === 2 && (
              <Step3
                concurrencyCap={concurrencyCap}
                setConcurrencyCap={setConcurrencyCap}
                retryOnFailure={retryOnFailure}
                setRetryOnFailure={setRetryOnFailure}
                maxRetries={maxRetries}
                setMaxRetries={setMaxRetries}
                requiresApproval={requiresApproval}
                setRequiresApproval={setRequiresApproval}
                approvalPolicies={approvalPolicies}
                selectedPolicyId={selectedPolicyId}
                setSelectedPolicyId={setSelectedPolicyId}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}

            {step === 3 && (
              <Step4
                campaignName={campaignName}
                campaignType={campaignType}
                campaignDescription={campaignDescription}
                sites={sites}
                selectedSiteId={selectedSiteId}
                environments={environments}
                selectedEnvId={selectedEnvId}
                selectedPersonaIds={selectedPersonaIds}
                personas={personas}
                selectedBrowsers={selectedBrowsers}
                selectedDeviceIds={selectedDeviceIds}
                deviceProfiles={deviceProfiles}
                selectedNetworkIds={selectedNetworkIds}
                networkProfiles={networkProfiles}
                selectedFlows={selectedFlows}
                selectedPaymentIds={selectedPaymentIds}
                paymentScenarios={paymentScenarios}
                concurrencyCap={concurrencyCap}
                retryOnFailure={retryOnFailure}
                maxRetries={maxRetries}
                requiresApproval={requiresApproval}
                onBack={() => setStep(2)}
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
