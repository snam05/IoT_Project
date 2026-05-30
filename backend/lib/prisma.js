import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// Parse DATABASE_URL: mysql://user:pass@host:port/dbname
function parseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port) || 4000,
    user: u.username,
    password: u.password,
    database: u.pathname.slice(1),
    // TiDB requires SSL
    ssl: u.searchParams.get('ssl') !== 'false' ? {} : false,
    connectionLimit: 20,
    idleTimeout: 30000,
    acquireTimeout: 30000,
  };
}

// Prevent multiple instances in development (hot-reload)
const globalForPrisma = globalThis;

function createPrisma() {
  const config = parseUrl(process.env.DATABASE_URL);
  const adapter = new PrismaMariaDb(config);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
