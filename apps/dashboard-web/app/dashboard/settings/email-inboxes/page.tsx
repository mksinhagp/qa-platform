'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { listEmailInboxes, type EmailInbox } from '@/app/actions/email-inboxes';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Mail, Server, CheckCircle, XCircle, Shield } from 'lucide-react';

export default function EmailInboxesPage() {
  const [inboxes, setInboxes] = useState<EmailInbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInboxes();
  }, []);

  async function loadInboxes() {
    try {
      setLoading(true);
      const result = await listEmailInboxes();
      if (result.success && result.inboxes) {
        setInboxes(result.inboxes);
      } else {
        setError(result.error || 'Failed to load email inboxes');
      }
    } catch (err) {
      setError('An error occurred while loading email inboxes');
    } finally {
      setLoading(false);
    }
  }

  function getProviderIcon(provider: string) {
    switch (provider.toLowerCase()) {
      case 'gmail':
        return <Mail className="h-5 w-5 text-red-500" />;
      case 'microsoft':
        return <Mail className="h-5 w-5 text-blue-500" />;
      case 'imap':
      case 'custom':
      default:
        return <Server className="h-5 w-5 text-zinc-500" />;
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

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-zinc-900">Email Inboxes</h1>
          <Link href="/dashboard/settings/email-inboxes/new">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Email Inbox
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
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Server
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Username
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
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    Loading email inboxes...
                  </td>
                </tr>
              ) : inboxes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    No email inboxes found. Create your first inbox to get started.
                  </td>
                </tr>
              ) : (
                inboxes.map((inbox) => (
                  <tr key={inbox.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getProviderIcon(inbox.provider)}
                        <span className="text-sm text-zinc-600">{getProviderLabel(inbox.provider)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">
                      {inbox.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                      <div className="flex items-center gap-2">
                        <span>{inbox.host}</span>
                        <span className="text-zinc-400">:{inbox.port}</span>
                        {inbox.use_tls && (
                          <span title="TLS enabled"><Shield className="h-3 w-3 text-green-500" /></span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                      {inbox.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {inbox.is_active ? (
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
                      <Link href={`/dashboard/settings/email-inboxes/${inbox.id}`}>
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
