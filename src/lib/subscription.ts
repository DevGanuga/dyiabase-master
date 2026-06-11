/**
 * Single source of truth for subscription state.
 *
 * Round 4 (BUG-022): the app previously computed `isPro` in three different
 * places (`app/page.tsx`, `useSubscription` hook, `Settings.tsx`) that read
 * slightly different fields. A user with `subscription_tier='basic'` and
 * `subscription_status='active'` could be labeled Basic in one component and
 * unlocked as Pro in another. This module centralizes the logic so every
 * gate, banner, and badge agrees.
 *
 * It also implements the 7-day dunning grace window: when Stripe reports
 * `invoice.payment_failed`, the webhook stamps `payment_failed_at` and the
 * subscription enters `past_due`. We keep Pro features unlocked for the
 * grace window so a transient bank decline doesn't lock a paying customer
 * out, but show a banner counting down. After the window expires, Pro
 * features lock until payment recovers (`invoice.paid` clears the stamp).
 */

export const DUNNING_GRACE_DAYS = 7
const DAY_MS = 86_400_000

export type SubscriptionStatus =
  | 'active'
  | 'inactive'
  | 'canceled'
  | 'past_due'
  | 'trialing'

export type UiTier = 'basic' | 'trial' | 'pro'
export type ProductTier = 'basic' | 'pro'

/** Loose row shape compatible with both the `dyia_users` table row and `UserProfile`. */
export interface SubscriptionInputRow {
  subscription_status?: string | null
  subscription_tier?: string | null
  subscription_plan?: string | null
  subscription_ends_at?: string | null
  cancel_at_period_end?: boolean | null
  trial_consumed_at?: string | null
  payment_failed_at?: string | null
  ai_credits_balance?: number | null
  is_admin?: boolean | null
  role?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
}

export interface SubscriptionState {
  /** UI-facing label tier — combines product tier with trial state. */
  tier: UiTier
  /** What the user actually pays for. Defaults to 'basic' when unknown for safety. */
  planTier: ProductTier
  /** Distinct from planTier: null means "never had any subscription on file" (used to show FREE badge once). */
  productTier: ProductTier | null
  status: SubscriptionStatus | null
  plan: 'monthly' | 'annual' | null
  daysRemaining: number
  /** True if user currently has Pro feature access (active/trialing/canceled-with-time/in-grace). */
  isPro: boolean
  isAdmin: boolean
  isCanceled: boolean
  /** True when the user scheduled a downgrade to Basic (Stripe cancel_at_period_end) but still has Pro until subscription_ends_at. */
  cancelScheduled: boolean
  /** True when subscription is past_due AND we are still inside the 7-day grace window. */
  isInDunning: boolean
  /** Days remaining in dunning grace window (0 if not in dunning). */
  dunningGraceDaysLeft: number
  /** True when the user has actually lost Pro access due to the dunning window expiring. */
  dunningExpired: boolean
  trialExpired: boolean
  trialConsumed: boolean
  aiCredits: number
  canUseAI: boolean
  hasStripeHistory: boolean
}

const TRIAL_STATUSES: SubscriptionStatus[] = ['trialing']
const PRO_STATUSES: SubscriptionStatus[] = ['active', 'trialing']

function asStatus(s: string | null | undefined): SubscriptionStatus | null {
  if (s === 'active' || s === 'inactive' || s === 'canceled' || s === 'past_due' || s === 'trialing') {
    return s
  }
  return null
}

/**
 * Compute the canonical subscription state from any row that has the
 * relevant columns. Pure function — safe to call client- or server-side.
 */
export function computeSubscriptionState(row: SubscriptionInputRow | null | undefined): SubscriptionState {
  const isAdmin = !!row?.is_admin || ['admin', 'super_admin'].includes(row?.role || '')
  const rawStatus = asStatus(row?.subscription_status)
  const plan = (row?.subscription_plan || null) as 'monthly' | 'annual' | null
  const endsAt = row?.subscription_ends_at ? new Date(row.subscription_ends_at) : null
  const now = Date.now()
  const daysRemaining = endsAt
    ? Math.max(0, Math.ceil((endsAt.getTime() - now) / DAY_MS))
    : 0

  const hasTimeLeft = endsAt !== null && endsAt.getTime() > now
  const isCanceled = rawStatus === 'canceled'
  const hasStripeSubscription = !!row?.subscription_plan || !!row?.stripe_subscription_id

  // Effective status: collapse expired-trial / expired-cancellation into 'inactive'
  let effectiveStatus: SubscriptionStatus | null = rawStatus
  if (rawStatus === 'trialing' && endsAt && !hasTimeLeft && !hasStripeSubscription) {
    effectiveStatus = 'inactive'
  }
  // QA Round 5 (+102): an expired trial WITH a Stripe subscription on file
  // previously kept 'trialing' forever, granting indefinite Pro access when
  // the trial→active webhook never landed (misconfigured/wrong-mode webhook).
  // Normally Stripe flips the row to 'active' (payment) or 'past_due'/
  // 'canceled' (failure) at trial end; if the row still says 'trialing' well
  // past its end date, the webhook didn't arrive — fail closed. The 1-day
  // buffer absorbs ordinary webhook/retry lag so real conversions never blip.
  if (rawStatus === 'trialing' && endsAt && hasStripeSubscription && now > endsAt.getTime() + DAY_MS) {
    effectiveStatus = 'inactive'
  }
  if (isCanceled && !hasTimeLeft) {
    effectiveStatus = 'inactive'
  }

  // Dunning grace window: past_due users keep access for DUNNING_GRACE_DAYS
  // after `payment_failed_at`. After that, Pro locks.
  const paymentFailedAt = row?.payment_failed_at ? new Date(row.payment_failed_at) : null
  const dunningStartedMs = paymentFailedAt?.getTime() ?? null
  const dunningEndsMs = dunningStartedMs !== null ? dunningStartedMs + DUNNING_GRACE_DAYS * DAY_MS : null
  const isPastDue = rawStatus === 'past_due'
  const isInDunning =
    isPastDue &&
    dunningEndsMs !== null &&
    dunningEndsMs > now
  const dunningGraceDaysLeft = isInDunning && dunningEndsMs !== null
    ? Math.max(0, Math.ceil((dunningEndsMs - now) / DAY_MS))
    : 0
  const dunningExpired = isPastDue && (!dunningEndsMs || dunningEndsMs <= now)

  // Product tier: distinguish "never subscribed" (null → FREE badge) from
  // "registered Basic" and "registered Pro". Admin always reads as 'pro'.
  // (Computed early so the access logic below can depend on it.)
  const rawTier = row?.subscription_tier
  const productTier: ProductTier | null =
    isAdmin ? 'pro'
    : rawTier === 'pro' ? 'pro'
    : rawTier === 'basic' ? 'basic'
    : null
  const planTier: ProductTier = productTier ?? 'basic'

  // Pro access requires both:
  //   1. an active/grace state (active / trialing / canceled-with-time / dunning), AND
  //   2. the user to be on the Pro tier (or in a trial — every trial gets a
  //      Pro preview regardless of which plan they signed up for).
  //
  // Active Basic users get Basic features only — `isPro` is FALSE for them
  // so AI insights, marketing tools, email blasts, etc. correctly upsell.
  const isTrialing = TRIAL_STATUSES.includes(effectiveStatus as SubscriptionStatus)
  const isActive = effectiveStatus === 'active'
  // A downgrade is "scheduled" when Stripe's cancel_at_period_end is set AND the
  // subscription is still live (active/trialing). Once it actually lapses, the
  // status flips to canceled/inactive and the downgrade has already happened.
  const cancelScheduled = !!row?.cancel_at_period_end && (isActive || isTrialing)
  const hasAccess =
    isAdmin ||
    isTrialing ||
    (isActive && planTier === 'pro') ||
    (isCanceled && hasTimeLeft && planTier === 'pro') ||
    (isInDunning && planTier === 'pro')

  const trialExpired =
    !hasAccess &&
    (rawStatus === 'inactive' ||
      (isCanceled && !hasTimeLeft) ||
      (rawStatus === 'trialing' && !hasTimeLeft))

  // UI tier: trial overrides everything; canceled-with-time renders as trial
  // (matches existing TrialBanner countdown behavior).
  const tier: UiTier =
    isAdmin ? 'pro'
    : (isCanceled && hasTimeLeft) ? 'trial'
    : TRIAL_STATUSES.includes(effectiveStatus as SubscriptionStatus) ? 'trial'
    : (PRO_STATUSES.includes(effectiveStatus as SubscriptionStatus) || isInDunning) ? planTier
    : 'basic'

  const aiCredits = row?.ai_credits_balance || 0
  const canUseAI = hasAccess || aiCredits > 0
  const trialConsumed = !!row?.trial_consumed_at
  const hasStripeHistory =
    !!row?.stripe_customer_id ||
    !!row?.stripe_subscription_id ||
    !!plan ||
    trialConsumed ||
    (rawStatus !== null && rawStatus !== 'inactive')

  return {
    tier,
    planTier,
    productTier,
    status: effectiveStatus,
    plan,
    daysRemaining,
    isPro: hasAccess,
    isAdmin,
    isCanceled,
    cancelScheduled,
    isInDunning,
    dunningGraceDaysLeft,
    dunningExpired,
    trialExpired,
    trialConsumed,
    aiCredits,
    canUseAI,
    hasStripeHistory,
  }
}

/**
 * Convenience: returns just the access boolean. Use this in API routes where
 * you only need a yes/no for feature gating.
 */
export function userHasProAccess(row: SubscriptionInputRow | null | undefined): boolean {
  return computeSubscriptionState(row).isPro
}
