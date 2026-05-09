'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/components/app-shell';
import { createPaymentProfile } from '@/app/actions/payment-profiles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, CreditCard, Landmark } from 'lucide-react';

export default function NewPaymentProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<'card' | 'ach'>('card');
  const [formData, setFormData] = useState({
    name: '',
    account_number: '',
    routing_number: '',
    last_4: '',
    card_brand: '',
    expiry_month: '',
    expiry_year: '',
    description: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.account_number.trim()) {
      setError(paymentType === 'card' ? 'Card number is required' : 'Account number is required');
      return;
    }
    if (paymentType === 'ach' && !formData.routing_number.trim()) {
      setError('Routing number is required for ACH');
      return;
    }

    setLoading(true);

    try {
      const result = await createPaymentProfile({
        name: formData.name.trim(),
        payment_type: paymentType,
        account_number: formData.account_number.trim(),
        routing_number: paymentType === 'ach' ? formData.routing_number.trim() : undefined,
        last_4: formData.last_4.trim() || formData.account_number.slice(-4),
        card_brand: paymentType === 'card' ? formData.card_brand.trim() || undefined : undefined,
        expiry_month: paymentType === 'card' ? parseInt(formData.expiry_month, 10) || undefined : undefined,
        expiry_year: paymentType === 'card' ? parseInt(formData.expiry_year, 10) || undefined : undefined,
        description: formData.description.trim() || undefined,
      });

      if (result.success) {
        router.push('/dashboard/settings/payment-profiles');
      } else {
        setError(result.error || 'Failed to create payment profile');
      }
    } catch (err) {
      setError('An error occurred while creating the payment profile');
    } finally {
      setLoading(false);
    }
  }

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
          <h1 className="text-3xl font-bold text-zinc-900">New Payment Profile</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Payment Type Selection */}
            <div className="space-y-2">
              <Label>Payment Type</Label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentType('card')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors ${
                    paymentType === 'card'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="font-medium">Credit Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('ach')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors ${
                    paymentType === 'ach'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <Landmark className="h-5 w-5" />
                  <span className="font-medium">ACH / Bank Account</span>
                </button>
              </div>
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

            {paymentType === 'card' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="account_number">Card Number *</Label>
                  <Input
                    id="account_number"
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData({
                        ...formData,
                        account_number: value,
                        last_4: value.slice(-4),
                      });
                    }}
                    placeholder="4111 1111 1111 1111"
                    maxLength={19}
                    required
                  />
                  <p className="text-sm text-zinc-500">Card number will be encrypted and stored securely</p>
                </div>

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
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="account_number">Account Number *</Label>
                  <Input
                    id="account_number"
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData({
                        ...formData,
                        account_number: value,
                        last_4: value.slice(-4),
                      });
                    }}
                    placeholder="000123456789"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="routing_number">Routing Number *</Label>
                  <Input
                    id="routing_number"
                    type="text"
                    value={formData.routing_number}
                    onChange={(e) => setFormData({ ...formData, routing_number: e.target.value.replace(/\D/g, '') })}
                    placeholder="011000015"
                    maxLength={9}
                    required
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description (e.g., For sandbox testing)"
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Security Note:</strong> Account numbers are encrypted using AES-256-GCM and stored in the vault. 
                Only the last 4 digits are stored in plaintext for identification.
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <Link href="/dashboard/settings/payment-profiles" className="flex-1">
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
                  'Create Payment Profile'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
