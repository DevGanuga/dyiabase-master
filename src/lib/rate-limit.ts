import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Rate limiter with Upstash Redis for production (shared across serverless instances)
 * and an in-memory fallback for local development.
 *
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your environment
 * to enable distributed rate limiting.
 */

const isRedisConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN

// ─── In-memory fallback (local dev only) ────────────────────────────────────

interface RateLimitEntry {
  count: number
  resetAt: number
}

const memoryStores = new Map<string, Map<string, RateLimitEntry>>()

function createMemoryLimiter(id: string, maxRequests: number, windowSeconds: number) {
  if (!memoryStores.has(id)) {
    memoryStores.set(id, new Map())
  }
  return {
    check(req: NextRequest): NextResponse | null {
      const store = memoryStores.get(id)!
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown'

      const now = Date.now()
      const entry = store.get(ip)

      if (Math.random() < 0.01) {
        for (const [key, val] of store) {
          if (val.resetAt < now) store.delete(key)
        }
      }

      if (!entry || entry.resetAt < now) {
        store.set(ip, { count: 1, resetAt: now + windowSeconds * 1000 })
        return null
      }

      if (entry.count >= maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Limit': String(maxRequests),
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

// ─── Upstash Redis limiter (production) ─────────────────────────────────────

function createUpstashLimiter(prefix: string, maxRequests: number, windowSeconds: number) {
  const redis = Redis.fromEnv()
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
    prefix: `dyia:ratelimit:${prefix}`,
    analytics: true,
  })

  return {
    async checkAsync(req: NextRequest): Promise<NextResponse | null> {
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown'

      const { success, limit, remaining, reset } = await ratelimit.limit(ip)

      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000)
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.max(retryAfter, 1)),
              'X-RateLimit-Limit': String(limit),
              'X-RateLimit-Remaining': String(remaining),
              'X-RateLimit-Reset': String(Math.ceil(reset / 1000)),
            },
          }
        )
      }

      return null
    },
  }
}

// ─── Unified interface ──────────────────────────────────────────────────────

interface RateLimiterConfig {
  id: string
  maxRequests: number
  windowSeconds: number
}

function createRateLimiter(config: RateLimiterConfig) {
  const memory = createMemoryLimiter(config.id, config.maxRequests, config.windowSeconds)
  const upstash = isRedisConfigured
    ? createUpstashLimiter(config.id, config.maxRequests, config.windowSeconds)
    : null

  return {
    /**
     * Synchronous check — uses in-memory store only.
     * Use `checkAsync` in production routes for distributed limiting.
     */
    check(req: NextRequest): NextResponse | null {
      return memory.check(req)
    },

    /**
     * Async check — uses Upstash Redis when configured, falls back to in-memory.
     */
    async checkAsync(req: NextRequest): Promise<NextResponse | null> {
      if (upstash) {
        return upstash.checkAsync(req)
      }
      return memory.check(req)
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

export { createRateLimiter }
