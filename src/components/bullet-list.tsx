// Render scraped long-form course text as readable bullets instead of one messy paragraph.
// Scraped sources are inconsistent: sometimes items are separated with bullets,
// emojis, newlines, sentence boundaries, or glued headings like
// "Course Structure:Understanding SMART Goals:". This component normalizes those
// shapes at display time so existing saved courses improve without re-scraping.

const MARKER_RE = /[•·▪►●◦▪️🔹🔸✅✔️☑️🎯🛑❤️❤🗣️👂📌⭐]/gu;
const HEADING_RE = /[A-Z][A-Za-z0-9&’'(),/\- ]{2,86}:/g;

function cleanItem(value: string): string {
  return value
    .replace(MARKER_RE, '')
    .replace(/^[-*\s:;,.]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeScrapedText(text: string): string {
  return String(text || '')
    .replace(/\r/g, '\n')
    // Fix common source glitches where two sentences/headings are glued.
    .replace(/([.!?])([A-Z])/g, '$1\n$2')
    .replace(/([a-z0-9)])([A-Z][A-Za-z][A-Za-z0-9&’'(),/\- ]{2,86}:)/g, '$1\n$2')
    .replace(/:([A-Z])/g, ': $1')
    // Emojis are often used as section bullets in scraped WordPress text.
    .replace(MARKER_RE, (m) => `\n${m} `)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitByVisibleSeparators(text: string): string[] {
  return normalizeScrapedText(text)
    .split(/\n+|\s*[•·▪►●◦]\s*/)
    .map(cleanItem)
    .filter((item) => item.length > 1);
}

function splitLongHeadingText(text: string): string[] {
  const normalized = normalizeScrapedText(text);
  const matches = [...normalized.matchAll(HEADING_RE)];
  if (matches.length < 2) return [];

  const parts: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? normalized.length) : normalized.length;
    const part = cleanItem(normalized.slice(start, end));
    if (part.length > 1) parts.push(part);
  }
  return parts;
}

function splitSentences(text: string): string[] {
  return normalizeScrapedText(text)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(cleanItem)
    .filter((item) => item.length > 24);
}

function getBulletItems(text: string): string[] {
  const separated = splitByVisibleSeparators(text);

  // If the visible separators already produced useful chunks, keep them but
  // further split any very long item that contains multiple pasted headings.
  if (separated.length > 1) {
    return separated.flatMap((item) => {
      if (item.length < 340) return [item];
      const byHeading = splitLongHeadingText(item);
      return byHeading.length > 1 ? byHeading : [item];
    });
  }

  // Many scraped descriptions are one huge paragraph with repeated "Heading:"
  // blocks. Convert those to bullets even when there are no literal separators.
  const byHeading = splitLongHeadingText(text);
  if (byHeading.length > 1) return byHeading;

  // Last resort for extremely long plain paragraphs: split into sentences so the
  // page remains readable on mobile. Short normal descriptions remain paragraphs.
  if (String(text || '').length > 420) {
    const sentences = splitSentences(text);
    if (sentences.length > 2) return sentences;
  }

  return separated;
}

export function BulletList({ text }: { text: string }) {
  const items = getBulletItems(text);

  if (items.length <= 1) {
    return (
      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
        {cleanItem(text)}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/80" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
