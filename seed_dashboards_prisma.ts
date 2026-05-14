import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env.local' });

const prisma = new PrismaClient();

async function seed() {
  console.log("Seeding operational data via Prisma...");

  try {
    // 1. Seed Orders
    const order1 = await prisma.order.create({
      data: {
        status: "processing",
        totalAmount: 15000,
        customerName: "أحمد منصور",
        items: [{ name: "طاولة خشب طبيعي", price: 15000 }] as any
      }
    });
    console.log("Order seeded:", order1.id);

    // 2. Seed Customer Leads
    const lead1 = await prisma.customerLead.create({
      data: {
        name: "سارة محمود",
        email: "sara@example.com",
        phone: "201091234567",
        status: "new",
        score: 85,
        context: { interest: "Modern Living Rooms" } as any
      }
    });
    console.log("Lead seeded:", lead1.id);

    console.log("Seeding complete via Prisma.");
  } catch (err: any) {
    console.error("Prisma Seed Error:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
