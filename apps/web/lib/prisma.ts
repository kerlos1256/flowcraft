import { PrismaClient } from '@prisma/client';

// Serverless-safe singleton: reuse one client across warm invocations so we
// don't exhaust database connections (Vercel functions). Use the pooled Neon
// connection string (DATABASE_URL) in production.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
