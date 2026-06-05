import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const courses = await db.course.findMany({
  take: 5,
  orderBy: { scrapedAt: 'desc' },
});

console.log(`Total courses: ${await db.course.count()}`);
console.log('\n=== First 5 courses ===\n');

for (const c of courses) {
  console.log(`Title: ${c.title.substring(0, 50)}...`);
  console.log(`  udemyUrl (base): ${c.udemyUrl.substring(0, 60)}...`);
  console.log(`  couponCode: ${c.couponCode}`);
  console.log(`  couponUrl: ${c.couponUrl ? c.couponUrl.substring(0, 80) + '...' : 'NULL'}`);
  console.log(`  couponVerified: ${c.couponVerified}`);
  console.log(`  isFreeForever: ${c.isFreeForever}`);
  console.log(`  couponExpiresAt: ${c.couponExpiresAt}`);
  console.log('');
}

// Check if udemyUrl contains couponCode (it shouldn't!)
const badUrls = await db.course.findMany({
  where: {
    OR: [
      { udemyUrl: { contains: 'couponCode' } },
      { udemyUrl: { contains: 'coupon' } },
    ],
  },
});
console.log(`Courses with coupon in udemyUrl (BUG): ${badUrls.length}`);

// Check coupon code quality
const noCoupon = await db.course.count({
  where: {
    OR: [
      { couponCode: '' },
      { couponCode: { isEmpty: true } },
    ],
  },
});
console.log(`Courses without coupon code: ${noCoupon}`);

await db.$disconnect();
