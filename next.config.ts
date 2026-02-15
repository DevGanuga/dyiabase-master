import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Force project root so resolution doesn't use a parent directory (e.g. C:\Users\ricar\) when another package.json exists there
const projectRoot = process.cwd();

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // CSP removed — was blocking Clerk/Stripe in production.
  // TODO: Re-add CSP using Clerk's automatic CSP middleware (clerkMiddleware contentSecurityPolicy option)
  // which auto-detects the correct FAPI domain. See: https://clerk.com/docs/security/clerk-csp
];

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  webpack: (config) => {
    config.context = projectRoot;
    return config;
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

// Wrap with Sentry only when DSN is configured (avoids build errors without Sentry)
const sentryConfigured = !!process.env.NEXT_PUBLIC_SENTRY_DSN

export default sentryConfigured
  ? withSentryConfig(nextConfig, {
      // Sentry org and project are set via env vars:
      // SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
      silent: true, // Suppress Sentry CLI logs during build
      tunnelRoute: '/monitoring', // Proxy Sentry events to avoid ad-blockers
      disableLogger: true, // Remove Sentry logger SDK from client bundles
    })
  : nextConfig;
