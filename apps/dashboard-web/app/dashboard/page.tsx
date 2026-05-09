import AppShell from "@/components/app-shell";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-zinc-900">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/dashboard/sites"
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">Sites</h2>
            <p className="text-zinc-600">Manage sites under test</p>
          </Link>
          <Link
            href="/dashboard/runs"
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">Runs</h2>
            <p className="text-zinc-600">View and manage test runs</p>
          </Link>
          <Link
            href="/dashboard/approvals"
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">Approvals</h2>
            <p className="text-zinc-600">Pending approval requests</p>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
