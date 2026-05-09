import AppShell from "@/components/app-shell";
import Link from "next/link";

export default function SitesPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-zinc-900">Sites</h1>
          <Link
            href="/dashboard/sites/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            New Site
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-zinc-600">No sites configured yet.</p>
        </div>
      </div>
    </AppShell>
  );
}
