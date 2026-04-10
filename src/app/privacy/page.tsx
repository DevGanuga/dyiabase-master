import Link from 'next/link'
import type { Metadata } from 'next'
import { PublicHeader } from '@/components/PublicHeader'

export const metadata: Metadata = {
  title: 'Privacy Policy — dyia',
  description: 'Privacy Policy for dyia, the business management platform for service businesses.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/10 via-[#09090b] to-[#09090b]" />
      </div>

      <PublicHeader variant="simple" />

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mb-10">Last updated: February 9, 2026</p>

        <div className="prose prose-invert prose-slate max-w-none space-y-8 text-slate-300 leading-relaxed text-[15px]">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              dyia (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) respects your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our business management platform (&quot;the Service&quot;).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-slate-200 mt-4 mb-2">Account Information</h3>
            <p>When you create an account, we collect:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Name, email address (via Clerk authentication)</li>
              <li>Profile photo (if provided via social login)</li>
              <li>Payment information (processed and stored by Stripe; we do not store card numbers)</li>
            </ul>

            <h3 className="text-lg font-medium text-slate-200 mt-4 mb-2">Business Data</h3>
            <p>Data you enter into the Service:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Jobs (dates, customer names, revenue, expenses)</li>
              <li>Quotes (customer info, pricing, photos)</li>
              <li>Follow-ups and customer interactions</li>
              <li>Business settings (name, phone, address, tax rate, goals)</li>
              <li>Fixed expenses and price templates</li>
            </ul>

            <h3 className="text-lg font-medium text-slate-200 mt-4 mb-2">AI Interaction Data</h3>
            <p>
              If you use the Dyia AI Assistant, your conversation messages and uploaded files are processed by OpenAI to generate responses. We store conversation history for continuity.
            </p>

            <h3 className="text-lg font-medium text-slate-200 mt-4 mb-2">Automatically Collected Data</h3>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Browser type, device information</li>
              <li>IP address (for security and rate limiting)</li>
              <li>Pages visited and features used (usage analytics)</li>
              <li>Cookies for authentication and preferences (theme, session)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Provide the Service:</strong> Process jobs, generate quotes, track finances, deliver AI insights.</li>
              <li><strong>Authentication:</strong> Verify your identity and manage your account via Clerk.</li>
              <li><strong>Billing:</strong> Process payments and manage subscriptions via Stripe.</li>
              <li><strong>Communication:</strong> Send transactional emails (welcome, trial reminders, weekly insights, support responses) via Resend.</li>
              <li><strong>Improvement:</strong> Analyze aggregated, anonymized usage patterns to improve features.</li>
              <li><strong>Security:</strong> Detect and prevent fraud, abuse, and security threats.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Third-Party Services</h2>
            <p>We use the following third-party services to operate:</p>
            <div className="mt-3 space-y-3">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
                <p className="font-medium text-slate-200">Clerk (Authentication)</p>
                <p className="text-sm text-slate-400 mt-1">Handles sign-up, sign-in, and session management. <a href="https://clerk.com/privacy" className="text-orange-400 hover:text-orange-300">Clerk Privacy Policy</a></p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
                <p className="font-medium text-slate-200">Supabase (Database)</p>
                <p className="text-sm text-slate-400 mt-1">Stores your business data in encrypted PostgreSQL databases. <a href="https://supabase.com/privacy" className="text-orange-400 hover:text-orange-300">Supabase Privacy Policy</a></p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
                <p className="font-medium text-slate-200">Stripe (Payments)</p>
                <p className="text-sm text-slate-400 mt-1">Processes payments securely. We never see or store your full card number. <a href="https://stripe.com/privacy" className="text-orange-400 hover:text-orange-300">Stripe Privacy Policy</a></p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
                <p className="font-medium text-slate-200">OpenAI (AI Features)</p>
                <p className="text-sm text-slate-400 mt-1">Powers the Dyia AI Assistant. Conversation data is sent to OpenAI for processing. <a href="https://openai.com/privacy" className="text-orange-400 hover:text-orange-300">OpenAI Privacy Policy</a></p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
                <p className="font-medium text-slate-200">Resend (Email)</p>
                <p className="text-sm text-slate-400 mt-1">Sends transactional emails (welcome, reminders, support). <a href="https://resend.com/privacy" className="text-orange-400 hover:text-orange-300">Resend Privacy Policy</a></p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
                <p className="font-medium text-slate-200">Vercel (Hosting)</p>
                <p className="text-sm text-slate-400 mt-1">Hosts the application. <a href="https://vercel.com/legal/privacy-policy" className="text-orange-400 hover:text-orange-300">Vercel Privacy Policy</a></p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Cookies</h2>
            <p>We use the following cookies:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Authentication cookies:</strong> Managed by Clerk for session management (essential).</li>
              <li><strong>Theme preference:</strong> Stored in localStorage to remember your light/dark mode choice.</li>
              <li><strong>Demo mode:</strong> A cookie to enable the demo experience (optional).</li>
            </ul>
            <p className="mt-2">We do not use advertising cookies or third-party tracking cookies.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Your data is retained for as long as your account is active.</li>
              <li>If you delete your account, we will delete your personal data within 30 days.</li>
              <li>Some data may be retained in backups for up to 90 days.</li>
              <li>Anonymized, aggregated data may be retained indefinitely for analytics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your data, including:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Encryption in transit (TLS/HTTPS) and at rest</li>
              <li>Secure authentication via Clerk</li>
              <li>Database access controlled by Row Level Security (RLS) policies</li>
              <li>API route protection with authentication checks</li>
              <li>Webhook signature verification (Svix for Clerk, Stripe signatures)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Access:</strong> Request a copy of your personal data.</li>
              <li><strong>Export:</strong> Download your data as CSV from Settings.</li>
              <li><strong>Correction:</strong> Update your information in Settings.</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data by contacting dyia.io.app@gmail.com.</li>
              <li><strong>Portability:</strong> Export and take your data to another service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. California Privacy Rights (CCPA)</h2>
            <p>If you are a California resident, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Know what personal information is collected about you.</li>
              <li>Request deletion of your personal information.</li>
              <li>Opt out of the sale of personal information (we do not sell your data).</li>
              <li>Non-discrimination for exercising your privacy rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Children&apos;s Privacy</h2>
            <p>
              The Service is not intended for use by individuals under 18. We do not knowingly collect personal information from children under 18.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes via email or in-app notification. The &quot;Last updated&quot; date at the top indicates when changes were last made.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Contact Us</h2>
            <p>
              For privacy-related questions or to exercise your rights, contact us at:{' '}
              <a href="mailto:dyia.io.app@gmail.com" className="text-orange-400 hover:text-orange-300">dyia.io.app@gmail.com</a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] mt-20">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-slate-600 text-sm">&copy; 2026 dyia. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/terms" className="hover:text-orange-400 transition">Terms of Service</Link>
            <Link href="/support" className="hover:text-orange-400 transition">Support</Link>
            <Link href="/" className="hover:text-orange-400 transition">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
