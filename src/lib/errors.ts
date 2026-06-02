/**
 * Error message extraction for API routes.
 *
 * Why this exists: Supabase's `PostgrestError` is a plain object with a
 * `.message` field — it is NOT an instance of `Error`. Routes that did
 * `error instanceof Error ? error.message : 'Unknown error'` therefore threw
 * away the real database cause (FK/unique/check violations, RLS denials) and
 * surfaced a useless "Unknown error" to users — exactly the dead-end modal
 * merchants were hitting on the Payments screen.
 *
 * `getErrorMessage` reads a usable message from Errors, PostgrestErrors, Stripe
 * errors, and bare strings, so the real cause is preserved for the caller.
 *
 * NOTE: the returned string may contain internal detail (constraint names,
 * Stripe codes). It is appropriate for: (a) server logs, and (b) authenticated
 * first-party app surfaces where the operator/merchant benefits from the real
 * reason. Do NOT leak it on unauthenticated/public pages — use a generic
 * message there.
 */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err == null) return fallback

  if (typeof err === 'string') {
    return err.trim() || fallback
  }

  if (err instanceof Error) {
    return err.message || fallback
  }

  // PostgrestError / StripeError / any object exposing a string `message`.
  if (typeof err === 'object') {
    const obj = err as { message?: unknown; error_description?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const candidate =
      (typeof obj.message === 'string' && obj.message) ||
      (typeof obj.error_description === 'string' && obj.error_description) ||
      (typeof obj.details === 'string' && obj.details) ||
      (typeof obj.hint === 'string' && obj.hint)
    if (candidate) {
      // Append a Postgres error code when present — invaluable for triage
      // (e.g. 23505 = unique violation, 23503 = FK violation, 42501 = RLS).
      return typeof obj.code === 'string' && obj.code
        ? `${candidate} (${obj.code})`
        : candidate
    }
  }

  return fallback
}
