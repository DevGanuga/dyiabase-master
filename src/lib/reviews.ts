import type { AppQuote } from '@/types/database'

export interface ReviewUrls {
  reviewUrl?: string | null
  reviewUrlGoogle?: string | null
  reviewUrlYelp?: string | null
  reviewUrlFacebook?: string | null
}

/**
 * Picks the review page URL for the given platform (Google, Yelp, Facebook).
 * Falls back to generic reviewUrl if platform-specific URL is missing.
 */
function getReviewUrlForPlatform(platform: string, urls: ReviewUrls): string | null {
  const p = (platform || '').toLowerCase()
  const link =
    (p === 'google' && urls.reviewUrlGoogle?.trim()) ||
    (p === 'yelp' && urls.reviewUrlYelp?.trim()) ||
    (p === 'facebook' && urls.reviewUrlFacebook?.trim()) ||
    urls.reviewUrl?.trim() ||
    null
  return link || null
}

/**
 * Builds a copy-paste review request message.
 * Use for completed quotes or jobs. Pass customer name (or quote for name + fallback) and platform + URLs.
 * When no URL is set, returns message without a link so UI can still offer copy.
 */
export function getReviewRequestMessage(
  quoteOrCustomerName: Pick<AppQuote, 'customer'> | string,
  reviewUrlOrUrls: string | null | ReviewUrls,
  platform?: string
): string {
  const name = typeof quoteOrCustomerName === 'string'
    ? quoteOrCustomerName.trim() || 'there'
    : (quoteOrCustomerName.customer?.name?.trim() || 'there')
  const urls = typeof reviewUrlOrUrls === 'string' || reviewUrlOrUrls == null
    ? { reviewUrl: reviewUrlOrUrls }
    : reviewUrlOrUrls
  const link = platform ? getReviewUrlForPlatform(platform, urls) : (urls.reviewUrl?.trim() || null)
  if (link) {
    return `Hi ${name}, thanks for your business! If you have a moment, we'd really appreciate a review: ${link}`
  }
  return `Hi ${name}, thanks for your business! If you have a moment, we'd really appreciate a review.`
}
