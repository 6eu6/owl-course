# OWL COURSE

> Free Udemy courses platform — automatically updated from UdemyFreebies and StudyBullet

## Features

- **Auto Scraper**: Fetches free courses from UdemyFreebies.com and StudyBullet.com
- **Multi-Telegram Channels**: Post to multiple Telegram channels with customizable templates
- **Simple Admin Dashboard**: Direct control panel for scraper, telegram, and settings
- **One Database**: MongoDB only — clean and simple
- **Next.js 16**: Fast, modern frontend with SSR

## Tech Stack

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: MongoDB (Atlas or local)
- **Scraper**: Node.js with cheerio (lightweight, no Selenium)

## Setup

### 1. Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/owlcourse
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### 2. Install & Run

```bash
bun install
bun run dev
```

### 3. Pages

- **`/`** — Public homepage (course listing with search & filters)
- **`/admin`** — Admin dashboard (stats, scraper, telegram, settings)

### 4. API Routes

| Endpoint | Method | Description |
|---|---|---|
| `/api/courses` | GET | List courses (pagination, search, filters) |
| `/api/courses/[slug]` | GET | Get single course + related |
| `/api/scraper` | GET | Get scraper logs |
| `/api/scraper` | POST | Run scraper (source: all/udemyfreebies/studybullet) |
| `/api/telegram` | GET | Get telegram settings + stats |
| `/api/telegram` | POST | Save/test/auto-post telegram |
| `/api/stats` | GET | Dashboard statistics |
| `/api/admin` | POST | Save site settings |

## Deployment

### Vercel (Frontend + API)

```bash
vercel deploy
```

Set environment variables in Vercel dashboard:
- `MONGODB_URI`
- `NEXT_PUBLIC_SITE_URL`

### MongoDB Atlas (Database)

1. Create a free cluster at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Get connection string
3. Set `MONGODB_URI` in `.env.local`

### Scraper Notes

- The scraper runs via API routes (works on Vercel with timeout limits)
- For heavy scraping, use Render.com cron jobs or Oracle Cloud workers
- Each scrape request fetches ~5 pages per source

## Admin Dashboard

Access at `/admin`:

1. **الإحصائيات** — Overview of courses, sources, categories
2. **السكرايبر** — Run manual scrapes, view logs
3. **تليجرام** — Configure bot, manage channels, auto-post
4. **إعدادات** — Site name, description, pagination

## Telegram Multi-Channel

1. Set Bot Token from [@BotFather](https://t.me/BotFather)
2. Add the bot admin to each channel
3. Enter Channel IDs (e.g., `@my_channel`)
4. Customize message template with variables: `{title}`, `{link}`, `{instructor}`, etc.
5. Enable auto-post or trigger manually
