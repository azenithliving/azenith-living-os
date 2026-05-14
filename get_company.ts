import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env.local' });

const prisma = new PrismaClient();

async function getCompany() {
  const company = await prisma.companies.findFirst();
  console.log("COMPANY:", JSON.stringify(company));
  await prisma.$disconnect();
}

getCompany();
