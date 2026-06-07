// Render scraped "a • b • c" (or newline-separated) text as a clean bullet list.
export function BulletList({ text }: { text: string }) {
  const items = text
    .split(/\s*[•·▪►]\s*|\n+/)
    .map((s) => s.replace(/^[-*\s]+/, '').trim())
    .filter((s) => s.length > 1)

  if (items.length <= 1) {
    return (
      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
        {text}
      </p>
    )
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
