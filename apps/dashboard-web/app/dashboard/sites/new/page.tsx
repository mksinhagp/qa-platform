import AppShell from "@/components/app-shell";
import Link from "next/link";

export default function NewSitePage() {
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
          <span className="text-zinc-900">New Site</span>
        </div>
        <h1 className="text-3xl font-bold text-zinc-900">New Site</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <form className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-700 mb-1">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Site name"
              />
            </div>
            <div>
              <label htmlFor="baseUrl" className="block text-sm font-medium text-zinc-700 mb-1">
                Base URL
              </label>
              <input
                type="url"
                id="baseUrl"
                name="baseUrl"
                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-zinc-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Site description"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Site
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
