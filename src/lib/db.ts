import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Prevent multiple Prisma Client instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

// Create pg connection pool
const pool = globalForPrisma.pool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Create Prisma client with adapter
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

export default prisma;
