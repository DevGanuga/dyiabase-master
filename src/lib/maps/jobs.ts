/**
 * Pure, framework-free helpers for Dyia Maps.
 *
 * Kept free of any `google.maps` / DOM references so they can be unit-tested in
 * Node and reused on the server (the AI "route for Friday" handler shares the
 * same ordering + URL logic the Maps view uses on the client).
 */

import type { AppJob } from '@/types/database'

// Status/kind -> pin color (the spec's legend). Exported so the view and the
// legend can't drift apart.
export const PIN_COLORS = {
  scheduled: '#3b82f6', // blue
  estimate: '#f97316', // orange
  completed: '#22c55e', // green
  cancelled: '#94a3b8', // gray
} as const

export type PinKind = keyof typeof PIN_COLORS

export type MapDateRange = 'today' | 'week' | 'custom'

/** A job that is guaranteed to carry numeric coordinates. */
export type MappableJob = AppJob & { latitude: number; longitude: number }

export function pinKindForJob(job: Pick<AppJob, 'status' | 'scheduledKind'>): PinKind {
  if (job.status === 'cancelled') return 'cancelled'
  if (job.scheduledKind === 'estimate' || job.scheduledKind === 'free_estimate') return 'estimate'
  if (job.status === 'completed') return 'completed'
  return 'scheduled'
}

export function jobHasCoords(job: AppJob): job is MappableJob {
  return typeof job.latitude === 'number' && typeof job.longitude === 'number' &&
    !Number.isNaN(job.latitude) && !Number.isNaN(job.longitude)
}

/** True when the job represents an estimate visit rather than billable work. */
export function isEstimateJob(job: Pick<AppJob, 'scheduledKind'>): boolean {
  return job.scheduledKind === 'estimate' || job.scheduledKind === 'free_estimate'
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Format local calendar fields as YYYY-MM-DD (no UTC drift). */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Compute the inclusive [start, end] YYYY-MM-DD bounds for a range selection.
 * "week" is the Mon–Sun week containing `today`.
 */
export function computeDateRange(
  range: MapDateRange,
  todayStr: string,
  customStart: string,
  customEnd: string
): { start: string; end: string } {
  if (range === 'today') return { start: todayStr, end: todayStr }
  if (range === 'week') {
    const now = new Date(todayStr + 'T12:00:00')
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((day + 6) % 7))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { start: toDateInput(monday), end: toDateInput(sunday) }
  }
  // Custom — tolerate reversed inputs.
  if (customStart && customEnd && customStart > customEnd) {
    return { start: customEnd, end: customStart }
  }
  return { start: customStart, end: customEnd }
}

/** Apply the Maps date-range + Jobs/Estimates type filters. */
export function filterJobsForMap(
  jobs: AppJob[],
  range: { start: string; end: string },
  showJobs: boolean,
  showEstimates: boolean
): AppJob[] {
  return jobs.filter((job) => {
    if (range.start && job.date < range.start) return false
    if (range.end && job.date > range.end) return false
    const estimate = isEstimateJob(job)
    if (estimate && !showEstimates) return false
    if (!estimate && !showJobs) return false
    return true
  })
}

/**
 * Parse the start time of a freeform appointment window into minutes since
 * midnight, for chronological route ordering. Handles "8:00-10:00am",
 * "11:00am-12:00pm", "2:00-4:00pm", "9am", "1:30 PM". Returns null when no time
 * can be read so callers can sort those stops to the end.
 *
 * When the start token has no AM/PM marker, the meridiem is inferred from the
 * end token (so "8:00-10:00am" reads 8 AM, "2:00-4:00pm" reads 2 PM).
 */
export function parseWindowStartMinutes(text: string | undefined | null): number | null {
  if (!text) return null
  const timeRe = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi
  const matches = [...text.matchAll(timeRe)].filter((m) => m[0].trim() !== '')
  if (matches.length === 0) return null

  const start = matches[0]
  let hour = parseInt(start[1], 10)
  const minute = start[2] ? parseInt(start[2], 10) : 0
  if (Number.isNaN(hour) || hour > 23 || minute > 59) return null

  let meridiem = start[3]?.toLowerCase()
  if (!meridiem) {
    // Borrow the meridiem from a later token if present (the end of the window).
    const later = matches.slice(1).find((m) => m[3])
    if (later) meridiem = later[3]!.toLowerCase()
  }

  if (meridiem === 'pm' && hour < 12) hour += 12
  if (meridiem === 'am' && hour === 12) hour = 0
  return hour * 60 + minute
}

/**
 * Order jobs for a route: by appointment start time, then by date, then by
 * name. Jobs without a parseable time sort after timed ones. Stable & pure.
 */
export function sortJobsForRoute<T extends Pick<AppJob, 'appointmentWindow' | 'date' | 'customerName'>>(jobs: T[]): T[] {
  return jobs
    .map((job, index) => ({ job, index, minutes: parseWindowStartMinutes(job.appointmentWindow) }))
    .sort((a, b) => {
      if (a.minutes !== b.minutes) {
        if (a.minutes === null) return 1
        if (b.minutes === null) return -1
        return a.minutes - b.minutes
      }
      if (a.job.date !== b.job.date) return a.job.date < b.job.date ? -1 : 1
      const byName = (a.job.customerName || '').localeCompare(b.job.customerName || '')
      if (byName !== 0) return byName
      return a.index - b.index
    })
    .map((entry) => entry.job)
}

/**
 * Build a Google Maps multi-stop directions URL from ordered stops. Each stop
 * is either "lat,lng" or a text address. The last stop is the destination; the
 * rest become waypoints. Returns null when there are no stops.
 */
export function buildRouteUrl(stops: string[]): string | null {
  const clean = stops.map((s) => s.trim()).filter(Boolean)
  if (clean.length === 0) return null
  const destination = clean[clean.length - 1]
  const waypoints = clean.slice(0, -1)
  const params = new URLSearchParams({ api: '1', destination })
  if (waypoints.length > 0) params.set('waypoints', waypoints.join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/** Build a single-destination directions URL (coords preferred, else address). */
export function buildDirectionsUrl(job: Pick<AppJob, 'latitude' | 'longitude' | 'address'>): string | null {
  if (typeof job.latitude === 'number' && typeof job.longitude === 'number') {
    return `https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`
  }
  if (job.address && job.address.trim()) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address.trim())}`
  }
  return null
}

/** A stop's "lat,lng" string when geocoded, else its text address, else null. */
export function routePointForJob(job: Pick<AppJob, 'latitude' | 'longitude' | 'address'>): string | null {
  if (typeof job.latitude === 'number' && typeof job.longitude === 'number') {
    return `${job.latitude},${job.longitude}`
  }
  return job.address?.trim() || null
}

/** Normalize a phone number into a tel: href, or null when unusable. */
export function telHref(phone: string | undefined | null): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/[^\d+]/g, '')
  return cleaned.length >= 7 ? `tel:${cleaned}` : null
}
