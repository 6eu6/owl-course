import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL!

function createClient() {
  if (connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://')) {
    return new PrismaClient({ adapter: new PrismaPg(connectionString) })
  }
  return new PrismaClient()
}

async function verify() {
  const prisma = createClient()
  try {
    const courses = await prisma.course.count()
    const categories = await prisma.category.count()
    const settings = await prisma.setting.count()

    console.log(`✅ Connected to Prisma Postgres!`)
    console.log(`   Courses: ${courses}`)
    console.log(`   Categories: ${categories}`)
    console.log(`   Settings: ${settings}`)
  } catch (error) {
    console.error('❌ Connection failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verify()
