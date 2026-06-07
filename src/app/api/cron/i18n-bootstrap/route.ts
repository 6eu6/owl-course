import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// =============================================================================
// TEMPORARY i18n migration endpoint — Learn Plus Courses
// -----------------------------------------------------------------------------
// Creates the CourseTranslation and TelegramPost tables (+ indexes + foreign
// keys) matching the Prisma schema. The scheduler (Oracle) only hits HTTPS
// endpoints and cannot run Prisma, and the Vercel build only runs
// `prisma generate` (never a schema push).
//
// DDL runs through MIGRATION_DATABASE_URL (a connection string for a role that
// owns / can CREATE in the public schema), NOT the runtime DATABASE_URL, which
// is permission-restricted (it raised 42501 "permission denied for schema
// public"). Runtime Prisma keeps using DATABASE_URL untouched.
//
// It is:
//   - Idempotent: CREATE TABLE/INDEX IF NOT EXISTS; foreign keys are added only
//     when missing. Safe to call repeatedly.
//   - Non-destructive: no DROP / destructive ALTER. Never touches existing rows.
//   - Protected by CRON_SECRET (falls back to ADMIN_PASSWORD).
//   - Secret-safe: never echoes any connection string or env value.
//
// GET /api/cron/i18n-bootstrap?secret=CRON_SECRET
//
// TODO(i18n): remove this route (and MIGRATION_DATABASE_URL) once the migration
// has been applied in production and confirmed (tables present, translate +
// post cron green).
// =============================================================================

// Each statement is run on its own. CREATE ... IF NOT EXISTS is naturally
// idempotent; ADD CONSTRAINT is not, so those are tagged and their
// "already exists" error (Postgres 42710 / 42P07) is swallowed.
const STATEMENTS: Array<{ label: string; sql: string; ignoreDuplicate?: boolean }> = [
  {
    label: 'CourseTranslation table',
    sql: `CREATE TABLE IF NOT EXISTS "CourseTranslation" (
      "id" TEXT NOT NULL,
      "courseId" TEXT NOT NULL,
      "locale" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "requirements" TEXT NOT NULL DEFAULT '',
      "whoFor" TEXT NOT NULL DEFAULT '',
      "whatLearn" TEXT NOT NULL DEFAULT '',
      "category" TEXT NOT NULL DEFAULT 'Other',
      "metaTitle" TEXT NOT NULL DEFAULT '',
      "metaDescription" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'pending',
      "error" TEXT,
      "translatedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CourseTranslation_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    label: 'CourseTranslation_courseId_locale_key',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "CourseTranslation_courseId_locale_key" ON "CourseTranslation"("courseId", "locale")`,
  },
  {
    label: 'CourseTranslation_locale_slug_key',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "CourseTranslation_locale_slug_key" ON "CourseTranslation"("locale", "slug")`,
  },
  {
    label: 'CourseTranslation_locale_status_idx',
    sql: `CREATE INDEX IF NOT EXISTS "CourseTranslation_locale_status_idx" ON "CourseTranslation"("locale", "status")`,
  },
  {
    label: 'CourseTranslation_courseId_idx',
    sql: `CREATE INDEX IF NOT EXISTS "CourseTranslation_courseId_idx" ON "CourseTranslation"("courseId")`,
  },
  {
    label: 'TelegramPost table',
    sql: `CREATE TABLE IF NOT EXISTS "TelegramPost" (
      "id" TEXT NOT NULL,
      "courseId" TEXT NOT NULL,
      "locale" TEXT NOT NULL,
      "channelId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'sent',
      "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "error" TEXT,
      CONSTRAINT "TelegramPost_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    label: 'TelegramPost_courseId_locale_channelId_key',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "TelegramPost_courseId_locale_channelId_key" ON "TelegramPost"("courseId", "locale", "channelId")`,
  },
  {
    label: 'TelegramPost_locale_status_idx',
    sql: `CREATE INDEX IF NOT EXISTS "TelegramPost_locale_status_idx" ON "TelegramPost"("locale", "status")`,
  },
  {
    label: 'TelegramPost_courseId_idx',
    sql: `CREATE INDEX IF NOT EXISTS "TelegramPost_courseId_idx" ON "TelegramPost"("courseId")`,
  },
  {
    label: 'CourseTranslation_courseId_fkey',
    sql: `ALTER TABLE "CourseTranslation" ADD CONSTRAINT "CourseTranslation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    ignoreDuplicate: true,
  },
  {
    label: 'TelegramPost_courseId_fkey',
    sql: `ALTER TABLE "TelegramPost" ADD CONSTRAINT "TelegramPost_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    ignoreDuplicate: true,
  },
];

function isDuplicateObject(error: unknown): boolean {
  const e = error as { code?: string; meta?: { code?: string }; message?: string };
  const code = e?.code || e?.meta?.code;
  if (code === '42710' || code === '42P07') return true; // duplicate_object / duplicate_table
  return /already exists/i.test(String(e?.message || ''));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';
  if (expected && secret !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // DDL must run through a privileged connection. The runtime DATABASE_URL is
  // permission-restricted and cannot CREATE in the public schema.
  const migrationUrl = process.env.MIGRATION_DATABASE_URL || '';
  if (!migrationUrl) {
    return NextResponse.json(
      {
        success: false,
        error: 'MIGRATION_DATABASE_URL is required because DATABASE_URL does not have schema permissions.',
      },
      { status: 400 }
    );
  }

  // Dedicated client for the migration only. A direct (non-Accelerate) Postgres
  // URL for an owner/admin role is expected here.
  const migrationDb = new PrismaClient({
    datasources: { db: { url: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL } },
  });

  try {
    const applied: string[] = [];
    const skipped: string[] = [];

    for (const stmt of STATEMENTS) {
      try {
        await migrationDb.$executeRawUnsafe(stmt.sql);
        applied.push(stmt.label);
      } catch (e) {
        if (stmt.ignoreDuplicate && isDuplicateObject(e)) {
          skipped.push(stmt.label);
          continue;
        }
        throw e;
      }
    }

    // Confirm the tables are present (do not leak any connection details).
    const present = await migrationDb.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('CourseTranslation', 'TelegramPost')`
    );
    const names = new Set(present.map((r) => r.table_name));

    return NextResponse.json({
      success: true,
      applied,
      skipped,
      tables: {
        CourseTranslation: names.has('CourseTranslation'),
        TelegramPost: names.has('TelegramPost'),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  } finally {
    await migrationDb.$disconnect();
  }
}
