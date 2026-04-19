import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- [فحص قاعدة البيانات: الجلسات الأخيرة] ---');
  
  const sessions = await prisma.consultant_sessions.findMany({
    orderBy: { created_at: 'desc' },
    limit: 1
  });

  if (sessions.length > 0) {
    const s = sessions[0];
    console.log(`ID الجلسة: ${s.session_id}`);
    console.log(`تاريخ البدء: ${s.created_at}`);
    console.log('المحادثة:');
    s.messages.forEach((m: any) => {
      console.log(` - [${m.role}]: ${m.content}`);
    });
    console.log('\nتحليلات الذكاء الاصطناعي (Insights):');
    console.log(JSON.stringify(s.insights, null, 2));
  } else {
    console.log('لم يتم العثور على جلسات بعد.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
