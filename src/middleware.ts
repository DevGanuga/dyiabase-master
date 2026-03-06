import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Routes that require authentication  
const isProtectedRoute = createRouteMatcher(['/app(.*)'])

/**
 * Compute SHA-256 hex digest using the Web Crypto API (Edge Runtime compatible).
 */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Falls back to simple equality if lengths differ (which is safe
 * because length difference already reveals mismatch).
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export default clerkMiddleware(
  async (auth, req) => {
    // Demo mode bypass: verify the httpOnly cookie contains the expected token.
    // The token is SHA256(DEMO_PASSWORD), set by /api/demo/activate.
    const demoPassword = process.env.DEMO_PASSWORD
    if (demoPassword) {
      const demoToken = req.cookies.get('dyia_demo_access')?.value
      if (demoToken) {
        const expected = await sha256Hex(demoPassword)
        if (timingSafeEqual(demoToken, expected)) {
          return NextResponse.next()
        }
      }
    }

    // Protect /app routes — auth.protect() handles session establishment properly
    // (unlike manual auth() + redirect which races with post-signup session creation)
    if (isProtectedRoute(req)) {
      await auth.protect()
    }
    
    return NextResponse.next()
  },
  {
    contentSecurityPolicy: {
      directives: {
        'connect-src': [
          // Supabase
          process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
          // Sentry tunnel
          'https://*.ingest.sentry.io',
          // OpenAI (for any client-side streaming)
          'https://api.openai.com',
        ].filter(Boolean),
        'img-src': [
          // Supabase storage (user-uploaded photos)
          process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
          // data: and blob: URIs for client-side image processing (logo upload, compression)
          'data:',
          'blob:',
        ].filter(Boolean),
      },
    },
  }
)

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
