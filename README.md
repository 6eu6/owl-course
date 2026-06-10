# Learn Plus Courses

> A free Udemy course discovery platform. Coupon courses are scraped automatically
> from curated free-coupon sources, deduplicated, and optionally posted to Telegram.

- Live site: `https://www.learn-plus.uk`
- Stack: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- Data: PostgreSQL via Prisma (Prisma Accelerate `DATABASE_URL`)
- Scraper: Node `fetch` + Cheerio (no Selenium/Playwright)

---

## Scraper sources (the only two currently implemented)

| Source | How a coupon is obtained |
|---|---|
| `udemyfreebies` | Listing pages are parsed for course links, then the `/out/{slug}` endpoint is followed — it returns a `302` to the real Udemy URL carrying `?couponCode=…`. |
| `studybullet` | Listing pages → detail page. The Udemy URL + coupon is read from the embedded enrol link / `ZapUrl`. Description, "what you'll learn", and requirements are extracted from the `.entry-content` sections. |

> Earlier versions referenced `discudemy` and `freebiesglobal`. Those are **not**
> implemented — `runFullScrape()` only runs `udemyfreebies` and `studybullet`.

### How coupon validity is handled (verified behaviour)

Udemy sits behind Cloudflare, which challenges datacenter IPs (Vercel/Oracle) with a
`403 "Just a moment"` page that no header change can pass. As a result, **live coupon
verification against Udemy is not reliable from a server.** The scraper therefore:

- **Trusts the source coupon.** Both `udemyfreebies` and `studybullet` only list
  free-coupon courses, so a successfully extracted coupon is accepted.
- Uses a **Cloudflare circuit breaker**: after a few consecutive blocks it stops
  hitting Udemy for the rest of the run instead of waiting ~2s per doomed request.
- **Estimates coupon expiry** from the coupon-code pattern (e.g. `JUN2026FREE1`).
- When Udemy *is* reachable, its page data is used opportunistically to enrich a
  course, but a coupon is never rejected just because verification was inconclusive.

### Categorisation

`categorize()` matches keywords on **whole-word boundaries**, so titles like
"…Real Scenarios" are no longer mis-tagged as iOS/Mobile because of the substring "ios".

## Post-scrape maintenance

After a full scrape (when not skipped) the job runs:

1. Post-scrape verification sweep on newly added courses.
2. `cleanupInvalidCourses()` — removes empty/placeholder coupons and bad rows.
3. `cleanupDuplicates()` — title-based de-duplication.
4. `removeOldExpiredCourses()` — drops courses whose coupon expired more than 7 days ago.

## UI

Minimal, monochrome (black & white) design. No colour utilities, no emoji, no
gradients — hierarchy is conveyed with filled vs. outlined elements, weight, and
clear borders. Light and dark themes are both grayscale.

---

## API routes

| Endpoint | Methods | Description |
|---|---|---|
| `/api/courses` | GET | List courses with pagination, search, and filters |
| `/api/courses/[slug]` | GET, POST | Get one course (+ related); `POST {action:"verify"}` re-checks its coupon |
| `/api/categories` | GET | Categories with course counts |
| `/api/scraper` | GET, POST | GET recent logs; POST runs a scrape or `cleanup` / `clean-invalid` / `purge` (admin password) |
| `/api/cron/scrape` | GET | Scheduled scrape, protected by `CRON_SECRET` |
| `/api/stats` | GET | Dashboard statistics |
| `/api/telegram` | GET, POST | Telegram settings / test / auto-post |
| `/api/admin` | GET, POST | Site settings |
| `/api/admin-bot` | GET, POST | Telegram admin-bot webhook/commands (uses `ADMIN_BOT_TOKEN`) |
| `/api/ads` | GET, POST | Public ad settings (GET) / save (POST, admin) |

The cron endpoint runs:

```ts
runFullScrape({ pages: 5, skipVerification: true, skipCleanup: true })
```

(`skipVerification`/`skipCleanup` keep the request inside the Vercel serverless time
budget; heavier cleanup can be triggered separately via `/api/scraper`.)

---

## Environment variables

Set these in Vercel → Project Settings → Environment Variables. Never commit them —
`.env` is git-ignored.

```bash
DATABASE_URL=postgresql://...        # or prisma+postgres://accelerate.prisma-data.net/?api_key=...
NEXT_PUBLIC_SITE_URL=https://www.learn-plus.uk
ADMIN_PASSWORD=...                   # admin dashboard only
CRON_SECRET=...                      # /api/cron/scrape only — keep separate from ADMIN_PASSWORD
TELEGRAM_BOT_TOKEN=...               # channel auto-posting bot
ADMIN_BOT_TOKEN=...                  # admin control bot
ADMIN_CHAT_IDS=...                   # comma-separated chat IDs allowed to use the admin bot
```

> Security: if any secret has ever been committed or exposed, rotate it. Removing a
> file from git history does **not** un-leak a value that was already public.

---

## Setup

```bash
bun install            # or npm install
npx prisma generate
npm run dev            # local dev on http://localhost:3000
```

Database schema sync during development:

```bash
npx prisma db push
```

Production build:

```bash
npm run build && npm run start
```

## Deployment

Deployed on Vercel (frontend + API routes). For Hobby plans the scrape is triggered by
an external scheduler (e.g. an Oracle VM cron) calling the cron endpoint every few hours:

```bash
curl -sS "https://www.learn-plus.uk/api/cron/scrape?secret=YOUR_CRON_SECRET"
```

Expected: `HTTP 200` with `success=true`. A `401` means the secret is wrong or Vercel
was not redeployed after setting `CRON_SECRET`.

## Pages

- `/` — public homepage: course listing, search, category/source filters.
- `/course/[slug]` — course detail (description, what-you'll-learn, requirements, coupon).
- `/admin` — dashboard: stats, manual scraper, Telegram, site settings.
