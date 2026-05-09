'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { getCredential, updateCredential, type Credential } from '@/app/actions/credentials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function EditCredentialPage() {
  const router = useRouter();
  const params = useParams();
  const credentialId = parseInt(params.id as string, 10);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [formData, setFormData] = useState({
    credential_value: '',
    is_active: true,
  });

  useEffect(() => {
    loadCredential();
  }, [credentialId]);

  async function loadCredential() {
    try {
      setLoading(true);
      const result = await getCredential(credentialId);
      if (result.success && result.credential) {
        setCredential(result.credential);
        setFormData({
          credential_value: '',
          is_active: result.credential.is_active,
        });
      } else {
        setError(result.error || 'Credential not found');
      }
    } catch (err) {
      setError('An error occurred while loading the credential');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    setSaving(true);

    try {
      const result = await updateCredential({
        id: credentialId,
        credential_value: formData.credential_value || undefined,
        is_active: formData.is_active,
      });

      if (result.success) {
        router.push('/dashboard/settings/credentials');
      } else {
        setError(result.error || 'Failed to update credential');
      }
    } catch (err) {
      setError('An error occurred while updating the credential');
    } finally {
      setSaving(false);
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

  if (!credential && !loading) {
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
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error || 'Credential not found'}</p>
          </div>
        </div>
      </AppShell>
    );
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
          <h1 className="text-3xl font-bold text-zinc-900">Edit Credential: {credential?.role_name}</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="credential_value">New Credential Value (optional)</Label>
              <Input
                id="credential_value"
                type="text"
                value={formData.credential_value}
                onChange={(e) => setFormData({ ...formData, credential_value: e.target.value })}
                placeholder="Leave blank to keep current value (will be re-encrypted)"
              />
              <p className="text-sm text-zinc-500">
                Enter a new value only if you want to change the credential. The new value will be encrypted.
              </p>
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
                Active (available for use in test runs)
              </Label>
            </div>

            <div className="flex gap-4 pt-4">
              <Link href="/dashboard/settings/credentials" className="flex-1">
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
