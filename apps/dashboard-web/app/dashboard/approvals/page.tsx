import AppShell from "@/components/app-shell";

export default function ApprovalsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-zinc-900">Approvals</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-zinc-600">No pending approvals.</p>
        </div>
      </div>
    </AppShell>
  );
}
