import type { AppQuote } from '@/types/database'

/**
 * Builds a copy-paste review request message for a completed quote.
 * Use in Quotes UI for status === 'completed' with a "Copy" button.
 * When reviewUrl is empty, returns a message without a link so UI can still offer copy.
 */
export function getReviewRequestMessage(quote: Pick<AppQuote, 'customer'>, reviewUrl: string | null): string {
  const name = quote.customer?.name?.trim() || 'there'
  const link = reviewUrl?.trim()
  if (link) {
    return `Hi ${name}, thanks for your business! If you have a moment, we'd really appreciate a review: ${link}`
  }
  return `Hi ${name}, thanks for your business! If you have a moment, we'd really appreciate a review.`
}
