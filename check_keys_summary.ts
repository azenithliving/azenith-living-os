import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env.local' });

const prisma = new PrismaClient();

async function checkKeys() {
  const stats = await prisma.api_keys.groupBy({
    by: ['provider'],
    _count: { key: true }
  });
  console.log('--- API KEYS REPOSITORY STATUS ---');
  console.log(JSON.stringify(stats, null, 2));
  
  const total = stats.reduce((acc, curr) => acc + curr._count.key, 0);
  console.log(`TOTAL KEYS: ${total}`);

  await prisma.$disconnect();
}

checkKeys();
