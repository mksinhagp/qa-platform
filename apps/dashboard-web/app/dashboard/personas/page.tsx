import AppShell from "@/components/app-shell";

export default function PersonasPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-zinc-900">Personas</h1>
        <p className="text-zinc-600">Read-only seeded persona library (v1)</p>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-zinc-600">6 personas will be loaded from database seed.</p>
        </div>
      </div>
    </AppShell>
  );
}
