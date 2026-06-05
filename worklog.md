---
Task ID: 1
Agent: Main Agent
Task: Fix scraper accuracy - coupon verification, dedup update, frontend verification

Work Log:
- Analyzed root causes: verifyCouponOnUdemy() was defined but never called, no coupon update on dedup, no real-time verification
- Rewrote scraper.ts to add actual coupon verification during scraping
- Improved verifyCouponOnUdemy() to check JSON data blocks in <script> tags for pricing info
- Added upsertCourseCoupon() to mongodb.ts for updating existing courses with new coupons
- Changed dedup logic to UPDATE coupons instead of skip when duplicate found
- Added verification sampling: pages 1-3 verify all, pages 4+ sample 30%, month/year coupons always verified
- Reduced batch size to 5 for verification to respect rate limits
- Added rate-limit detection (429 -> 5s backoff)
- Created POST /api/courses/[slug] endpoint for real-time coupon verification
- Updated LinkPage with real-time coupon status checking during countdown
- LinkPage now shows: green "Coupon Active" / red "Coupon Expired" / amber "Verifying..." banners
- Fixed coupon URL construction to ensure couponCode param is always included
- Added coupon code display in LinkPage
- Connected to Prisma Postgres successfully
- Lint passes with no errors

Stage Summary:
- All 4 root causes fixed: verification enabled, dedup updates coupons, real-time API, frontend shows honest status
- Database connected to Prisma Postgres
- Old data should be purged and re-scraped with verification enabled
