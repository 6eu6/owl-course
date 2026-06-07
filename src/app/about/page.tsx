import type { Metadata } from 'next'
import { SiteHeader, SiteFooter } from '@/components/site-chrome'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn Plus Courses helps learners discover quality online courses they can take for free, with a clean, fast, no-clutter experience.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 space-y-5">
        <h1 className="text-xl font-bold">About Learn Plus Courses</h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Learn Plus Courses is a free learning hub. We surface high-quality online courses —
          across development, business, design, data, marketing, personal growth and more — and
          make them easy to browse, search and start, completely free.
        </p>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Our goal is simple: remove the friction between you and learning. Every course on the
          site can be started at no cost, and the catalogue is refreshed automatically so there is
          always something new to learn. No accounts, no paywalls, no clutter — just a fast, clean
          way to keep growing your skills.
        </p>

        <h2 className="text-base font-semibold pt-2">What we offer</h2>
        <ul className="text-sm text-muted-foreground leading-relaxed list-disc list-inside space-y-1">
          <li>A constantly updated library of free online courses.</li>
          <li>Clear course details — what you will learn, requirements and level.</li>
          <li>A minimal, distraction-free interface that works on any device.</li>
          <li>One-tap sharing so you can pass great courses to friends.</li>
        </ul>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Learning should be open to everyone. We hope Learn Plus Courses helps you find your next
          skill — and enjoy the journey of getting there.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
