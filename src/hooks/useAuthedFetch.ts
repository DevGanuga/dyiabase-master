'use client'

import { useAuth } from '@clerk/nextjs'
import { useCallback } from 'react'

/**
 * useAuthedFetch — single source of truth for calling internal `/api/*` routes
 * from client components.
 *
 * Why this exists:
 *   The dashboard previously rendered `AIInsights` / `DyiaInsight` on mount and
 *   immediately fired `fetch('/api/ai/insights')`. On mobile cold-opens, hard
 *   reloads, idle session renewals, or any case where the Clerk `__session`
 *   cookie wasn't fully attached to outgoing requests yet, the route handler's
 *   `auth()` returned `null` and 401'd. The UI then surfaced the raw
 *   "Unauthorized" string on the user's home screen.
 *
 *   This hook prevents that:
 *     1. `ready` is only true once Clerk's SDK is loaded AND a session exists.
 *        Components should bail out of their fetch effects until `ready` flips.
 *     2. `authedFetch` transparently retries a single 401 after forcing a token
 *        refresh via `getToken({ skipCache: true })`. That covers session
 *        renewals that race with the request.
 *     3. Callers get a discriminated outcome:
 *          - { ok: true, data } on success
 *          - { ok: false, kind: 'unauthenticated' } when even after refresh we
 *            don't have a session — caller should hide the feature, not show
 *            a scary error.
 *          - { ok: false, kind: 'error', status, message } for real failures.
 *
 *   Never expose `message` directly to end users. It is intended for logs /
 *   internal telemetry, not the UI.
 */

export interface AuthedFetchSuccess<T> {
  ok: true
  data: T
  status: number
}

export interface AuthedFetchUnauthenticated {
  ok: false
  kind: 'unauthenticated'
  status: 401
  message: string
}

export interface AuthedFetchError {
  ok: false
  kind: 'error'
  status: number
  message: string
}

export type AuthedFetchResult<T> =
  | AuthedFetchSuccess<T>
  | AuthedFetchUnauthenticated
  | AuthedFetchError

export interface UseAuthedFetchOptions {
  /** Default request timeout in ms. Caller can override per-request. */
  defaultTimeoutMs?: number
}

export interface AuthedFetchRequestInit extends Omit<RequestInit, 'signal'> {
  /** Per-request timeout. Overrides hook default. */
  timeoutMs?: number
  /** External AbortSignal to merge with the timeout signal. */
  signal?: AbortSignal
  /** When true, parses JSON body. Defaults to true. */
  parseJson?: boolean
}

const DEFAULT_TIMEOUT_MS = 15_000

export function useAuthedFetch(options: UseAuthedFetchOptions = {}) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS

  const ready = isLoaded && !!isSignedIn

  const authedFetch = useCallback(
    async <T = unknown>(
      input: string,
      init: AuthedFetchRequestInit = {}
    ): Promise<AuthedFetchResult<T>> => {
      const { timeoutMs, signal: externalSignal, parseJson = true, ...rest } = init

      const runRequest = async (): Promise<Response> => {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(
          () => controller.abort(),
          timeoutMs ?? defaultTimeoutMs
        )

        // Merge external signal with timeout signal so either can abort.
        const onExternalAbort = () => controller.abort()
        if (externalSignal) {
          if (externalSignal.aborted) controller.abort()
          else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
        }

        try {
          return await fetch(input, { ...rest, signal: controller.signal })
        } finally {
          window.clearTimeout(timeoutId)
          if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort)
        }
      }

      let response: Response
      try {
        response = await runRequest()
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === 'AbortError'
            ? 'Request was aborted'
            : err instanceof Error
              ? err.message
              : 'Network error'
        return { ok: false, kind: 'error', status: 0, message }
      }

      // Race-condition recovery: 401 on first attempt. Force a token refresh
      // through Clerk and retry exactly once. This handles the case where the
      // session cookie was renewing while the original request was in flight.
      if (response.status === 401) {
        try {
          await getToken({ skipCache: true })
        } catch {
          // Refresh failed — fall through to the unauthenticated result below.
        }

        try {
          response = await runRequest()
        } catch (err) {
          const message =
            err instanceof DOMException && err.name === 'AbortError'
              ? 'Request was aborted'
              : err instanceof Error
                ? err.message
                : 'Network error'
          return { ok: false, kind: 'error', status: 0, message }
        }

        if (response.status === 401) {
          return {
            ok: false,
            kind: 'unauthenticated',
            status: 401,
            message: 'Session not available',
          }
        }
      }

      const body = parseJson ? await response.json().catch(() => ({} as unknown)) : (undefined as unknown)

      if (!response.ok) {
        const message =
          (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string')
            ? (body as { error: string }).error
            : `Request failed (${response.status})`
        return { ok: false, kind: 'error', status: response.status, message }
      }

      return { ok: true, status: response.status, data: body as T }
    },
    [defaultTimeoutMs, getToken]
  )

  return { ready, isLoaded, isSignedIn: !!isSignedIn, authedFetch }
}
