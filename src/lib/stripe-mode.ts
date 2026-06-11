/**
 * Stripe live/test mode guard (QA Round 5).
 *
 * Root cause of the "No such customer … exists in test mode" corruption:
 * QA/branch environments running TEST-mode Stripe keys share the production
 * database, so test-mode customer/subscription ids get written onto user rows
 * that production's LIVE key can't resolve — and test-mode webhook events can
 * silently rewrite live rows matched by `stripe_customer_id`.
 *
 * The guard has two halves:
 *  1. WRITE: every row that stores Stripe ids also stamps `stripe_livemode`
 *     (which mode created those ids), and the webhook drops events whose
 *     `event.livemode` doesn't match the running key's mode.
 *  2. READ: stored Stripe ids are ignored when their recorded mode doesn't
 *     match the running key's mode — treated as absent so flows re-resolve
 *     or recreate instead of erroring.
 */

export type StripeMode = 'live' | 'test'

/** Mode of the configured secret key. Defaults to 'test' when unset/malformed (fail-safe: never claims live). */
export function getStripeMode(): StripeMode {
  const key = process.env.STRIPE_SECRET_KEY || ''
  return key.startsWith('sk_live') || key.startsWith('rk_live') ? 'live' : 'test'
}

export function isLivemode(): boolean {
  return getStripeMode() === 'live'
}

/**
 * True when stored Stripe ids are usable under the current key:
 * either their mode was never recorded (legacy rows) or it matches.
 */
export function storedIdsMatchCurrentMode(storedLivemode: boolean | null | undefined): boolean {
  if (storedLivemode === null || storedLivemode === undefined) return true
  return storedLivemode === isLivemode()
}

interface UpdateResult {
  error: { code?: string; message?: string } | null
}

interface UpdatableClient {
  from(table: string): {
    update(payload: Record<string, unknown>): {
      eq(column: string, value: string): PromiseLike<UpdateResult> & {
        select(columns?: string): { single(): PromiseLike<{ data: unknown; error: UpdateResult['error'] }> }
      }
    }
  }
}

/**
 * Update dyia_users with a payload that includes `stripe_livemode`, retrying
 * without it if the column doesn't exist yet (migration 044 not applied).
 * Lets this code deploy safely ahead of the migration.
 */
export async function updateUserWithModeStamp(
  supabase: UpdatableClient,
  matchColumn: string,
  matchValue: string,
  payload: Record<string, unknown>
): Promise<UpdateResult['error']> {
  const stamped = { ...payload, stripe_livemode: isLivemode() }
  const { error } = await supabase.from('dyia_users').update(stamped).eq(matchColumn, matchValue)
  if (error && isMissingColumnError(error)) {
    const { error: retryError } = await supabase.from('dyia_users').update(payload).eq(matchColumn, matchValue)
    return retryError
  }
  return error
}

export function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  // PostgREST: PGRST204 = column not found in schema cache; 42703 = undefined column.
  return error.code === 'PGRST204' || error.code === '42703' || /stripe_livemode/.test(error.message || '')
}
