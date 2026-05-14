import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env.local' });

const prisma = new PrismaClient();

async function check() {
  try {
    console.log("Checking tables via Prisma...");
    
    // Check if we can query orders
    const ordersCount = await prisma.order.count();
    console.log("Orders count:", ordersCount);

    const leadsCount = await prisma.customerLead.count();
    console.log("Leads count:", leadsCount);

    const tasksCount = await prisma.aITask.count();
    console.log("AI Tasks count:", tasksCount);

  } catch (err: any) {
    console.error("Prisma Error:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
