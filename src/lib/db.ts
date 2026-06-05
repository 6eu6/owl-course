import { PrismaClient } from '@prisma/client'

// Load .env file explicitly to ensure correct DATABASE_URL
import { config } from 'dotenv'
config()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL || ''
  
  // For Prisma Postgres (db.prisma.io), add connection pool limits
  let url = connectionString
  if (connectionString.includes('db.prisma.io')) {
    const separator = connectionString.includes('?') ? '&' : '?'
    url = `${connectionString}${separator}connection_limit=1&pool_timeout=10`
  }
  
  return new PrismaClient({
    datasources: {
      db: { url },
    },
  })
}

export const db =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
