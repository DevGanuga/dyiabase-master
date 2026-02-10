import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="text-7xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent mb-4">
          404
        </div>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-slate-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/20 transition-all"
          >
            Go Home
          </Link>
          <Link
            href="/app"
            className="px-6 py-2.5 bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl font-medium text-sm transition-all"
          >
            Dashboard
          </Link>
        </div>
        <p className="text-xs text-slate-600 mt-6">
          Need help?{' '}
          <Link href="/support" className="text-orange-400 hover:text-orange-300 underline underline-offset-2">
            Contact Support
          </Link>
        </p>
      </div>
    </div>
  )
}
