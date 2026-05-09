'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/components/app-shell';
import { getEmailInbox, updateEmailInbox, type EmailInbox } from '@/app/actions/email-inboxes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, Mail, Server } from 'lucide-react';

export default function EditEmailInboxPage() {
  const router = useRouter();
  const params = useParams();
  const inboxId = parseInt(params.id as string, 10);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inbox, setInbox] = useState<EmailInbox | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 993,
    use_tls: true,
    username: '',
    password: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    loadInbox();
  }, [inboxId]);

  async function loadInbox() {
    try {
      setLoading(true);
      const result = await getEmailInbox(inboxId);
      if (result.success && result.inbox) {
        setInbox(result.inbox);
        setFormData({
          name: result.inbox.name,
          host: result.inbox.host,
          port: result.inbox.port,
          use_tls: result.inbox.use_tls,
          username: result.inbox.username,
          password: '',
          description: result.inbox.description || '',
          is_active: result.inbox.is_active,
        });
      } else {
        setError(result.error || 'Email inbox not found');
      }
    } catch (err) {
      setError('An error occurred while loading the email inbox');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim() || !formData.host.trim() || !formData.username.trim()) {
      setError('Name, host, and username are required');
      return;
    }

    setSaving(true);

    try {
      const result = await updateEmailInbox({
        id: inboxId,
        name: formData.name.trim(),
        host: formData.host.trim(),
        port: formData.port,
        use_tls: formData.use_tls,
        username: formData.username.trim(),
        password: formData.password || undefined,
        description: formData.description.trim() || undefined,
        is_active: formData.is_active,
      });

      if (result.success) {
        router.push('/dashboard/settings/email-inboxes');
      } else {
        setError(result.error || 'Failed to update email inbox');
      }
    } catch (err) {
      setError('An error occurred while updating the email inbox');
    } finally {
      setSaving(false);
    }
  }

  function getProviderIcon(provider: string) {
    switch (provider.toLowerCase()) {
      case 'gmail':
        return <Mail className="h-6 w-6 text-red-500" />;
      case 'microsoft':
        return <Mail className="h-6 w-6 text-blue-500" />;
      case 'imap':
      case 'custom':
      default:
        return <Server className="h-6 w-6 text-zinc-500" />;
    }
  }

  function getProviderLabel(provider: string) {
    switch (provider.toLowerCase()) {
      case 'gmail':
        return 'Gmail';
      case 'microsoft':
        return 'Microsoft 365';
      case 'imap':
        return 'IMAP';
      case 'custom':
        return 'Custom';
      default:
        return provider;
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      </AppShell>
    );
  }

  if (!inbox && !loading) {
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
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error || 'Email inbox not found'}</p>
          </div>
        </div>
      </AppShell>
    );
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
          <div className="flex items-center gap-3">
            {getProviderIcon(inbox?.provider || '')}
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">{inbox?.name}</h1>
              <p className="text-sm text-zinc-500">{getProviderLabel(inbox?.provider || '')}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
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
              <Label htmlFor="password">New Password (optional)</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Leave blank to keep current password"
              />
              <p className="text-sm text-zinc-500">
                Enter a new password only if you want to change it. The new password will be encrypted.
              </p>
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
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked: boolean) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active" className="font-normal cursor-pointer">
                Active (available for email validation tests)
              </Label>
            </div>

            <div className="flex gap-4 pt-4">
              <Link href="/dashboard/settings/email-inboxes" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
