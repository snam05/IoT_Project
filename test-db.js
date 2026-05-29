import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function parseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port) || 4000,
    user: u.username,
    password: u.password,
    database: u.pathname.slice(1),
    ssl: {}, // TiDB Cloud requires SSL
  };
}

async function test() {
  console.log('Testing connection to TiDB Cloud...');
  const url = process.env.DATABASE_URL;
  console.log('URL:', url ? 'Defined' : 'UNDEFINED');
  if (!url) return;

  const config = parseUrl(url);
  console.log('Config parsed:', {
    host: config.host,
    port: config.port,
    user: config.user,
    database: config.database,
    ssl: typeof config.ssl,
  });

  try {
    const adapter = new PrismaMariaDb(config);
    const prisma = new PrismaClient({ adapter });
    
    console.log('Connecting to database...');
    const result = await prisma.$queryRaw`SELECT 1 as connected;`;
    console.log('Success!', result);
    await prisma.$disconnect();
  } catch (err) {
    console.error('Error during connection test:', err);
  }
}

test();
