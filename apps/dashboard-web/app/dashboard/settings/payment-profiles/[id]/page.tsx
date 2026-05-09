'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { getPaymentProfile, updatePaymentProfile, type PaymentProfile } from '@/app/actions/payment-profiles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, CreditCard, Landmark } from 'lucide-react';

export default function EditPaymentProfilePage() {
  const router = useRouter();
  const params = useParams();
  const profileId = parseInt(params.id as string, 10);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PaymentProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    last_4: '',
    card_brand: '',
    expiry_month: '',
    expiry_year: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    loadProfile();
  }, [profileId]);

  async function loadProfile() {
    try {
      setLoading(true);
      const result = await getPaymentProfile(profileId);
      if (result.success && result.profile) {
        setProfile(result.profile);
        setFormData({
          name: result.profile.name,
          last_4: result.profile.last_4 || '',
          card_brand: result.profile.card_brand || '',
          expiry_month: result.profile.expiry_month?.toString() || '',
          expiry_year: result.profile.expiry_year?.toString() || '',
          description: result.profile.description || '',
          is_active: result.profile.is_active,
        });
      } else {
        setError(result.error || 'Payment profile not found');
      }
    } catch (err) {
      setError('An error occurred while loading the payment profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);

    try {
      const result = await updatePaymentProfile({
        id: profileId,
        name: formData.name.trim(),
        last_4: formData.last_4.trim() || undefined,
        card_brand: profile?.payment_type === 'card' ? formData.card_brand.trim() || undefined : undefined,
        expiry_month: profile?.payment_type === 'card' ? parseInt(formData.expiry_month, 10) || undefined : undefined,
        expiry_year: profile?.payment_type === 'card' ? parseInt(formData.expiry_year, 10) || undefined : undefined,
        description: formData.description.trim() || undefined,
        is_active: formData.is_active,
      });

      if (result.success) {
        router.push('/dashboard/settings/payment-profiles');
      } else {
        setError(result.error || 'Failed to update payment profile');
      }
    } catch (err) {
      setError('An error occurred while updating the payment profile');
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

  if (!profile && !loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/settings/payment-profiles">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error || 'Payment profile not found'}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const isCard = profile?.payment_type === 'card';

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/settings/payment-profiles">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            {isCard ? (
              <CreditCard className="h-6 w-6 text-blue-500" />
            ) : (
              <Landmark className="h-6 w-6 text-green-500" />
            )}
            <h1 className="text-3xl font-bold text-zinc-900">Edit: {profile?.name}</h1>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-lg w-fit">
              <span className="text-sm font-medium text-zinc-600 capitalize">
                {profile?.payment_type}
              </span>
              <span className="text-zinc-400">|</span>
              <span className="text-sm text-zinc-500">•••• {profile?.last_4}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Profile Name *</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Test Visa Card, Sandbox Checking"
                required
              />
            </div>

            {isCard && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="card_brand">Card Brand</Label>
                  <select
                    id="card_brand"
                    value={formData.card_brand}
                    onChange={(e) => setFormData({ ...formData, card_brand: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                  >
                    <option value="">Select...</option>
                    <option value="visa">Visa</option>
                    <option value="mastercard">Mastercard</option>
                    <option value="amex">American Express</option>
                    <option value="discover">Discover</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiry_month">Exp Month</Label>
                  <select
                    id="expiry_month"
                    value={formData.expiry_month}
                    onChange={(e) => setFormData({ ...formData, expiry_month: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                  >
                    <option value="">MM</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {(i + 1).toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiry_year">Exp Year</Label>
                  <select
                    id="expiry_year"
                    value={formData.expiry_year}
                    onChange={(e) => setFormData({ ...formData, expiry_year: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                  >
                    <option value="">YYYY</option>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() + i;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}

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
                Active (available for use in test runs)
              </Label>
            </div>

            <div className="flex gap-4 pt-4">
              <Link href="/dashboard/settings/payment-profiles" className="flex-1">
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
