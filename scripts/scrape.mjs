// Import scraper and run it
import { runFullScrape } from '../src/lib/scraper.ts';

console.log('Starting scrape (5 pages, udemyfreebies only)...');
const results = await runFullScrape({
  pages: 5,
  sources: ['udemyfreebies'],
});

console.log('\n=== SCRAPE RESULTS ===');
console.log(`Total new: ${results.totalNew}`);
console.log(`Total duplicates: ${results.totalDup}`);
console.log(`Total errors: ${results.totalErr}`);
console.log(`Duration: ${(results.totalDuration / 1000).toFixed(1)}s`);
console.log(`UdemyFreebies: ${JSON.stringify(results.udemyfreebies, null, 2)}`);
