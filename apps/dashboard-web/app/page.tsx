import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-zinc-900">QA Automation Platform</h1>
        <p className="text-lg text-zinc-600">Master-Tester Edition</p>
        <div className="space-y-3">
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Login
          </Link>
          <br />
          <Link
            href="/dashboard"
            className="inline-block text-blue-600 hover:underline"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
