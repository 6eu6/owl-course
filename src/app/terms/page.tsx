import type { Metadata } from 'next'
import { SiteHeader, SiteFooter } from '@/components/site-chrome'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'The terms for using Learn Plus Courses.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 space-y-5">
        <h1 className="text-xl font-bold">Terms of Use</h1>
        <p className="text-xs text-muted-foreground">Last updated: {new Date().getFullYear()}</p>

        <p className="text-sm text-muted-foreground leading-relaxed">
          By using Learn Plus Courses you agree to these terms. The site is provided to help you
          discover and start online courses for free.
        </p>

        <h2 className="text-base font-semibold">Use of the site</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          You may browse, search and share courses freely for personal, non-commercial use. Please
          do not attempt to disrupt, scrape or misuse the service.
        </p>

        <h2 className="text-base font-semibold">Course availability</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Free access to courses is time-limited and provided by third-party learning platforms.
          Availability can change at any time and is outside our control. If a course is no longer
          free when you reach it, please check back later — the catalogue updates regularly.
        </p>

        <h2 className="text-base font-semibold">No warranty</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The site and its content are provided &quot;as is&quot;, without warranties of any kind.
          We are not responsible for the content, quality or availability of courses hosted on
          external platforms.
        </p>

        <h2 className="text-base font-semibold">Changes</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We may update these terms from time to time. Continued use of the site means you accept
          the latest version.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
