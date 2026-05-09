import AppShell from "@/components/app-shell";
import Link from "next/link";

export default function SiteDetailPage({ params }: { params: { siteId: string } }) {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/sites"
            className="text-blue-600 hover:underline"
          >
            Sites
          </Link>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-900">Site {params.siteId}</span>
        </div>
        <h1 className="text-3xl font-bold text-zinc-900">Site Detail</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-zinc-600">Site ID: {params.siteId}</p>
          <p className="text-zinc-600 mt-2">Site details placeholder.</p>
        </div>
      </div>
    </AppShell>
  );
}
