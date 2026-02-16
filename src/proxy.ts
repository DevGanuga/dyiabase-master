import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Routes that require authentication  
const isProtectedRoute = createRouteMatcher(['/app(.*)'])

export const proxy = clerkMiddleware(async (auth, req) => {
  // Demo mode bypass (requires DEMO_PASSWORD env var - no hardcoded fallback)
  const demoPassword = process.env.DEMO_PASSWORD
  if (demoPassword) {
    const demoToken = req.cookies.get('dyia_demo_access')?.value
    if (demoToken === demoPassword) {
      return NextResponse.next()
    }
  }

  // Protect /app routes — auth.protect() handles session establishment properly
  // (unlike manual auth() + redirect which races with post-signup session creation)
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
  
  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
