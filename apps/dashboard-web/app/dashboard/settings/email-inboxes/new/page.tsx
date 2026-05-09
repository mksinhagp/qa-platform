'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/components/app-shell';
import { createEmailInbox } from '@/app/actions/email-inboxes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, Mail, Server } from 'lucide-react';

const PROVIDER_PRESETS = {
  gmail: { host: 'imap.gmail.com', port: 993, use_tls: true },
  microsoft: { host: 'outlook.office365.com', port: 993, use_tls: true },
  imap: { host: '', port: 993, use_tls: true },
  custom: { host: '', port: 143, use_tls: false },
};

export default function NewEmailInboxPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<'gmail' | 'microsoft' | 'imap' | 'custom'>('gmail');
  const [formData, setFormData] = useState({
    name: '',
    host: PROVIDER_PRESETS.gmail.host,
    port: PROVIDER_PRESETS.gmail.port,
    use_tls: PROVIDER_PRESETS.gmail.use_tls,
    username: '',
    password: '',
    description: '',
  });

  function handleProviderChange(newProvider: 'gmail' | 'microsoft' | 'imap' | 'custom') {
    setProvider(newProvider);
    const preset = PROVIDER_PRESETS[newProvider];
    setFormData((prev) => ({
      ...prev,
      host: preset.host,
      port: preset.port,
      use_tls: preset.use_tls,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim() || !formData.host.trim() || !formData.username.trim() || !formData.password) {
      setError('Name, host, username, and password are required');
      return;
    }

    setLoading(true);

    try {
      const result = await createEmailInbox({
        name: formData.name.trim(),
        provider,
        host: formData.host.trim(),
        port: formData.port,
        use_tls: formData.use_tls,
        username: formData.username.trim(),
        password: formData.password,
        description: formData.description.trim() || undefined,
      });

      if (result.success) {
        router.push('/dashboard/settings/email-inboxes');
      } else {
        setError(result.error || 'Failed to create email inbox');
      }
    } catch (err) {
      setError('An error occurred while creating the email inbox');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/settings/email-inboxes">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-zinc-900">New Email Inbox</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label>Email Provider</Label>
              <div className="grid grid-cols-4 gap-3">
                {(['gmail', 'microsoft', 'imap', 'custom'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleProviderChange(p)}
                    className={`flex flex-col items-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                      provider === p
                        ? 'border-zinc-900 bg-zinc-50'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    {p === 'gmail' || p === 'microsoft' ? (
                      <Mail className="h-5 w-5" />
                    ) : (
                      <Server className="h-5 w-5" />
                    )}
                    <span className="text-xs font-medium capitalize">
                      {p === 'microsoft' ? 'Microsoft 365' : p}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Profile Name *</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Test Gmail Account"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="host">IMAP Host *</Label>
                <Input
                  id="host"
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="imap.example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port *</Label>
                <Input
                  id="port"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value, 10) || 0 })}
                  placeholder="993"
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="use_tls"
                checked={formData.use_tls}
                onCheckedChange={(checked: boolean) =>
                  setFormData({ ...formData, use_tls: checked })
                }
              />
              <Label htmlFor="use_tls" className="font-normal cursor-pointer">
                Use TLS/SSL encryption
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Email Address / Username *</Label>
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="user@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Email account password or app-specific password"
                required
              />
              <p className="text-sm text-zinc-500">
                For Gmail/Microsoft, use an app-specific password. Password will be encrypted.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description (e.g., For receiving booking confirmations)"
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Security Note:</strong> Passwords are encrypted using AES-256-GCM and stored in the vault.
                We recommend using app-specific passwords rather than your main account password.
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <Link href="/dashboard/settings/email-inboxes" className="flex-1">
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
                  'Create Email Inbox'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
