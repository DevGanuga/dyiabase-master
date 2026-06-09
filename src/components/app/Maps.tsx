'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import type { AppJob, AppSettings } from '@/types/database'
import { loadMapsLibraries, isMapsConfigured } from '@/lib/maps/loader'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatLocalDateInput, parseLocalDate } from '@/lib/utils'
import {
  PIN_COLORS,
  pinKindForJob,
  jobHasCoords,
  computeDateRange,
  filterJobsForMap,
  sortJobsForRoute,
  buildRouteUrl,
  buildDirectionsUrl,
  routePointForJob,
  telHref,
  type MapDateRange,
} from '@/lib/maps/jobs'

interface MapsProps {
  jobs: AppJob[]
  setJobs?: (jobs: AppJob[]) => void
  settings: AppSettings
  userId: string
  isPro?: boolean
  isDemoMode?: boolean
  /** Pre-select a pin when navigating in from a cross-link (Calendar / Jobs). */
  focusJobId?: string | null
  onFocusConsumed?: () => void
  /** Jump back into the Jobs view to edit/complete a job. */
  onOpenJob?: (job: AppJob) => void
}

function buildPinIcon(color: string, isToday: boolean): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: isToday ? 4 : 2,
    scale: isToday ? 11 : 7,
  }
}

// US geographic center — used only when there are no pins to fit to.
const DEFAULT_CENTER = { lat: 39.5, lng: -98.35 }

// Lazily-built OverlayView subclass (can't extend google.maps.* at module load
// because the API isn't present yet). Renders an animated CSS pulse ring under
// today's pins — the spec's "larger pulsing pin".
let PulseOverlayCtor: (new (position: google.maps.LatLng, color: string) => google.maps.OverlayView) | null = null

function createPulseOverlay(position: google.maps.LatLng, color: string): google.maps.OverlayView {
  if (!PulseOverlayCtor) {
    class PulseOverlay extends google.maps.OverlayView {
      private div?: HTMLDivElement
      constructor(private pos: google.maps.LatLng, private color: string) {
        super()
      }
      onAdd() {
        const div = document.createElement('div')
        div.className = 'dyia-map-pulse'
        div.style.setProperty('--dyia-pulse-color', this.color)
        this.div = div
        this.getPanes()?.overlayLayer.appendChild(div)
      }
      draw() {
        const projection = this.getProjection()
        if (!projection || !this.div) return
        const point = projection.fromLatLngToDivPixel(this.pos)
        if (point) {
          this.div.style.left = `${point.x}px`
          this.div.style.top = `${point.y}px`
        }
      }
      onRemove() {
        this.div?.remove()
        this.div = undefined
      }
    }
    PulseOverlayCtor = PulseOverlay
  }
  return new PulseOverlayCtor(position, color)
}

export function Maps({
  jobs,
  setJobs,
  userId,
  isPro = false,
  isDemoMode = false,
  focusJobId,
  onFocusConsumed,
  onOpenJob,
}: MapsProps) {
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())
  const pulsesRef = useRef<google.maps.OverlayView[]>([])
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const didInitialFitRef = useRef(false)

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error' | 'unconfigured'>('loading')
  const [dateRange, setDateRange] = useState<MapDateRange>('today')
  const [customStart, setCustomStart] = useState(formatLocalDateInput())
  const [customEnd, setCustomEnd] = useState(formatLocalDateInput())
  const [showJobs, setShowJobs] = useState(true)
  const [showEstimates, setShowEstimates] = useState(true)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [backfilling, setBackfilling] = useState(false)
  // customerId -> phone, fetched once so the detail panel can offer "Call".
  const [phoneByCustomer, setPhoneByCustomer] = useState<Record<string, string>>({})

  const todayStr = formatLocalDateInput()

  // ── Date range bounds ───────────────────────────────────────────────────
  const range = useMemo(
    () => computeDateRange(dateRange, todayStr, customStart, customEnd),
    [dateRange, customStart, customEnd, todayStr]
  )

  // ── Filtered jobs (date + type) ─────────────────────────────────────────
  const filteredJobs = useMemo(
    () => filterJobsForMap(jobs, range, showJobs, showEstimates),
    [jobs, range, showJobs, showEstimates]
  )

  const mappableJobs = useMemo(() => filteredJobs.filter(jobHasCoords), [filteredJobs])

  const phoneForJob = useCallback(
    (job: AppJob): string | null => {
      const raw = job.customerPhone || (job.customerId ? phoneByCustomer[job.customerId] : undefined)
      return raw || null
    },
    [phoneByCustomer]
  )
  const missingCoordsCount = filteredJobs.length - mappableJobs.length
  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) || null,
    [jobs, selectedJobId]
  )

  // ── Initialize the map once ───────────────────────────────────────────────
  useEffect(() => {
    if (!isMapsConfigured()) {
      setLoadState('unconfigured')
      return
    }
    let cancelled = false
    loadMapsLibraries()
      .then(({ maps }) => {
        if (cancelled || !mapElRef.current) return
        const map = new maps.Map(mapElRef.current, {
          center: DEFAULT_CENTER,
          zoom: 4,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
        })
        mapRef.current = map
        clustererRef.current = new MarkerClusterer({ map, markers: [] })
        setLoadState('ready')
      })
      .catch((err) => {
        console.error('Failed to load Google Maps:', err)
        setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── Lazy coordinate backfill for jobs that have an address but no coords ──
  // Spec: "we backfill lazily as users open the map." Caps per-open work so a
  // big history doesn't fire hundreds of geocodes at once.
  useEffect(() => {
    if (isDemoMode || loadState !== 'ready') return
    const needsCoords = filteredJobs
      .filter((j) => !jobHasCoords(j) && j.address && j.address.trim())
      .slice(0, 25)
    if (needsCoords.length === 0) return

    let cancelled = false
    setBackfilling(true)
    ;(async () => {
      try {
        const { geocoding } = await loadMapsLibraries()
        const geocoder = new geocoding.Geocoder()
        const supabase = createClient()
        const resolved: { id: string; latitude: number; longitude: number }[] = []
        for (const job of needsCoords) {
          if (cancelled) break
          try {
            const res = await geocoder.geocode({ address: job.address! })
            const loc = res.results[0]?.geometry?.location
            if (!loc) continue
            const latitude = loc.lat()
            const longitude = loc.lng()
            await supabase
              .from('dyia_jobs')
              .update({ latitude, longitude })
              .eq('id', job.id)
              .eq('user_id', userId)
            resolved.push({ id: job.id, latitude, longitude })
          } catch {
            // Skip individual geocode failures; the pin just stays in the
            // "needs an address" count until next open.
          }
        }
        if (!cancelled && resolved.length > 0 && setJobs) {
          const byId = new Map(resolved.map((r) => [r.id, r]))
          setJobs(jobs.map((j) => (byId.has(j.id) ? { ...j, ...byId.get(j.id)! } : j)))
        }
      } finally {
        if (!cancelled) setBackfilling(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState, isDemoMode, userId, filteredJobs.length])

  // ── Customer phone lookup (for the "Call customer" action) ────────────────
  useEffect(() => {
    if (isDemoMode || loadState !== 'ready') return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('dyia_customers')
          .select('id, phone')
          .eq('user_id', userId)
          .not('phone', 'is', null)
        if (cancelled || !data) return
        const map: Record<string, string> = {}
        for (const row of data) {
          if (row.id && row.phone) map[row.id as string] = row.phone as string
        }
        setPhoneByCustomer(map)
      } catch {
        // Non-fatal: the Call button just won't appear.
      }
    })()
    return () => { cancelled = true }
  }, [isDemoMode, loadState, userId])

  // ── Render markers whenever the mappable set changes ──────────────────────
  useEffect(() => {
    const map = mapRef.current
    const clusterer = clustererRef.current
    if (!map || !clusterer || loadState !== 'ready') return

    // Clear previous markers + pulse overlays.
    clusterer.clearMarkers()
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current.clear()
    pulsesRef.current.forEach((p) => p.setMap(null))
    pulsesRef.current = []

    const bounds = new google.maps.LatLngBounds()
    const newMarkers: google.maps.Marker[] = []

    for (const job of mappableJobs) {
      const kind = pinKindForJob(job)
      const isToday = job.date === todayStr
      const position = { lat: job.latitude, lng: job.longitude }
      const marker = new google.maps.Marker({
        position,
        title: job.customerName,
        icon: buildPinIcon(PIN_COLORS[kind], isToday),
        zIndex: isToday ? 1000 : undefined,
      })
      marker.addListener('click', () => setSelectedJobId(job.id))
      markersRef.current.set(job.id, marker)
      newMarkers.push(marker)
      bounds.extend(position)

      // Today's jobs get an animated pulse ring beneath the pin.
      if (isToday) {
        const pulse = createPulseOverlay(new google.maps.LatLng(position), PIN_COLORS[kind])
        pulse.setMap(map)
        pulsesRef.current.push(pulse)
      }
    }

    clusterer.addMarkers(newMarkers)

    if (!didInitialFitRef.current && newMarkers.length > 0) {
      if (newMarkers.length === 1) {
        map.setCenter(bounds.getCenter())
        map.setZoom(14)
      } else {
        map.fitBounds(bounds, 64)
      }
      didInitialFitRef.current = true
    }
  }, [mappableJobs, loadState, todayStr])

  // Re-fit when the filter set changes meaningfully (new range/type toggle).
  useEffect(() => {
    didInitialFitRef.current = false
  }, [dateRange, customStart, customEnd, showJobs, showEstimates])

  // ── Pan to a pin when one is selected (incl. cross-link focus) ────────────
  const focusOnJob = useCallback((jobId: string) => {
    const map = mapRef.current
    const marker = markersRef.current.get(jobId)
    if (map && marker) {
      const pos = marker.getPosition()
      if (pos) {
        map.panTo(pos)
        if ((map.getZoom() || 0) < 13) map.setZoom(15)
      }
    }
  }, [])

  useEffect(() => {
    if (selectedJobId) focusOnJob(selectedJobId)
  }, [selectedJobId, focusOnJob])

  // Consume an incoming cross-link focus once the map is ready. If the linked
  // job falls outside the current range, narrow to its day so its pin renders
  // (a single-day view isn't the Pro-gated part — multi-day ranges are).
  useEffect(() => {
    if (!focusJobId || loadState !== 'ready') return
    const job = jobs.find((j) => j.id === focusJobId)
    if (job && job.date !== todayStr) {
      setDateRange('custom')
      setCustomStart(job.date)
      setCustomEnd(job.date)
    }
    setSelectedJobId(focusJobId)
    onFocusConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusJobId, loadState])

  // ── Multi-stop route deep link (Pro) ──────────────────────────────────────
  const routeUrl = useMemo(() => {
    const stops = sortJobsForRoute(mappableJobs)
      .map(routePointForJob)
      .filter((p): p is string => !!p)
    return buildRouteUrl(stops)
  }, [mappableJobs])

  const rangeLabel =
    dateRange === 'today' ? "Today" : dateRange === 'week' ? 'This week' : 'Custom range'

  // ── Unconfigured / error fallbacks ────────────────────────────────────────
  if (loadState === 'unconfigured') {
    return (
      <div className="page-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Maps</h1>
            <p className="page-subtitle">See every upcoming job on a map.</p>
          </div>
        </div>
        <div className="app-card p-8 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <MapIcon className="w-6 h-6 text-orange-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">Maps isn&apos;t set up yet</h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            Add a Google Maps API key (<code className="text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>) to enable the map.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Maps</h1>
          <p className="page-subtitle">
            {mappableJobs.length > 0
              ? <>{mappableJobs.length} job{mappableJobs.length !== 1 ? 's' : ''} mapped · {rangeLabel.toLowerCase()}</>
              : <>Plan your day geographically</>}
          </p>
        </div>
        {routeUrl && (
          isPro ? (
            <a
              href={routeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="app-btn-primary text-sm py-2.5 px-4 shrink-0 inline-flex items-center gap-2"
            >
              <RouteIcon className="w-4 h-4" />
              Open route in Google Maps
            </a>
          ) : (
            <a
              href="/app?view=settings&tab=account#subscription"
              className="app-btn-secondary text-sm py-2.5 px-4 shrink-0 inline-flex items-center gap-2"
            >
              <RouteIcon className="w-4 h-4" />
              Route
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-500">PRO</span>
            </a>
          )
        )}
      </div>

      {/* Filters */}
      <div className="app-card p-3 sm:p-4 flex flex-wrap items-center gap-3">
        {/* Date range */}
        <div className="inline-flex rounded-lg bg-[var(--color-bg-subtle)] p-0.5">
          <RangeTab label="Today" active={dateRange === 'today'} onClick={() => setDateRange('today')} />
          <RangeTab label="This Week" active={dateRange === 'week'} locked={!isPro} onClick={() => isPro && setDateRange('week')} />
          <RangeTab label="Custom" active={dateRange === 'custom'} locked={!isPro} onClick={() => isPro && setDateRange('custom')} />
        </div>

        {dateRange === 'custom' && isPro && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="app-input !py-1.5 !text-xs" />
            <span className="text-[var(--color-text-faint)]">to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="app-input !py-1.5 !text-xs" />
          </div>
        )}

        <div className="h-5 w-px bg-[var(--color-border)] hidden sm:block" />

        {/* Type toggles */}
        <div className="flex items-center gap-2">
          <FilterChip label="Jobs" color={PIN_COLORS.scheduled} active={showJobs} onClick={() => setShowJobs((v) => !v)} />
          <FilterChip label="Estimates" color={PIN_COLORS.estimate} active={showEstimates} onClick={() => setShowEstimates((v) => !v)} />
        </div>

        {backfilling && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <span className="w-3 h-3 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            Locating addresses…
          </span>
        )}
      </div>

      {/* Map + detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 relative">
          <div
            ref={mapElRef}
            className="w-full h-[420px] sm:h-[560px] rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-subtle)]"
          />
          {loadState === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[var(--color-bg-subtle)]/80">
              <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
          )}
          {loadState === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 rounded-xl bg-[var(--color-bg-subtle)]">
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Couldn&apos;t load the map</p>
              <p className="text-xs text-[var(--color-text-muted)]">Check your connection and refresh.</p>
            </div>
          )}
          {loadState === 'ready' && mappableJobs.length === 0 && (
            <div className="absolute inset-x-0 top-3 mx-auto w-fit max-w-[90%] px-4 py-2 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm">
              <p className="text-xs text-[var(--color-text-muted)] text-center">
                {missingCoordsCount > 0
                  ? `${missingCoordsCount} job${missingCoordsCount !== 1 ? 's' : ''} ${rangeLabel.toLowerCase()} have no mapped address yet.`
                  : `No jobs ${rangeLabel.toLowerCase()}.`}
              </p>
            </div>
          )}

          {/* Legend */}
          {loadState === 'ready' && (
            <div className="absolute bottom-3 left-3 px-3 py-2 rounded-lg bg-[var(--color-bg-card)]/95 border border-[var(--color-border)] shadow-sm flex flex-wrap gap-x-3 gap-y-1">
              <LegendDot color={PIN_COLORS.scheduled} label="Scheduled" />
              <LegendDot color={PIN_COLORS.estimate} label="Estimate" />
              <LegendDot color={PIN_COLORS.completed} label="Completed" />
              <LegendDot color={PIN_COLORS.cancelled} label="Cancelled" />
            </div>
          )}
        </div>

        {/* Detail panel (side on desktop) */}
        <div className="lg:col-span-1 hidden lg:block">
          {selectedJob ? (
            <PinDetail job={selectedJob} phone={phoneForJob(selectedJob)} onClose={() => setSelectedJobId(null)} onOpenJob={onOpenJob} />
          ) : (
            <div className="app-card p-6 text-center h-full flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center mb-3">
                <MapIcon className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Click a pin</h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Select any pin to see the customer, time window, and one-tap directions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom sheet */}
      {selectedJob && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="animate-in slide-in-from-bottom duration-300">
            <PinDetail job={selectedJob} phone={phoneForJob(selectedJob)} onClose={() => setSelectedJobId(null)} onOpenJob={onOpenJob} sheet />
          </div>
        </div>
      )}

      {/* Pro upsell for non-pro users — a teaser under the map */}
      {!isPro && (
        <div className="app-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
            <RouteIcon className="w-5 h-5 text-orange-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Plan a whole week and open multi-stop routes</p>
            <p className="text-xs text-[var(--color-text-muted)]">Week and custom date ranges, plus one-tap routing, are part of Pro.</p>
          </div>
          <a href="/app?view=settings&tab=account#subscription" className="app-btn-primary text-xs py-2 px-3 ml-auto shrink-0">Upgrade</a>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function RangeTab({ label, active, locked, onClick }: { label: string; active: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
        active ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
      }`}
    >
      {label}
      {locked && (
        <span className="ml-1 align-middle px-1 py-0.5 rounded text-[8px] font-bold bg-orange-500/20 text-orange-500">PRO</span>
      )}
    </button>
  )
}

function FilterChip({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        active
          ? 'border-[var(--color-border-hover)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)]'
          : 'border-transparent bg-[var(--color-bg-subtle)] text-[var(--color-text-faint)]'
      }`}
    >
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: active ? color : 'var(--color-text-faint)' }} />
      {label}
    </button>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
      <span className="w-2.5 h-2.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function PinDetail({ job, phone, onClose, onOpenJob, sheet }: { job: AppJob; phone?: string | null; onClose: () => void; onOpenJob?: (job: AppJob) => void; sheet?: boolean }) {
  const kind = pinKindForJob(job)
  const statusLabel =
    kind === 'cancelled' ? 'Cancelled' : kind === 'estimate' ? (job.scheduledKind === 'free_estimate' ? 'Free estimate' : 'Estimate') : kind === 'completed' ? 'Completed' : 'Scheduled'
  const dateLabel = parseLocalDate(job.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const directionsUrl = buildDirectionsUrl(job)
  const callHref = telHref(phone)
  const valueLabel =
    kind === 'estimate'
      ? (job.estimateLow && job.estimateHigh ? `${formatCurrency(job.estimateLow)}–${formatCurrency(job.estimateHigh)}` : job.estimateLow ? `From ${formatCurrency(job.estimateLow)}` : null)
      : job.revenue > 0 ? formatCurrency(job.revenue) : null

  return (
    <div className={`bg-[var(--color-bg-card)] border border-[var(--color-border)] ${sheet ? 'rounded-2xl shadow-2xl' : 'rounded-xl sticky top-4'} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-[var(--color-border-light)] flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">{job.customerName}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIN_COLORS[kind] }} />
            <span className="text-[11px] text-[var(--color-text-muted)]">{statusLabel} · {dateLabel}</span>
          </div>
        </div>
        <button onClick={onClose} className="p-1 -mr-1 rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] active:scale-90 transition-all" aria-label="Close">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="px-4 py-3 space-y-2.5 text-sm">
        {job.appointmentWindow && (
          <Row label="Time window" value={job.appointmentWindow} />
        )}
        {valueLabel && (
          <Row label={kind === 'estimate' ? 'Estimate' : 'Revenue'} value={valueLabel} valueClass={kind === 'estimate' ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'} />
        )}
        {job.address && <Row label="Address" value={job.address} />}
        {job.notes && (
          <div className="pt-1">
            <p className="text-[11px] text-[var(--color-text-faint)] mb-0.5">Notes</p>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{job.notes}</p>
          </div>
        )}
      </div>

      <div className="px-4 pb-4 space-y-2">
        {onOpenJob && (
          <button onClick={() => onOpenJob(job)} className="app-btn-primary text-sm py-2 w-full">
            {job.status === 'scheduled' ? 'Open in Jobs to complete' : 'Open in Jobs'}
          </button>
        )}
        {(directionsUrl || callHref) && (
          <div className="flex gap-2">
            {directionsUrl && (
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="app-btn-secondary text-xs py-2 flex-1 text-center inline-flex items-center justify-center gap-1.5">
                <RouteIcon className="w-3.5 h-3.5" />
                Directions
              </a>
            )}
            {callHref && (
              <a href={callHref} className="app-btn-secondary text-xs py-2 flex-1 text-center inline-flex items-center justify-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.5 1.2l-2.26 1.13a11 11 0 005.52 5.52l1.13-2.26a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" /></svg>
                Call
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] text-[var(--color-text-faint)] shrink-0 pt-0.5">{label}</span>
      <span className={`text-xs font-medium text-right ${valueClass || 'text-[var(--color-text-secondary)]'}`}>{value}</span>
    </div>
  )
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )
}

function RouteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 11l19-9-9 19-2-8-8-2z" />
    </svg>
  )
}
