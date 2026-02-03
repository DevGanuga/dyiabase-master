/**
 * AI credits config – plug in pricing/caps when decided.
 * - PRO_MONTHLY_CREDITS_CAP: optional; if set, Pro users get this many credits per month
 *   (enforcement requires tracking Pro usage; see chat route).
 */

export function getProMonthlyCreditsCap(): number | null {
  const raw = process.env.PRO_MONTHLY_CREDITS_CAP
  if (raw === undefined || raw === '') return null
  const n = parseInt(raw, 10)
  return Number.isNaN(n) || n < 0 ? null : n
}
