import { describe, it, expect, afterEach } from 'vitest'
import { getStripeMode, isLivemode, storedIdsMatchCurrentMode, isMissingColumnError } from './stripe-mode'

const ORIGINAL_KEY = process.env.STRIPE_SECRET_KEY

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.STRIPE_SECRET_KEY
  else process.env.STRIPE_SECRET_KEY = ORIGINAL_KEY
})

describe('getStripeMode', () => {
  it('detects live keys', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_abc'
    expect(getStripeMode()).toBe('live')
    process.env.STRIPE_SECRET_KEY = 'rk_live_abc'
    expect(getStripeMode()).toBe('live')
  })
  it('detects test keys', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc'
    expect(getStripeMode()).toBe('test')
  })
  it('fails safe to test on missing/malformed key (never claims live)', () => {
    delete process.env.STRIPE_SECRET_KEY
    expect(getStripeMode()).toBe('test')
    process.env.STRIPE_SECRET_KEY = 'whsec_oops'
    expect(getStripeMode()).toBe('test')
  })
})

describe('storedIdsMatchCurrentMode', () => {
  it('legacy rows (null/undefined) always match', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_abc'
    expect(storedIdsMatchCurrentMode(null)).toBe(true)
    expect(storedIdsMatchCurrentMode(undefined)).toBe(true)
  })
  it('matching mode passes, mismatched mode fails', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_abc'
    expect(storedIdsMatchCurrentMode(true)).toBe(true)
    expect(storedIdsMatchCurrentMode(false)).toBe(false)
    expect(isLivemode()).toBe(true)
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc'
    expect(storedIdsMatchCurrentMode(false)).toBe(true)
    expect(storedIdsMatchCurrentMode(true)).toBe(false)
  })
})

describe('isMissingColumnError', () => {
  it('recognizes PostgREST missing-column codes', () => {
    expect(isMissingColumnError({ code: 'PGRST204', message: 'x' })).toBe(true)
    expect(isMissingColumnError({ code: '42703', message: 'x' })).toBe(true)
    expect(isMissingColumnError({ message: "Could not find the 'stripe_livemode' column" })).toBe(true)
  })
  it('passes through other errors', () => {
    expect(isMissingColumnError({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(isMissingColumnError(null)).toBe(false)
  })
})
