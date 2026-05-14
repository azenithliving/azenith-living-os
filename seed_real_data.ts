import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env.local' });

const prisma = new PrismaClient();
const companyId = "dbb9b420-f2ec-4dd3-88d6-4d1a9a74364d";

async function seed() {
  console.log("Seeding real operational data...");

  try {
    // 1. Seed Sales Orders
    const order1 = await prisma.sales_orders.create({
      data: {
        company_id: companyId,
        status: "processing",
        total_amount: 15000,
        customer_name: "أحمد منصور",
        items: [{ name: "طاولة خشب طبيعي", price: 15000 }] as any,
        created_at: new Date()
      }
    });
    console.log("Sales Order seeded:", order1.id);

    // 2. Seed Consultant Sessions (which show up as Leads)
    const session1 = await prisma.consultant_sessions.create({
      data: {
        company_id: companyId,
        session_id: "test-session-" + Date.now(),
        messages: [
          { role: "user", content: "أهلا، أنا اسمي أحمد ومهتم بطاولة خشب" },
          { role: "assistant", content: "أهلا بك يا أحمد، كيف يمكنني مساعدتك؟" }
        ] as any,
        insights: {
          roomType: "Living Room",
          budget: "15 الف",
          location: "القاهرة",
          summary: "أحمد مهتم بطاولة خشب طبيعي"
        } as any,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    console.log("Consultant Session seeded:", session1.id);

    // 3. Seed Inventory Items
    const item1 = await prisma.inventory_items.create({
      data: {
        company_id: companyId,
        name: "خشب زان",
        sku: "WOOD-ZAN-001",
        current_quantity: 5,
        min_stock_level: 10,
        unit_of_measure: "meter",
        is_active: true
      }
    });
    console.log("Inventory Item seeded:", item1.id);

    console.log("Seeding complete.");
  } catch (err: any) {
    console.error("Prisma Seed Error:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
