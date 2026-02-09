import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | dyia',
  description: 'Privacy Policy for dyia - how we collect, use, and protect your data.',
}

export default function PrivacyPolicyPage() {
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
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: {lastUpdated}</p>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">1. Information We Collect</h2>
            <p>When you use dyia, we collect information you provide directly:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Account Information:</strong> Name, email address, and business details when you sign up.</li>
              <li><strong>Business Data:</strong> Jobs, quotes, expenses, customers, and financial information you enter into the platform.</li>
              <li><strong>Payment Information:</strong> Processed securely by Stripe. We do not store your full credit card number.</li>
              <li><strong>Usage Data:</strong> How you interact with the platform (pages visited, features used, device information).</li>
              <li><strong>AI Conversations:</strong> Messages exchanged with the Dyia AI assistant to provide and improve the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide, maintain, and improve the dyia platform.</li>
              <li>Process payments and manage your subscription.</li>
              <li>Send transactional emails (welcome, trial reminders, weekly insights, follow-up reminders).</li>
              <li>Power AI features (pricing suggestions, business insights, revenue forecasting).</li>
              <li>Provide customer support.</li>
              <li>Analyze usage patterns to improve the product.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">3. Data Sharing</h2>
            <p>We do not sell your personal information. We share data only with:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Stripe:</strong> Payment processing.</li>
              <li><strong>Clerk:</strong> Authentication and account management.</li>
              <li><strong>Supabase:</strong> Database hosting (data encrypted at rest and in transit).</li>
              <li><strong>OpenAI:</strong> AI assistant functionality. Your business data is sent to OpenAI to power AI features. OpenAI does not use your data to train their models per our API agreement.</li>
              <li><strong>Resend:</strong> Transactional email delivery.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">4. Data Security</h2>
            <p>We implement industry-standard security measures including:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>HTTPS encryption for all data in transit.</li>
              <li>Database encryption at rest.</li>
              <li>Service role key isolation (never exposed to client-side code).</li>
              <li>Webhook signature verification for all third-party integrations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">5. Data Retention</h2>
            <p>Your data is retained for as long as your account is active. If you delete your account, we will delete your data within 30 days. Some data may be retained in backups for up to 90 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Access your data (available via CSV export in Settings).</li>
              <li>Correct inaccurate data.</li>
              <li>Delete your account and data.</li>
              <li>Opt out of marketing emails.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">7. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We do not use advertising cookies or trackers unless you have explicitly opted in.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">8. Changes to This Policy</h2>
            <p>We may update this policy from time to time. We will notify you of material changes via email or an in-app notification.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-8 mb-3">9. Contact</h2>
            <p>Questions about this policy? Contact us at <a href="mailto:support@dyia.co" className="text-orange-500 hover:underline">support@dyia.co</a>.</p>
          </section>
        </div>
      </main>
    </div>
  )
}
