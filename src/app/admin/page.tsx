'use client'

import Link from 'next/link'

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md mx-auto px-4">
        <div className="text-5xl mb-4">🦉</div>
        <h1 className="text-xl font-bold">Learn Plus Courses</h1>
        <p className="text-sm text-muted-foreground">
          Admin control has been moved to the Telegram Admin Bot for better security.
        </p>
        <div className="p-4 rounded-lg border bg-card text-left space-y-2">
          <p className="text-xs font-semibold">📱 How to control your site:</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Open Telegram and find your Admin Bot</li>
            <li>Send <code className="bg-muted px-1 rounded">/start</code> to see all commands</li>
            <li>Use the bot to manage channels, scraper, posting, and more</li>
          </ol>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 hover:underline"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  )
}
