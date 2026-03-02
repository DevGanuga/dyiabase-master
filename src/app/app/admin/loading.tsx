export default function AdminLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-page)]">
      <div className="flex flex-col items-center gap-4">
        <div className="loading-spinner" />
        <p className="text-sm text-[var(--color-text-muted)]">Loading admin panel...</p>
      </div>
    </div>
  )
}
