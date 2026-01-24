import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/app(.*)',
])

// Demo password - in production, use env var
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'dyia-demo-2026'

// Check if Clerk is configured
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

// Create the Clerk middleware handler (only if Clerk is configured)
const clerkHandler = isClerkConfigured 
  ? clerkMiddleware(async (auth, req) => {
      // Check for demo mode cookie
      const demoToken = req.cookies.get('dyia_demo_access')?.value
      const isDemoMode = demoToken === DEMO_PASSWORD

      // Protect the /app routes (unless demo mode)
      if (isProtectedRoute(req) && !isDemoMode) {
        await auth.protect()
      }
    })
  : null

// Export as proxy function (Next.js 16 convention)
export function proxy(request: NextRequest) {
  // Check for demo mode cookie first
  const demoToken = request.cookies.get('dyia_demo_access')?.value
  const isDemoMode = demoToken === DEMO_PASSWORD

  // If demo mode, allow through
  if (isDemoMode) {
    return NextResponse.next()
  }

  // If Clerk is configured, use Clerk middleware
  if (clerkHandler) {
    return clerkHandler(request, {} as any)
  }

  // If Clerk isn't configured and trying to access /app, redirect to home
  // (unless demo mode, which is handled above)
  if (isProtectedRoute(request)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Otherwise, allow through
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
