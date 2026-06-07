import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { LogoMark } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

export function SiteHeader({ backHref = '/', backLabel = 'Home' }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <LogoMark className="h-5 w-5" />
          <span>Learn Plus Courses</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {backLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t mt-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground space-y-2">
        <div className="space-x-3">
          <Link href="/about" className="hover:text-foreground">About</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
        </div>
        <p>© {new Date().getFullYear()} Learn Plus Courses — Free Udemy Courses</p>
      </div>
    </footer>
  )
}
