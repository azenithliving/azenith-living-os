import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env.local' });

const prisma = new PrismaClient();

async function checkTenant() {
  const company = await prisma.companies.findFirst({
    where: { domain: 'localhost' }
  });
  console.log('--- COMPANY FOR localhost ---');
  console.log(JSON.stringify(company, null, 2));
  
  const totalLeads = await prisma.public_users.count({
    where: { company_id: company?.id }
  });
  console.log('Total Leads for this company:', totalLeads);

  const totalTasks = await prisma.aITask.count({
    where: { company_id: company?.id }
  });
  console.log('Total AACA Tasks for this company:', totalTasks);
  
  await prisma.$disconnect();
}

checkTenant();
