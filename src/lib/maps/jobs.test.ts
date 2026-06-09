import { describe, it, expect } from 'vitest'
import type { AppJob } from '@/types/database'
import {
  pinKindForJob,
  jobHasCoords,
  isEstimateJob,
  computeDateRange,
  filterJobsForMap,
  parseWindowStartMinutes,
  sortJobsForRoute,
  buildRouteUrl,
  buildDirectionsUrl,
  routePointForJob,
  telHref,
  toDateInput,
} from './jobs'

// Minimal AppJob factory for tests.
function job(overrides: Partial<AppJob>): AppJob {
  return {
    id: 'j', date: '2026-06-08', customerName: 'Test', revenue: 0,
    labor: 0, gas: 0, dumpFee: 0, dumpsterRental: 0, additionalExpense: 0,
    numWorkers: 1, costPerWorker: 0,
    ...overrides,
  }
}

describe('pinKindForJob', () => {
  it('cancelled wins over everything', () => {
    expect(pinKindForJob({ status: 'cancelled', scheduledKind: 'estimate' })).toBe('cancelled')
  })
  it('estimate kinds map to estimate', () => {
    expect(pinKindForJob({ status: 'scheduled', scheduledKind: 'estimate' })).toBe('estimate')
    expect(pinKindForJob({ status: 'scheduled', scheduledKind: 'free_estimate' })).toBe('estimate')
  })
  it('completed jobs are green', () => {
    expect(pinKindForJob({ status: 'completed', scheduledKind: 'job' })).toBe('completed')
  })
  it('defaults to scheduled', () => {
    expect(pinKindForJob({ status: 'scheduled', scheduledKind: 'job' })).toBe('scheduled')
    expect(pinKindForJob({})).toBe('scheduled')
  })
})

describe('jobHasCoords', () => {
  it('requires both finite numbers', () => {
    expect(jobHasCoords(job({ latitude: 30, longitude: -97 }))).toBe(true)
    expect(jobHasCoords(job({ latitude: 30 }))).toBe(false)
    expect(jobHasCoords(job({ latitude: null, longitude: null }))).toBe(false)
    expect(jobHasCoords(job({ latitude: NaN, longitude: -97 }))).toBe(false)
  })
})

describe('isEstimateJob', () => {
  it('detects both estimate kinds', () => {
    expect(isEstimateJob({ scheduledKind: 'estimate' })).toBe(true)
    expect(isEstimateJob({ scheduledKind: 'free_estimate' })).toBe(true)
    expect(isEstimateJob({ scheduledKind: 'job' })).toBe(false)
  })
})

describe('computeDateRange', () => {
  it('today returns the same day for start and end', () => {
    expect(computeDateRange('today', '2026-06-08', '', '')).toEqual({ start: '2026-06-08', end: '2026-06-08' })
  })
  it('week returns the Mon–Sun week containing today (Mon 2026-06-08)', () => {
    // 2026-06-08 is a Monday.
    expect(computeDateRange('week', '2026-06-08', '', '')).toEqual({ start: '2026-06-08', end: '2026-06-14' })
  })
  it('week handles a Sunday correctly (2026-06-14 -> prior Monday)', () => {
    expect(computeDateRange('week', '2026-06-14', '', '')).toEqual({ start: '2026-06-08', end: '2026-06-14' })
  })
  it('custom passes through and tolerates reversed bounds', () => {
    expect(computeDateRange('custom', '2026-06-08', '2026-06-01', '2026-06-30')).toEqual({ start: '2026-06-01', end: '2026-06-30' })
    expect(computeDateRange('custom', '2026-06-08', '2026-06-30', '2026-06-01')).toEqual({ start: '2026-06-01', end: '2026-06-30' })
  })
})

describe('filterJobsForMap', () => {
  const jobs = [
    job({ id: 'a', date: '2026-06-08', scheduledKind: 'job' }),
    job({ id: 'b', date: '2026-06-09', scheduledKind: 'estimate' }),
    job({ id: 'c', date: '2026-06-20', scheduledKind: 'job' }),
  ]
  it('filters by inclusive date range', () => {
    const out = filterJobsForMap(jobs, { start: '2026-06-08', end: '2026-06-09' }, true, true)
    expect(out.map(j => j.id)).toEqual(['a', 'b'])
  })
  it('hides estimates when showEstimates is false', () => {
    const out = filterJobsForMap(jobs, { start: '2026-06-01', end: '2026-06-30' }, true, false)
    expect(out.map(j => j.id)).toEqual(['a', 'c'])
  })
  it('hides jobs when showJobs is false', () => {
    const out = filterJobsForMap(jobs, { start: '2026-06-01', end: '2026-06-30' }, false, true)
    expect(out.map(j => j.id)).toEqual(['b'])
  })
})

describe('parseWindowStartMinutes', () => {
  it('parses am window', () => {
    expect(parseWindowStartMinutes('8:00-10:00am')).toBe(8 * 60)
  })
  it('parses pm window', () => {
    expect(parseWindowStartMinutes('2:00-4:00pm')).toBe(14 * 60)
  })
  it('keeps explicit am on the start token', () => {
    expect(parseWindowStartMinutes('11:00am-12:00pm')).toBe(11 * 60)
  })
  it('handles 12 am/pm edge cases', () => {
    expect(parseWindowStartMinutes('12:00am')).toBe(0)
    expect(parseWindowStartMinutes('12:30pm')).toBe(12 * 60 + 30)
  })
  it('returns null when no time present', () => {
    expect(parseWindowStartMinutes('anytime')).toBeNull()
    expect(parseWindowStartMinutes('')).toBeNull()
    expect(parseWindowStartMinutes(undefined)).toBeNull()
  })
})

describe('sortJobsForRoute', () => {
  it('orders chronologically and pushes untimed stops to the end (not lexicographically)', () => {
    const jobs = [
      job({ id: 'late', appointmentWindow: '2:00-4:00pm' }),
      job({ id: 'none', appointmentWindow: undefined }),
      job({ id: 'early', appointmentWindow: '8:00-10:00am' }),
      job({ id: 'mid', appointmentWindow: '11:00am-12:00pm' }),
    ]
    expect(sortJobsForRoute(jobs).map(j => j.id)).toEqual(['early', 'mid', 'late', 'none'])
  })
})

describe('buildRouteUrl', () => {
  it('returns null for no stops', () => {
    expect(buildRouteUrl([])).toBeNull()
  })
  it('single stop is the destination, no waypoints', () => {
    const url = buildRouteUrl(['30.1,-97.7'])
    expect(url).toContain('destination=30.1%2C-97.7')
    expect(url).not.toContain('waypoints')
  })
  it('multiple stops: last is destination, rest are waypoints', () => {
    const url = buildRouteUrl(['a', 'b', 'c'])!
    expect(url).toContain('destination=c')
    expect(url).toContain('waypoints=a%7Cb')
  })
})

describe('buildDirectionsUrl', () => {
  it('prefers coordinates', () => {
    expect(buildDirectionsUrl({ latitude: 30.1, longitude: -97.7, address: '1 Main' }))
      .toBe('https://www.google.com/maps/dir/?api=1&destination=30.1,-97.7')
  })
  it('falls back to address', () => {
    expect(buildDirectionsUrl({ latitude: null, longitude: null, address: '1 Main St' }))
      .toContain('destination=1%20Main%20St')
  })
  it('returns null with neither', () => {
    expect(buildDirectionsUrl({ latitude: null, longitude: null, address: undefined })).toBeNull()
  })
})

describe('routePointForJob', () => {
  it('returns coords string when present', () => {
    expect(routePointForJob({ latitude: 30, longitude: -97, address: 'x' })).toBe('30,-97')
  })
  it('falls back to address', () => {
    expect(routePointForJob({ latitude: null, longitude: null, address: ' 1 Main ' })).toBe('1 Main')
  })
  it('null when nothing usable', () => {
    expect(routePointForJob({ latitude: null, longitude: null, address: '' })).toBeNull()
  })
})

describe('telHref', () => {
  it('strips formatting', () => {
    expect(telHref('(555) 123-4567')).toBe('tel:5551234567')
  })
  it('keeps a leading +', () => {
    expect(telHref('+1 555 123 4567')).toBe('tel:+15551234567')
  })
  it('rejects too-short / empty', () => {
    expect(telHref('123')).toBeNull()
    expect(telHref('')).toBeNull()
    expect(telHref(null)).toBeNull()
  })
})

describe('toDateInput', () => {
  it('formats local calendar fields zero-padded', () => {
    expect(toDateInput(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
