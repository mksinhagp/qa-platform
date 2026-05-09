'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/components/app-shell';
import { listPaymentProfiles, type PaymentProfile } from '@/app/actions/payment-profiles';
import { Button } from '@/components/ui/button';
import { Plus, Edit, CreditCard, Landmark, CheckCircle, XCircle } from 'lucide-react';

export default function PaymentProfilesPage() {
  const [profiles, setProfiles] = useState<PaymentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    try {
      setLoading(true);
      const result = await listPaymentProfiles();
      if (result.success && result.profiles) {
        setProfiles(result.profiles);
      } else {
        setError(result.error || 'Failed to load payment profiles');
      }
    } catch (err) {
      setError('An error occurred while loading payment profiles');
    } finally {
      setLoading(false);
    }
  }

  function getCardIcon(type: string) {
    return type === 'card' ? (
      <CreditCard className="h-5 w-5 text-blue-500" />
    ) : (
      <Landmark className="h-5 w-5 text-green-500" />
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-zinc-900">Payment Profiles</h1>
          <Link href="/dashboard/settings/payment-profiles/new">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Payment Profile
            </Button>
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    Loading payment profiles...
                  </td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    No payment profiles found. Create your first profile to get started.
                  </td>
                </tr>
              ) : (
                profiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getCardIcon(profile.payment_type)}
                        <span className="text-sm text-zinc-600 capitalize">{profile.payment_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">
                      {profile.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                      {profile.last_4 ? (
                        <span>
                          •••• {profile.last_4}
                          {profile.expiry_month && profile.expiry_year && (
                            <span className="ml-2 text-zinc-400">
                              Exp: {profile.expiry_month}/{profile.expiry_year}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {profile.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="h-3 w-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link href={`/dashboard/settings/payment-profiles/${profile.id}`}>
                        <Button variant="ghost" size="sm" className="flex items-center gap-1">
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
