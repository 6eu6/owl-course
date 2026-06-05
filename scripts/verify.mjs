import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const total = await db.course.count();
const withCoupon = await db.course.count({ where: { couponCode: { not: '' } } });
const withExpiry = await db.course.count({ where: { couponExpiresAt: { not: null } } });
const uniqueBaseUrls = new Set();
const all = await db.course.findMany({ select: { udemyUrl: true, couponCode: true } });
for (const c of all) uniqueBaseUrls.add(c.udemyUrl);

console.log(`=== FINAL VERIFICATION ===`);
console.log(`Total courses: ${total}`);
console.log(`With valid coupon: ${withCoupon}`);
console.log(`With expiry date: ${withExpiry}`);
console.log(`Unique base URLs: ${uniqueBaseUrls.size}`);
console.log(`URL/coupon ratio: ${total}/${uniqueBaseUrls.size} (1:1 means no URL+coupon dup)`);

// Show some sample coupon codes
const samples = await db.course.findMany({
  take: 5,
  orderBy: { scrapedAt: 'desc' },
  select: { title: true, udemyUrl: true, couponCode: true, couponUrl: true },
});
console.log('\n=== SAMPLE DATA ===');
for (const s of samples) {
  const udemyHasCoupon = s.udemyUrl.includes('couponCode') || s.udemyUrl.includes('coupon');
  console.log(`[${udemyHasCoupon ? 'BUG' : 'OK'}] ${s.title.substring(0, 45)}...`);
  console.log(`  Base URL: ${s.udemyUrl.substring(0, 60)}`);
  console.log(`  Coupon:   ${s.couponCode}`);
  console.log(`  Full URL: ${s.couponUrl.substring(0, 70)}...`);
}

await db.$disconnect();
