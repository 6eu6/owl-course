import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const count = await db.course.count();
console.log(`Found ${count} courses, purging...`);
const result = await db.course.deleteMany();
console.log(`Purged ${result.count} courses!`);
await db.$disconnect();
