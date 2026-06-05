import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://0a176ac15eda304f0c0b7e46fbe592db7bdb37ac1b99ab6dcb8a082c20ec8637:sk_cZakYVO-2jRmivwrF6PRv@db.prisma.io:5432/postgres?sslmode=require"
    }
  }
})

async function main() {
  const result = await db.course.deleteMany({})
  console.log(`Deleted ${result.count} courses`)

  const remaining = await db.course.count()
  console.log(`Remaining: ${remaining} courses`)

  await db.$disconnect()
}

main().catch(console.error)
