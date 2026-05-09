'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { createCredential } from '@/app/actions/credentials';
import { listSites, listSiteEnvironments, type Site, type SiteEnvironment } from '@/app/actions/sites';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function NewCredentialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [environments, setEnvironments] = useState<SiteEnvironment[]>([]);
  const [formData, setFormData] = useState({
    site_id: '',
    site_environment_id: '',
    role_name: '',
    credential_value: '',
    name: '',
    description: '',
    is_session_only: false,
  });

  useEffect(() => {
    loadSites();
  }, []);

  useEffect(() => {
    if (formData.site_id) {
      loadEnvironments(parseInt(formData.site_id, 10));
    }
  }, [formData.site_id]);

  async function loadSites() {
    const result = await listSites(true);
    if (result.success && result.sites) {
      setSites(result.sites);
    }
  }

  async function loadEnvironments(siteId: number) {
    const result = await listSiteEnvironments(siteId, true);
    if (result.success && result.environments) {
      setEnvironments(result.environments);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formData.site_id || !formData.site_environment_id || !formData.role_name || !formData.credential_value) {
      setError('Site, environment, role name, and credential value are required');
      return;
    }

    setLoading(true);

    try {
      const result = await createCredential({
        site_id: parseInt(formData.site_id, 10),
        site_environment_id: parseInt(formData.site_environment_id, 10),
        role_name: formData.role_name.trim(),
        credential_value: formData.credential_value,
        name: formData.name.trim() || formData.role_name.trim(),
        description: formData.description.trim() || undefined,
        is_session_only: formData.is_session_only,
      });

      if (result.success) {
        router.push('/dashboard/settings/credentials');
      } else {
        setError(result.error || 'Failed to create credential');
      }
    } catch (err) {
      setError('An error occurred while creating the credential');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/settings/credentials">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-zinc-900">New Site Credential</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="site_id">Site *</Label>
                <select
                  id="site_id"
                  value={formData.site_id}
                  onChange={(e) => setFormData({ ...formData, site_id: e.target.value, site_environment_id: '' })}
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                  required
                >
                  <option value="">Select site...</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="site_environment_id">Environment *</Label>
                <select
                  id="site_environment_id"
                  value={formData.site_environment_id}
                  onChange={(e) => setFormData({ ...formData, site_environment_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                  required
                  disabled={!formData.site_id}
                >
                  <option value="">Select environment...</option>
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role_name">Role Name *</Label>
              <Input
                id="role_name"
                type="text"
                value={formData.role_name}
                onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                placeholder="e.g., admin, customer, guest"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="credential_value">Credential Value *</Label>
              <Input
                id="credential_value"
                type="text"
                value={formData.credential_value}
                onChange={(e) => setFormData({ ...formData, credential_value: e.target.value })}
                placeholder="Enter credential value (will be encrypted)"
                required
              />
              <p className="text-sm text-zinc-500">This value will be encrypted and stored in the vault</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Human-readable name (defaults to role name)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_session_only"
                checked={formData.is_session_only}
                onCheckedChange={(checked: boolean) =>
                  setFormData({ ...formData, is_session_only: checked })
                }
              />
              <Label htmlFor="is_session_only" className="font-normal cursor-pointer">
                Session-only (will be deleted on logout)
              </Label>
            </div>

            <div className="flex gap-4 pt-4">
              <Link href="/dashboard/settings/credentials" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Credential'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
