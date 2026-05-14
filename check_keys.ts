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
  
  const mistralPreview = await prisma.api_keys.findMany({
    where: { provider: 'mistral' },
    take: 3,
    orderBy: { created_at: 'desc' }
  });
  console.log('--- LATEST MISTRAL KEYS ---');
  console.log(JSON.stringify(mistralPreview, null, 2));

  await prisma.$disconnect();
}

checkKeys();
