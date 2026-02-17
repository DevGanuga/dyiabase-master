export default function OnboardingLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-page)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 animate-pulse">
          <img src="/dyia-agent.png" alt="" className="w-6 h-6 object-contain" />
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">Setting things up...</p>
      </div>
    </div>
  )
}
