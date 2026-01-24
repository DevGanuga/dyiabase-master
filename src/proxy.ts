import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/app(.*)',
])

// Routes that are public (no auth required)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/stripe/webhook',
  '/api/clerk/webhook',
  '/api/demo/activate',
])

// Demo password - in production, use env var
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'dyia-demo-2024'

// Create the Clerk middleware handler
const clerkHandler = clerkMiddleware(async (auth, req) => {
  // Check for demo mode cookie
  const demoToken = req.cookies.get('dyia_demo_access')?.value
  const isDemoMode = demoToken === DEMO_PASSWORD

  // Protect the /app routes (unless demo mode)
  if (isProtectedRoute(req) && !isDemoMode) {
    await auth.protect()
  }
})

// Export as proxy function (Next.js 16 convention)
export function proxy(request: NextRequest) {
  return clerkHandler(request, {} as any)
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
