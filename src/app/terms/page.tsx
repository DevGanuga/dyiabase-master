import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service | dyia',
  description: 'Terms of Service for dyia - the rules for using our platform.',
}

export default function TermsOfServicePage() {
  const lastUpdated = 'February 8, 2026'

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/dyia-agent.png" alt="dyia" className="w-8 h-8 object-contain" />
            <span className="text-lg font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">dyia</span>
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Back to Home</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: {lastUpdated}</p>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using dyia (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">2. Description of Service</h2>
            <p>dyia is a business management platform for service businesses. It provides job tracking, quote generation, follow-up management, financial reporting, AI-powered business insights, and marketing tools.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">3. Account Registration</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must be at least 18 years old to use the Service.</li>
              <li>One person or business per account. Account sharing is not permitted.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">4. Subscription and Billing</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Free Trial:</strong> New Pro subscribers receive a 14-day free trial. A valid payment method is required. You will not be charged during the trial period.</li>
              <li><strong>Billing:</strong> After the trial period, your subscription will automatically renew and you will be charged at the current rate for your plan (monthly or annual).</li>
              <li><strong>Cancellation:</strong> You may cancel your subscription at any time through Settings. You will retain access until the end of your current billing period.</li>
              <li><strong>Refunds:</strong> Subscription fees are non-refundable except as required by law. Contact support for exceptional circumstances.</li>
              <li><strong>Price Changes:</strong> We may change pricing with 30 days notice. Existing subscribers will be notified before any price increase takes effect.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">5. Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You own all data you enter into dyia (jobs, quotes, customers, financial information).</li>
              <li>You grant us a limited license to process your data to provide the Service.</li>
              <li>You can export your data at any time via the CSV export feature in Settings.</li>
              <li>We will not sell your data to third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">6. AI Features</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>AI features (Dyia assistant, pricing suggestions, insights) are provided as tools to assist your business decisions.</li>
              <li>AI output should not be treated as professional financial, legal, or tax advice.</li>
              <li>You are responsible for verifying AI suggestions before acting on them.</li>
              <li>AI features require Pro subscription or AI credits.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Use the Service for any illegal purpose.</li>
              <li>Attempt to access other users&apos; data.</li>
              <li>Reverse engineer, decompile, or disassemble the Service.</li>
              <li>Use automated tools to scrape or extract data from the Service.</li>
              <li>Resell or redistribute the Service without written permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">8. Service Availability</h2>
            <p>We aim for 99.9% uptime but do not guarantee uninterrupted service. We may perform maintenance with reasonable notice. We are not liable for losses resulting from service interruptions.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, dyia and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities. Our total liability shall not exceed the amount you paid for the Service in the 12 months prior to the claim.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">10. Termination</h2>
            <p>We may suspend or terminate your account if you violate these terms. You may delete your account at any time. Upon termination, your data will be deleted within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">11. Changes to Terms</h2>
            <p>We may update these terms from time to time. Material changes will be communicated via email or in-app notification at least 30 days before taking effect.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">12. Contact</h2>
            <p>Questions about these terms? Contact us at <a href="mailto:support@dyia.co" className="text-orange-500 hover:underline">support@dyia.co</a>.</p>
          </section>
        </div>
      </main>
    </div>
  )
}
