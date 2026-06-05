import { PrismaClient } from '@prisma/client';
import { runFullScrape } from '../src/lib/scraper.ts';

const db = new PrismaClient();

// 1. Purge
const count = await db.course.count();
console.log(`Purging ${count} existing courses...`);
await db.course.deleteMany();
console.log('DB purged!');

// 2. Scrape fresh
console.log('\nStarting fresh scrape (5 pages, udemyfreebies)...');
const results = await runFullScrape({
  pages: 5,
  sources: ['udemyfreebies'],
});

console.log('\n=== RESULTS ===');
console.log(`New: ${results.totalNew}, Dup: ${results.totalDup}, Err: ${results.totalErr}`);
console.log(`Duration: ${(results.totalDuration / 1000).toFixed(1)}s`);
console.log(`UdemyFreebies details: new=${results.udemyfreebies.newCount}, dup=${results.udemyfreebies.dupCount}, expired=${results.udemyfreebies.expiredCount}`);

await db.$disconnect();
