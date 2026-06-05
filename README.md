# OWL COURSE

> Free Udemy courses platform — automatically updated from coupon sources and posted to Telegram when new courses are found.

## Current verified status

- Production URL: `https://owl-course-roan.vercel.app`
- Cron endpoint: `GET /api/cron/scrape`
- Verified manual cron test from Oracle VM:
  - `HTTP_STATUS=200`
  - `success=true`
  - Example result: `Cron scrape complete: 0 new courses in 13s`
  - `totalDup=59`, `totalErr=0`
- Current deployment model:
  - Vercel hosts the Next.js app and API routes.
  - Oracle VM should only trigger the cron endpoint with `curl` every 4 hours.
  - Do not run a separate PM2 worker for this project unless the architecture is intentionally changed later.

## Features

- **Auto Scraper**: Fetches free Udemy coupon courses from supported sources.
- **Coupon Validation**: Extracts Udemy coupon URLs, rejects invalid placeholder coupons, verifies fresh coupons when possible, and removes expired/invalid courses.
- **Multi-Telegram Channels**: Posts new courses to configured Telegram channels with customizable templates.
- **Simple Admin Dashboard**: Direct control panel for scraper, Telegram, and settings.
- **PostgreSQL + Prisma**: One database accessed through Prisma.
- **Next.js 16**: Frontend + API routes.

## Tech Stack

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL via Prisma (`DATABASE_URL`)
- **Scraper**: Node.js fetch + Cheerio, no Selenium/Playwright
- **Scheduler**: External cron trigger from Oracle VM for Hobby deployments

## Supported scraper sources

The current `runFullScrape()` implementation can run these sources:

- `udemyfreebies`
- `discudemy`
- `freebiesglobal`

The cron endpoint currently runs the default scrape with 5 pages:

```ts
runFullScrape({ pages: 5 })
```

After scraping, the job also runs verification and cleanup:

1. Post-scrape coupon verification sweep for newly added courses.
2. Invalid course cleanup.
3. Title duplicate cleanup.
4. Old expired coupon cleanup.
5. Telegram auto-post if new courses are found.

## Environment variables

Set these in Vercel Project Settings → Environment Variables.

```bash
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SITE_URL=https://owl-course-roan.vercel.app
ADMIN_PASSWORD=your_admin_dashboard_password
CRON_SECRET=your_separate_cron_secret
```

Optional Telegram-related settings are stored/managed by the app dashboard, depending on current implementation.

### Important secret separation

Use separate secrets:

- `ADMIN_PASSWORD`: only for the admin dashboard.
- `CRON_SECRET`: only for `/api/cron/scrape`.

The cron endpoint code supports `CRON_SECRET || ADMIN_PASSWORD`, but production should use `CRON_SECRET` so the admin password is not embedded in cron URLs or logs.

After changing Vercel environment variables, redeploy the project before testing again.

## Setup

```bash
npm install
npx prisma generate
npm run build
```

For local development:

```bash
npm run dev
```

For database schema sync during development:

```bash
npx prisma db push
```

## Pages

- `/` — Public homepage with course listing, search, and filters.
- `/admin` — Admin dashboard for stats, scraper, Telegram, and settings.

## API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/api/courses` | GET | List courses with pagination, search, and filters |
| `/api/courses/[slug]` | GET | Get single course + related courses |
| `/api/scraper` | GET | Get recent scraper logs |
| `/api/scraper` | POST | Run scraper manually or cleanup actions, protected by admin password |
| `/api/cron/scrape` | GET | Scheduled scrape endpoint, protected by `CRON_SECRET` |
| `/api/telegram` | GET | Get Telegram settings + stats |
| `/api/telegram` | POST | Save/test/auto-post Telegram |
| `/api/stats` | GET | Dashboard statistics |
| `/api/admin` | POST | Save site settings |

## Deployment on Vercel

The app is deployed on Vercel as frontend + API routes.

Required production env variables:

```bash
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SITE_URL=https://owl-course-roan.vercel.app
ADMIN_PASSWORD=...
CRON_SECRET=...
```

Vercel cron is defined in `vercel.json`, but for Hobby deployment this project should use Oracle VM as the external scheduler.

## Oracle VM cron setup

Oracle should only trigger the deployed Vercel endpoint. It should not run the scraper locally.

### 1. Manual test from Oracle

Replace `YOUR_CRON_SECRET` with the Vercel `CRON_SECRET` value. URL-encode special characters if needed.

```bash
curl -sS -w $'\nHTTP_STATUS=%{http_code}\nTOTAL_TIME=%{time_total}s\n' \
  "https://owl-course-roan.vercel.app/api/cron/scrape?secret=YOUR_CRON_SECRET"
```

Expected:

```text
HTTP_STATUS=200
success=true
```

If the result is `401`, the secret is wrong or Vercel was not redeployed after setting `CRON_SECRET`.

### 2. Create the cron script

```bash
mkdir -p ~/scripts ~/cronlogs

cat > ~/scripts/run-owl-course-cron.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

URL="https://owl-course-roan.vercel.app/api/cron/scrape?secret=YOUR_CRON_SECRET"
LOG="/home/ubuntu/cronlogs/owl-course-scraper.log"

echo "===== owl-course scrape start $(date -Is) =====" >> "$LOG"

curl -sS --max-time 300 \
  -w "\nHTTP_STATUS=%{http_code}\nTOTAL_TIME=%{time_total}s\n" \
  "$URL" >> "$LOG" 2>&1

echo "===== owl-course scrape end $(date -Is) =====" >> "$LOG"
echo "" >> "$LOG"
EOF

chmod +x ~/scripts/run-owl-course-cron.sh
```

Edit the script and replace `YOUR_CRON_SECRET` with the real cron secret:

```bash
nano ~/scripts/run-owl-course-cron.sh
```

### 3. Test the script

```bash
flock -n /tmp/owl-course-scraper.lock ~/scripts/run-owl-course-cron.sh

tail -n 80 ~/cronlogs/owl-course-scraper.log
```

Expected log:

```text
HTTP_STATUS=200
success=true
```

### 4. Install crontab every 4 hours

```bash
crontab -l > /tmp/current-cron 2>/dev/null || true

cat >> /tmp/current-cron <<'EOF'

# owl-course scraper trigger - every 4 hours
0 */4 * * * flock -n /tmp/owl-course-scraper.lock /home/ubuntu/scripts/run-owl-course-cron.sh

EOF

crontab /tmp/current-cron
crontab -l
```

### 5. Verify after installation

```bash
pm2 status
crontab -l
tail -n 100 ~/cronlogs/owl-course-scraper.log
```

Expected server state:

- `owl-course` is not running as a PM2 worker.
- Oracle only has a crontab trigger for this project.
- Existing unrelated PM2 workers remain untouched.

## Admin Dashboard

Access at `/admin`:

1. **الإحصائيات** — Overview of courses, sources, categories
2. **السكرايبر** — Run manual scrapes, view logs
3. **تليجرام** — Configure bot, manage channels, auto-post
4. **إعدادات** — Site name, description, pagination

## Telegram Multi-Channel

1. Set Bot Token from [@BotFather](https://t.me/BotFather)
2. Add the bot admin to each channel
3. Enter Channel IDs, for example `@my_channel`
4. Customize message template with variables such as `{title}`, `{link}`, `{instructor}`
5. Enable auto-post or trigger manually

## Operational notes

- Keep `CRON_SECRET` separate from `ADMIN_PASSWORD`.
- Do not put the admin password in cron URLs.
- Do not run this project as a local PM2 scraper on Oracle unless a future worker architecture is added.
- If Vercel returns timeout/500, reduce scrape scope before moving work to Oracle:
  - fewer pages
  - one source per run
  - cleanup less frequently
  - lower Telegram auto-post count
