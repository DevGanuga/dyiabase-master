'use client'

interface DyiaOrbProps {
  isOpen: boolean
  onToggle: () => void
  notificationCount?: number
  isPro?: boolean
}

export function DyiaOrb({
  isOpen,
  onToggle,
  notificationCount = 0,
  isPro = true,
}: DyiaOrbProps) {
  return (
    <div
      className={`
        fixed bottom-20 right-4 z-50 sm:bottom-6 sm:right-6
        transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${isOpen ? 'translate-x-20 opacity-0 pointer-events-none scale-90' : 'translate-x-0 opacity-100 scale-100'}
      `}
    >
      {/* "PRO" label above orb for basic users */}
      {!isPro && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-[9px] font-bold text-white uppercase tracking-wider shadow-lg whitespace-nowrap">
          Dyia Pro
        </div>
      )}
      <button
        onClick={onToggle}
        className={`
          group relative w-14 h-14 rounded-full flex items-center justify-center
          text-white shadow-lg
          transition-all duration-200 ease-out
          hover:scale-105 hover:shadow-xl
          active:scale-95
          ${isPro
            ? 'bg-gradient-to-br from-orange-500 to-amber-500 hover:shadow-orange-500/25'
            : 'bg-gradient-to-br from-slate-400 to-slate-500 hover:from-orange-500 hover:to-amber-500 hover:shadow-orange-500/25'
          }
          ${notificationCount > 0 ? 'shadow-orange-500/30 shadow-xl' : 'shadow-orange-500/15'}
        `}
        title={isPro ? 'Talk to Dyia' : 'Upgrade to Dyia Pro'}
        aria-label={isPro ? 'Open Dyia assistant' : 'Upgrade to Dyia Pro'}
      >
        {/* Agent image */}
        <span className="relative z-10">
          <img src="/dyia-agent.png" alt="Dyia" className={`w-8 h-8 object-contain ${!isPro ? 'opacity-70 group-hover:opacity-100 transition-opacity' : ''}`} />
        </span>

        {/* Lock icon overlay for basic users */}
        {!isPro && (
          <span className="absolute bottom-0 right-0 w-5 h-5 bg-slate-600 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 z-20">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </span>
        )}

        {/* Notification Badge (pro users only) */}
        {isPro && notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md border-2 border-white dark:border-slate-900 z-20">
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </button>
    </div>
  )
}
