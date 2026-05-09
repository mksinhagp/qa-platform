import AppShell from "@/components/app-shell";
import Link from "next/link";

export default function NewRunPage() {
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
          <span className="text-zinc-900">New Run</span>
        </div>
        <h1 className="text-3xl font-bold text-zinc-900">New Matrix Run</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <form className="space-y-4">
            <div>
              <label htmlFor="site" className="block text-sm font-medium text-zinc-700 mb-1">
                Site
              </label>
              <select
                id="site"
                name="site"
                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a site</option>
              </select>
            </div>
            <div>
              <label htmlFor="environment" className="block text-sm font-medium text-zinc-700 mb-1">
                Environment
              </label>
              <select
                id="environment"
                name="environment"
                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select an environment</option>
              </select>
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Run
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
