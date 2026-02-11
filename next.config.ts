import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Force project root so resolution doesn't use a parent directory (e.g. C:\Users\ricar\) when another package.json exists there
const projectRoot = process.cwd();

// Content Security Policy — allows Clerk, Supabase, Stripe, and OpenAI resources.
// Using an array and joining for readability; 'unsafe-inline' is required for
// Next.js dev mode and Clerk's inline scripts, 'unsafe-eval' only in development.
const cspDirectives = [
  "default-src 'self'",
  // Scripts: self, Clerk, Stripe, inline (needed by Next.js), eval only in dev
  `script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://js.stripe.com${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  // Styles: self, inline (Tailwind), Google Fonts
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Images: self, data URIs, Supabase storage, Clerk avatars, blob for PDF preview
  "img-src 'self' data: blob: https://*.supabase.co https://img.clerk.com https://*.clerk.com",
  // Fonts: self, Google Fonts CDN
  "font-src 'self' https://fonts.gstatic.com",
  // API connections: self, Supabase, Clerk, Stripe, OpenAI, Sentry
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clerk.accounts.dev https://api.clerk.com https://api.stripe.com https://api.openai.com https://*.ingest.sentry.io",
  // Frames: Stripe checkout iframe, Clerk
  "frame-src https://js.stripe.com https://*.clerk.accounts.dev",
  // Workers: self (for PDF generation, etc.)
  "worker-src 'self' blob:",
  // Object embeds: none
  "object-src 'none'",
  // Base URI: self
  "base-uri 'self'",
  // Form actions: self
  "form-action 'self'",
  // Frame ancestors: none (equivalent to X-Frame-Options: DENY)
  "frame-ancestors 'none'",
];

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
  {
    key: 'Content-Security-Policy',
    value: cspDirectives.join('; '),
  },
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
