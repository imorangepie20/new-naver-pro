// Prisma Client Singleton
// 개발 환경에서 Hot Reload 시 여러 인스턴스가 생성되는 것을 방지

import { PrismaClient } from '@prisma/client';
import { loadProjectEnv } from '../env/load-project-env';

loadProjectEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
