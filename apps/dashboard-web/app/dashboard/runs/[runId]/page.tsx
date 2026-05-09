import AppShell from "@/components/app-shell";
import Link from "next/link";

export default function RunDetailPage({ params }: { params: { runId: string } }) {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/runs"
            className="text-blue-600 hover:underline"
          >
            Runs
          </Link>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-900">Run {params.runId}</span>
        </div>
        <h1 className="text-3xl font-bold text-zinc-900">Run Detail</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-zinc-600">Run ID: {params.runId}</p>
          <p className="text-zinc-600 mt-2">Run details placeholder.</p>
        </div>
      </div>
    </AppShell>
  );
}
