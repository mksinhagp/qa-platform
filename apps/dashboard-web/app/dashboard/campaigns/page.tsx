'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { listCampaigns, type Campaign, type CampaignType } from '@/app/actions/campaigns';
import { Button } from '@/components/ui/button';
import {
  Plus,
  ArrowRight,
  CheckCircle,
  XCircle,
  Loader2,
  Megaphone,
  Shield,
  FlaskConical,
  CreditCard,
  Accessibility,
  Mail,
  Filter,
} from 'lucide-react';

// ─── Campaign type badge ──────────────────────────────────────────────────────

const CAMPAIGN_TYPE_CONFIG: Record<CampaignType, { label: string; icon: typeof Megaphone; color: string }> = {
  smoke: { label: 'Smoke', icon: FlaskConical, color: 'bg-blue-50 text-blue-700' },
  regression: { label: 'Regression', icon: Shield, color: 'bg-purple-50 text-purple-700' },
  release_certification: { label: 'Release Cert', icon: CheckCircle, color: 'bg-green-50 text-green-700' },
  payment_certification: { label: 'Payment Cert', icon: CreditCard, color: 'bg-amber-50 text-amber-700' },
  accessibility_audit: { label: 'Accessibility', icon: Accessibility, color: 'bg-teal-50 text-teal-700' },
  email_deliverability: { label: 'Email', icon: Mail, color: 'bg-indigo-50 text-indigo-700' },
};

function CampaignTypeBadge({ type }: { type: CampaignType }) {
  const config = CAMPAIGN_TYPE_CONFIG[type] ?? { label: type, icon: Megaphone, color: 'bg-zinc-100 text-zinc-600' };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${config.color}`}>
      <Icon className="w-3 h-3" /> {config.label}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
      <CheckCircle className="w-3 h-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-500 text-xs font-medium px-2 py-0.5 rounded-full">
      <XCircle className="w-3 h-3" /> Inactive
    </span>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const CAMPAIGN_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'smoke', label: 'Smoke' },
  { value: 'regression', label: 'Regression' },
  { value: 'release_certification', label: 'Release Certification' },
  { value: 'payment_certification', label: 'Payment Certification' },
  { value: 'accessibility_audit', label: 'Accessibility Audit' },
  { value: 'email_deliverability', label: 'Email Deliverability' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await listCampaigns(filterType || undefined, undefined, undefined);
        if (!active) return;
        if (result.success && result.campaigns) {
          setCampaigns(result.campaigns);
        } else {
          setError(result.error ?? 'Failed to load campaigns');
        }
      } catch {
        if (active) setError('An error occurred while loading campaigns');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [filterType]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-zinc-900">Campaigns</h1>
          <Link href="/dashboard/campaigns/new">
            <Button>
              <Plus className="w-4 h-4 mr-1" /> New Campaign
            </Button>
          </Link>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-zinc-400" />
          <select
            className="px-3 py-1.5 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            {CAMPAIGN_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading campaigns…
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">
            {error}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-12 text-center">
            <Megaphone className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-zinc-700 mb-1">No campaigns yet</h2>
            <p className="text-sm text-zinc-500 mb-4">
              Create a QA campaign to define reusable test matrices across personas, devices, browsers, and more.
            </p>
            <Link href="/dashboard/campaigns/new">
              <Button>
                <Plus className="w-4 h-4 mr-1" /> New Campaign
              </Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-600">Campaign Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-600">Type</th>
                  <th className="px-4 py-3 text-center font-semibold text-zinc-600">Concurrency</th>
                  <th className="px-4 py-3 text-center font-semibold text-zinc-600">Approval</th>
                  <th className="px-4 py-3 text-center font-semibold text-zinc-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-600">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {campaigns.map(c => (
                  <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-900">{c.name}</span>
                      {c.description && (
                        <p className="text-zinc-400 text-xs truncate max-w-xs mt-0.5">
                          {c.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CampaignTypeBadge type={c.campaign_type} />
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-600">
                      {c.concurrency_cap}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.requires_approval ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                          <Shield className="w-3 h-3" /> Required
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-xs">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge isActive={c.is_active} />
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {new Date(c.created_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/campaigns/${c.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs font-medium"
                      >
                        Details <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
