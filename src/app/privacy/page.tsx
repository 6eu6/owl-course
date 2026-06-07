import type { Metadata } from 'next'
import { SiteHeader, SiteFooter } from '@/components/site-chrome'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Learn Plus Courses handles cookies and your privacy.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 space-y-5">
        <h1 className="text-xl font-bold">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground">Last updated: {new Date().getFullYear()}</p>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Learn Plus Courses respects your privacy. We do not require an account and we do not ask
          you to submit personal information to browse or start courses.
        </p>

        <h2 className="text-base font-semibold">Cookies</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We use a small number of cookies to keep the site working (necessary cookies) and,
          optionally, to understand how the site is used so we can improve it (analytics cookies).
          When you first visit, you can accept all cookies, reject optional ones, or customize your
          choice. You can change your decision at any time by clearing the cookie for this site in
          your browser.
        </p>

        <h2 className="text-base font-semibold">Information we collect</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We do not collect names, emails or passwords. Standard, aggregated and anonymous usage
          data (such as which pages are popular) may be processed to improve the experience. We do
          not sell your data.
        </p>

        <h2 className="text-base font-semibold">External links</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Starting a course may take you to a third-party learning platform. Once you leave our
          site, that platform&apos;s own privacy policy applies.
        </p>

        <h2 className="text-base font-semibold">Contact</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          If you have any questions about this policy, you can reach us through the channels listed
          on our site.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
