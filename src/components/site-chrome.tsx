import Link from "next/link"
import { ArrowRight, ArrowLeft } from "lucide-react"
import { LogoMark } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { LocaleSwitch } from "@/components/locale-switch"
import { makeT } from "@/lib/locale-text"
import { localeDir, type Locale } from "@/lib/i18n"

export function SiteHeader({
  backHref = "/",
  backLabel = "Home",
  homeHref = "/",
  backShort = "Back",
  locale = "en",
}: {
  backHref?: string
  backLabel?: string
  homeHref?: string
  backShort?: string
  locale?: Locale
}) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href={homeHref} className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <LogoMark className="h-5 w-5 shrink-0" />
          <span className="truncate">Learn Plus Courses</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitch locale={locale} />
          <ThemeToggle />
          <Link
            href={backHref}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {locale === "ar" ? (
              <>
                <span className="hidden sm:inline">{backLabel}</span>
                <span className="sm:hidden">{backShort}</span>
                {/* RTL: back points right, placed after the label */}
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                {/* LTR: back points left, placed before the label */}
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{backLabel}</span>
                <span className="sm:hidden">{backShort}</span>
              </>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}

const SOCIAL = {
  x: "https://x.com/learnplusfree",
  bot: "https://t.me/FreeLearningHub_P_bot",
  channel: "https://t.me/LPCourse",
  community: "https://t.me/+AU8JJ85DUswzOGNi",
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function TgIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

// Single shared footer used on every page (home + inner) so the layout is
// always identical. Each channel is labelled so its purpose is unambiguous.
export function SiteFooter({ locale = "en" }: { locale?: Locale }) {
  const t = makeT(locale)
  const base = `/${locale}`
  const channel =
    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
  return (
    <footer className="border-t mt-auto" dir={localeDir(locale)}>
      <div className="max-w-3xl mx-auto px-4 py-8 text-center text-xs text-muted-foreground space-y-5">
        {/* Brand */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-1.5">
            <LogoMark className="h-4 w-4" />
            <span className="font-bold text-sm text-foreground">Learn<span className="text-muted-foreground"> Plus</span></span>
          </div>
          <p className="text-[11px] max-w-sm mx-auto">{t("footerDesc")}</p>
        </div>

        {/* Channels — each labelled so users know what it is */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <a href={SOCIAL.channel} target="_blank" rel="noopener noreferrer" className={channel}>
            <TgIcon /> {t("telegramChannel")}
          </a>
          <a href={SOCIAL.community} target="_blank" rel="noopener noreferrer" className={channel}>
            <TgIcon /> {t("joinCommunity")}
          </a>
          <a href={SOCIAL.bot} target="_blank" rel="noopener noreferrer" className={channel}>
            <TgIcon /> {t("contactBot")}
          </a>
          <a href={SOCIAL.x} target="_blank" rel="noopener noreferrer" className={channel}>
            <XIcon /> {t("x")}
          </a>
        </div>

        {/* Pages — locale-aware so /ar opens Arabic content */}
        <div className="flex items-center justify-center gap-3">
          <Link href={`${base}/about`} className="hover:text-foreground">{t("about")}</Link>
          <Link href={`${base}/privacy`} className="hover:text-foreground">{t("privacy")}</Link>
          <Link href={`${base}/terms`} className="hover:text-foreground">{t("terms")}</Link>
        </div>

        <p>© {new Date().getFullYear()} Learn Plus Courses. {t("siteTagline")}</p>

        {/* Build credit */}
        <div className="pt-4 border-t">
          <a
            href="https://www.ahmed-alshaibani.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>{t("builtBy")}</span>
            <span className="text-sm font-extrabold tracking-tight text-foreground">Ahmed<span className="text-emerald-500">.</span></span>
          </a>
        </div>
      </div>
    </footer>
  )
}
