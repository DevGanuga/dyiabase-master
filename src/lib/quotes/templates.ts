/**
 * Trade-agnostic helpers for turning a saved price template into quote line
 * items, plus sensible default categories per business vertical.
 *
 * The original product was junk-removal-only: templates stored fixed "load
 * tier" fields (minimumFee / quarterLoad / … / fullLoad) and a handful of junk
 * surcharges (trampoline / hot tub / piano). To support lawn care, cleaning,
 * and other verticals, templates now carry a generic `items[]` array of
 * user-defined `{ label, amount }` rows. When `items[]` is present we drive the
 * quote from it; otherwise we fall back to the legacy junk fields so existing
 * templates keep working unchanged.
 */

import type { AppPriceTemplate } from '@/types/database'

type Prices = AppPriceTemplate['prices']

export interface QuoteLineItem {
  id: string
  description: string
  amount: number
}

const LEGACY_VOLUME_FIELDS: { field: keyof Prices; label: string }[] = [
  { field: 'minimumFee', label: 'Minimum Fee' },
  { field: 'quarterLoad', label: '1/4 Load' },
  { field: 'halfLoad', label: '1/2 Load' },
  { field: 'threeQuarterLoad', label: '3/4 Load' },
  { field: 'fullLoad', label: 'Full Load' },
]

const LEGACY_SURCHARGE_LABELS: Record<string, string> = {
  trampoline: 'Trampoline Removal',
  hotTub: 'Hot Tub Removal',
  piano: 'Piano Removal',
}

/**
 * Convert a template's pricing into quote line items + a running total.
 * Prefers explicit user-defined `items[]`; falls back to the legacy
 * junk-removal load tiers + specialty surcharges for older templates.
 */
export function templateToLineItems(prices: Prices | undefined | null): { items: QuoteLineItem[]; total: number } {
  if (!prices) return { items: [], total: 0 }

  if (Array.isArray(prices.items) && prices.items.length > 0) {
    const items = prices.items
      .filter((it) => it && typeof it.label === 'string' && it.label.trim().length > 0)
      .map((it, i) => ({ id: `item-${i}`, description: it.label.trim(), amount: Math.max(0, Number(it.amount) || 0) }))
    const total = items.reduce((sum, it) => sum + it.amount, 0)
    return { items, total }
  }

  const items: QuoteLineItem[] = []
  let total = 0
  for (const { field, label } of LEGACY_VOLUME_FIELDS) {
    const val = Number(prices[field]) || 0
    if (val > 0) {
      items.push({ id: `vol-${String(field)}`, description: label, amount: val })
      total += val
    }
  }
  const surcharges = (prices.surcharges || {}) as Record<string, number | undefined>
  for (const [key, label] of Object.entries(LEGACY_SURCHARGE_LABELS)) {
    const val = Number(surcharges[key]) || 0
    if (val > 0) {
      items.push({ id: `spec-${key}`, description: label, amount: val })
      total += val
    }
  }
  return { items, total }
}

/**
 * Seed sensible starter line items for a brand-new template based on the
 * business vertical. Junk removal keeps its familiar load tiers; other trades
 * get category labels they can rename.
 */
export function defaultTemplateItems(businessType?: string | null): { label: string; amount: number }[] {
  switch (businessType) {
    case 'lawn_care':
      return [
        { label: 'Mowing (standard yard)', amount: 50 },
        { label: 'Edging & trimming', amount: 25 },
        { label: 'Leaf / debris cleanup', amount: 60 },
        { label: 'Hedge & shrub trimming', amount: 75 },
      ]
    case 'cleaning':
      return [
        { label: 'Standard clean', amount: 120 },
        { label: 'Deep clean', amount: 250 },
        { label: 'Move-out clean', amount: 300 },
        { label: 'Add-on: inside fridge / oven', amount: 40 },
      ]
    case 'moving':
      return [
        { label: 'Hourly rate (2 movers + truck)', amount: 120 },
        { label: 'Studio / 1-bedroom', amount: 350 },
        { label: '2-3 bedroom home', amount: 700 },
        { label: 'Packing materials', amount: 75 },
      ]
    case 'handyman':
      return [
        { label: 'Service call / minimum', amount: 90 },
        { label: 'Hourly labor', amount: 75 },
        { label: 'Half-day project', amount: 300 },
        { label: 'Materials (estimate)', amount: 50 },
      ]
    case 'junk_removal':
    default:
      return [
        { label: 'Minimum Fee', amount: 75 },
        { label: '1/4 Load', amount: 150 },
        { label: '1/2 Load', amount: 250 },
        { label: 'Full Load', amount: 450 },
      ]
  }
}

/** True when the vertical uses the legacy junk-removal load-tier calculator. */
export function usesLegacyJunkPricing(businessType?: string | null): boolean {
  return !businessType || businessType === 'junk_removal'
}
