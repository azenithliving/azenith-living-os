import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env.local' });

const prisma = new PrismaClient();

async function seedAdminMetrics() {
  const companyId = "00000000-0000-0000-0000-000000000001";
  console.log("Seeding Admin Metrics tables (public_users/requests) for localhost...");

  // 1. Seed Public Users (as leads)
  const user = await prisma.public_users.create({
    data: {
      email: 'ahmed.mansour@example.com',
      company_id: companyId,
      score: 85,
      room_type: 'مجلس رجال',
      style: 'نيوكلاسيك',
      session_id: 'test_session_1',
      intent: 'browsing'
    },
  });
  console.log("User (Lead) seeded:", user.id);

  // 2. Seed Requests
  const request = await prisma.requests.create({
    data: {
      company_id: companyId,
      user_id: user.id,
      room_type: 'مجلس رجال',
      style: 'نيوكلاسيك',
      status: 'accepted',
      created_at: new Date()
    }
  });
  console.log("Request seeded:", request.id);

  // 3. Seed some events for conversion
  await prisma.events.createMany({
    data: [
      {
        company_id: companyId,
        type: 'whatsapp_click',
        metadata: { source: 'landing_page' }
      },
      {
        company_id: companyId,
        type: 'form_submit',
        metadata: { form: 'lead_gen' }
      }
    ]
  });
  console.log("Analytics events seeded.");

  await prisma.$disconnect();
}

seedAdminMetrics().catch(e => {
  console.error(e);
  process.exit(1);
});
