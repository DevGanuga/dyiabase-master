import { describe, it, expect } from 'vitest'
import { computeSubscriptionState, DUNNING_GRACE_DAYS } from './subscription'

const DAY_MS = 86_400_000
const daysFromNow = (d: number) => new Date(Date.now() + d * DAY_MS).toISOString()

describe('computeSubscriptionState — QA Round 5 matrix', () => {
  it('never-subscribed user: FREE badge, no Pro access', () => {
    const s = computeSubscriptionState({})
    expect(s.productTier).toBeNull()
    expect(s.isPro).toBe(false)
    expect(s.tier).toBe('basic')
  })

  it('active Pro monthly: full access', () => {
    const s = computeSubscriptionState({
      subscription_status: 'active',
      subscription_tier: 'pro',
      subscription_plan: 'monthly',
      stripe_subscription_id: 'sub_x',
      subscription_ends_at: daysFromNow(20),
    })
    expect(s.isPro).toBe(true)
    expect(s.tier).toBe('pro')
  })

  it('active Basic: NO Pro access (upsell stays)', () => {
    const s = computeSubscriptionState({
      subscription_status: 'active',
      subscription_tier: 'basic',
      subscription_plan: 'monthly',
      stripe_subscription_id: 'sub_x',
      subscription_ends_at: daysFromNow(20),
    })
    expect(s.isPro).toBe(false)
    expect(s.tier).toBe('basic')
    expect(s.productTier).toBe('basic')
  })

  it('live trial: Pro preview access', () => {
    const s = computeSubscriptionState({
      subscription_status: 'trialing',
      subscription_tier: 'pro',
      subscription_plan: 'monthly',
      stripe_subscription_id: 'sub_x',
      subscription_ends_at: daysFromNow(7),
    })
    expect(s.isPro).toBe(true)
    expect(s.tier).toBe('trial')
  })

  it('+102 regression: expired trial WITH subscription on file must NOT keep Pro forever', () => {
    // QA: trial ended Apr 24, no payment ever happened (webhook never landed),
    // user still had Pro on Jun 10. Fail closed once well past trial end.
    const s = computeSubscriptionState({
      subscription_status: 'trialing',
      subscription_tier: 'pro',
      subscription_plan: 'annual',
      stripe_subscription_id: 'sub_x',
      subscription_ends_at: daysFromNow(-30),
    })
    expect(s.isPro).toBe(false)
    expect(s.status).toBe('inactive')
    expect(s.tier).toBe('basic')
    expect(s.trialExpired).toBe(true)
  })

  it('expired trial within the 1-day webhook-lag buffer keeps access (no blip on real conversions)', () => {
    const s = computeSubscriptionState({
      subscription_status: 'trialing',
      subscription_tier: 'pro',
      subscription_plan: 'monthly',
      stripe_subscription_id: 'sub_x',
      subscription_ends_at: new Date(Date.now() - 2 * 3600_000).toISOString(), // 2h past
    })
    expect(s.isPro).toBe(true)
  })

  it('expired trial WITHOUT subscription on file collapses immediately', () => {
    const s = computeSubscriptionState({
      subscription_status: 'trialing',
      subscription_tier: 'pro',
      subscription_ends_at: daysFromNow(-1),
    })
    expect(s.isPro).toBe(false)
    expect(s.status).toBe('inactive')
  })

  it('+100 dunning: past_due Pro inside the grace window keeps access with countdown', () => {
    const s = computeSubscriptionState({
      subscription_status: 'past_due',
      subscription_tier: 'pro',
      subscription_plan: 'monthly',
      stripe_subscription_id: 'sub_x',
      payment_failed_at: daysFromNow(-3),
      subscription_ends_at: daysFromNow(10),
    })
    expect(s.isInDunning).toBe(true)
    expect(s.isPro).toBe(true)
    expect(s.dunningGraceDaysLeft).toBeGreaterThan(0)
    expect(s.dunningGraceDaysLeft).toBeLessThanOrEqual(DUNNING_GRACE_DAYS)
  })

  it('+100 post-grace: past_due Pro after the window loses access', () => {
    const s = computeSubscriptionState({
      subscription_status: 'past_due',
      subscription_tier: 'pro',
      subscription_plan: 'monthly',
      stripe_subscription_id: 'sub_x',
      payment_failed_at: daysFromNow(-(DUNNING_GRACE_DAYS + 2)),
      subscription_ends_at: daysFromNow(10),
    })
    expect(s.isInDunning).toBe(false)
    expect(s.dunningExpired).toBe(true)
    expect(s.isPro).toBe(false)
  })

  it('+106 canceled-with-time-left: keeps Pro until the period ends', () => {
    const s = computeSubscriptionState({
      subscription_status: 'canceled',
      subscription_tier: 'pro',
      subscription_plan: 'monthly',
      stripe_subscription_id: 'sub_x',
      subscription_ends_at: daysFromNow(5),
    })
    expect(s.isPro).toBe(true)
    expect(s.tier).toBe('trial') // renders as countdown
    expect(s.daysRemaining).toBe(5)
  })

  it('canceled and lapsed: no access, basic experience', () => {
    const s = computeSubscriptionState({
      subscription_status: 'canceled',
      subscription_tier: 'pro',
      subscription_plan: 'monthly',
      subscription_ends_at: daysFromNow(-2),
    })
    expect(s.isPro).toBe(false)
    expect(s.status).toBe('inactive')
    expect(s.tier).toBe('basic')
    // Registered plan is still visible for the Settings badge (PRO + INACTIVE chip)
    expect(s.productTier).toBe('pro')
  })

  it('scheduled downgrade (cancel_at_period_end on a live sub): cancelScheduled true, access kept', () => {
    const s = computeSubscriptionState({
      subscription_status: 'active',
      subscription_tier: 'pro',
      subscription_plan: 'monthly',
      stripe_subscription_id: 'sub_x',
      cancel_at_period_end: true,
      subscription_ends_at: daysFromNow(12),
    })
    expect(s.cancelScheduled).toBe(true)
    expect(s.isPro).toBe(true)
  })

  it('admin: always Pro, regardless of stored state', () => {
    const s = computeSubscriptionState({ role: 'super_admin', subscription_status: 'inactive' })
    expect(s.isPro).toBe(true)
    expect(s.isAdmin).toBe(true)
    expect(s.tier).toBe('pro')
  })

  it('AI credits grant canUseAI without Pro', () => {
    const s = computeSubscriptionState({ ai_credits_balance: 50 })
    expect(s.isPro).toBe(false)
    expect(s.canUseAI).toBe(true)
  })
})
