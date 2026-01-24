import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/app(.*)',
])

// Demo password
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'dyia-demo-2026'

export default clerkMiddleware(async (auth, req) => {
  // Check for demo mode cookie first
  const demoToken = req.cookies.get('dyia_demo_access')?.value
  if (demoToken === DEMO_PASSWORD) {
    return NextResponse.next()
  }

  // Protect /app routes
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
