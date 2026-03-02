import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — dyia',
  description: 'Terms of Service for dyia, the business management platform for service businesses.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/10 via-[#09090b] to-[#09090b]" />
      </div>

      <nav className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/dyia-logo-full.png" alt="dyia" className="h-8 object-contain brightness-0 invert" />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition">Home</Link>
            <Link href="/support" className="text-sm text-slate-400 hover:text-white transition">Support</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-slate-500 text-sm mb-10">Last updated: February 9, 2026</p>

        <div className="prose prose-invert prose-slate max-w-none space-y-8 text-slate-300 leading-relaxed text-[15px]">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Agreement to Terms</h2>
            <p>
              By accessing or using dyia (&quot;the Service&quot;), operated by dyia (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              dyia is a business management platform designed for service businesses (junk removal, lawn care, house cleaning, etc.). The Service provides job tracking, quote generation, follow-up management, financial reporting, and AI-powered business insights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Account Terms</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You must be at least 18 years old to use the Service.</li>
              <li>You must provide accurate, complete registration information.</li>
              <li>You are responsible for maintaining the security of your account and password.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>One person or legal entity may not maintain more than one account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Payment and Billing</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>The Service offers a free 14-day trial. No credit card is required to start.</li>
              <li>After the trial, a paid subscription (Basic or Pro) is required to continue accessing premium features.</li>
              <li>Subscriptions are billed monthly or annually, as selected at checkout.</li>
              <li>All payments are processed securely through Stripe. We do not store your credit card information.</li>
              <li>Prices are subject to change with 30 days&apos; notice.</li>
              <li>Refunds are handled on a case-by-case basis. Contact dyia.io.app@gmail.com for refund requests.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Cancellation</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You may cancel your subscription at any time from your account settings or Stripe billing portal.</li>
              <li>Cancellation takes effect at the end of the current billing period.</li>
              <li>You will retain access to your data after cancellation, but premium features will be restricted.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Ownership</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You own all data you enter into the Service (jobs, quotes, customer info, expenses).</li>
              <li>You can export your data at any time via the Settings page.</li>
              <li>We do not sell, share, or use your business data for advertising purposes.</li>
              <li>We may use aggregated, anonymized data to improve the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. AI Features</h2>
            <p>
              The Service includes AI-powered features (the &quot;Dyia AI Assistant&quot;) provided through OpenAI. By using these features:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>You acknowledge that AI responses are generated suggestions and should not be treated as professional financial or legal advice.</li>
              <li>Conversation data may be processed by OpenAI in accordance with their usage policies.</li>
              <li>AI credits are consumed per interaction and are non-refundable once used.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Use the Service for any unlawful purpose.</li>
              <li>Attempt to gain unauthorized access to the Service or its systems.</li>
              <li>Interfere with or disrupt the Service&apos;s infrastructure.</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service.</li>
              <li>Use the Service to send spam or unsolicited messages.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind. To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities.
            </p>
            <p className="mt-2">
              Our total liability for any claim arising from the Service shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Service Availability</h2>
            <p>
              We strive for high availability but do not guarantee uninterrupted service. We may perform maintenance, updates, or experience downtime. We will make reasonable efforts to notify users of planned downtime.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of material changes via email or in-app notification. Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Contact</h2>
            <p>
              Questions about these Terms? Contact us at{' '}
              <a href="mailto:dyia.io.app@gmail.com" className="text-orange-400 hover:text-orange-300">dyia.io.app@gmail.com</a>.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] mt-20">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-slate-600 text-sm">&copy; 2026 dyia. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/privacy" className="hover:text-orange-400 transition">Privacy Policy</Link>
            <Link href="/support" className="hover:text-orange-400 transition">Support</Link>
            <Link href="/" className="hover:text-orange-400 transition">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
