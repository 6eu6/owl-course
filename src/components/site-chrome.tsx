import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { LogoMark } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

export function SiteHeader({ backHref = "/", backLabel = "Home" }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <LogoMark className="h-5 w-5 shrink-0" />
          <span className="truncate">Learn Plus Courses</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Link
            href={backHref}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{backLabel}</span>
            <span className="sm:hidden">Back</span>
          </Link>
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
        <p>Learn Plus Courses</p>
      </div>
    </footer>
  )
}
