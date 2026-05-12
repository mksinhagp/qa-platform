import Link from "next/link";
import { VaultStatePill } from "./vault-state-pill";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link
                href="/dashboard"
                className="flex items-center px-4 border-b-2 border-transparent hover:border-zinc-300 text-zinc-700 hover:text-zinc-900"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/sites"
                className="flex items-center px-4 border-b-2 border-transparent hover:border-zinc-300 text-zinc-700 hover:text-zinc-900"
              >
                Sites
              </Link>
              <Link
                href="/dashboard/runs"
                className="flex items-center px-4 border-b-2 border-transparent hover:border-zinc-300 text-zinc-700 hover:text-zinc-900"
              >
                Runs
              </Link>
              <Link
                href="/dashboard/campaigns"
                className="flex items-center px-4 border-b-2 border-transparent hover:border-zinc-300 text-zinc-700 hover:text-zinc-900"
              >
                Campaigns
              </Link>
              <Link
                href="/dashboard/approvals"
                className="flex items-center px-4 border-b-2 border-transparent hover:border-zinc-300 text-zinc-700 hover:text-zinc-900"
              >
                Approvals
              </Link>
              <Link
                href="/dashboard/artifacts"
                className="flex items-center px-4 border-b-2 border-transparent hover:border-zinc-300 text-zinc-700 hover:text-zinc-900"
              >
                Artifacts
              </Link>
              <Link
                href="/dashboard/personas"
                className="flex items-center px-4 border-b-2 border-transparent hover:border-zinc-300 text-zinc-700 hover:text-zinc-900"
              >
                Personas
              </Link>
            </div>
            <div className="flex items-center">
              <Link
                href="/dashboard/settings/llm-benchmark"
                className="flex items-center px-4 border-b-2 border-transparent hover:border-zinc-300 text-zinc-700 hover:text-zinc-900"
              >
                AI Models
              </Link>
              <Link
                href="/dashboard/settings/operators"
                className="flex items-center px-4 border-b-2 border-transparent hover:border-zinc-300 text-zinc-700 hover:text-zinc-900"
              >
                Settings
              </Link>
              <Link
                href="/dashboard/audit"
                className="flex items-center px-4 border-b-2 border-transparent hover:border-zinc-300 text-zinc-700 hover:text-zinc-900"
              >
                Audit
              </Link>
              <VaultStatePill />
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
