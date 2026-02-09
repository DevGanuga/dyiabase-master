import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <div className="text-center max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src="/dyia-agent.png" alt="dyia" className="w-10 h-10 object-contain" />
          <span className="text-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">dyia</span>
        </div>
        <h1 className="text-7xl font-bold text-slate-200 dark:text-slate-700 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
          Page not found
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/app"
            className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-medium rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
