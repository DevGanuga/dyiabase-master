import { NextRequest, NextResponse } from 'next/server'

/**
 * Simple in-memory rate limiter for Vercel serverless functions.
 *
 * Note: In-memory state is NOT shared across serverless instances, so this
 * provides "best effort" rate limiting. For strict limits across all instances,
 * use a shared store like Upstash Redis (@upstash/ratelimit).
 *
 * Each limiter tracks requests per IP within a sliding time window.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const stores = new Map<string, Map<string, RateLimitEntry>>()

interface RateLimitConfig {
  /** Unique identifier for this limiter (e.g. 'ai-chat', 'checkout') */
  id: string
  /** Maximum requests allowed within the window */
  maxRequests: number
  /** Time window in seconds */
  windowSeconds: number
}

/**
 * Create a rate limiter with the given configuration.
 * Returns a function that checks if a request should be rate-limited.
 */
export function createRateLimiter(config: RateLimitConfig) {
  if (!stores.has(config.id)) {
    stores.set(config.id, new Map())
  }

  return {
    /**
     * Check if the request is rate-limited.
     * Returns null if allowed, or a NextResponse with 429 status if rate-limited.
     */
    check(req: NextRequest): NextResponse | null {
      const store = stores.get(config.id)!
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
        || 'unknown'

      const now = Date.now()
      const entry = store.get(ip)

      // Clean up expired entries periodically (every 100 checks)
      if (Math.random() < 0.01) {
        for (const [key, val] of store) {
          if (val.resetAt < now) store.delete(key)
        }
      }

      if (!entry || entry.resetAt < now) {
        // New window
        store.set(ip, { count: 1, resetAt: now + config.windowSeconds * 1000 })
        return null
      }

      if (entry.count >= config.maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Limit': String(config.maxRequests),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
            },
          }
        )
      }

      entry.count++
      return null
    },
  }
}

// Pre-configured limiters for common routes
export const rateLimiters = {
  /** AI chat: 30 requests per minute per IP */
  aiChat: createRateLimiter({ id: 'ai-chat', maxRequests: 30, windowSeconds: 60 }),
  /** Stripe checkout: 10 requests per minute per IP */
  checkout: createRateLimiter({ id: 'checkout', maxRequests: 10, windowSeconds: 60 }),
  /** Demo activation: 5 attempts per 15 minutes per IP */
  demoActivate: createRateLimiter({ id: 'demo-activate', maxRequests: 5, windowSeconds: 900 }),
  /** General API: 120 requests per minute per IP */
  general: createRateLimiter({ id: 'general', maxRequests: 120, windowSeconds: 60 }),
}
