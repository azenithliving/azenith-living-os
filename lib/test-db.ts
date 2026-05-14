import { prisma } from '../aaca/database/prisma-client.ts';

async function main() {
  console.log('Testing database connection via shared Prisma client...');
  try {
    // Check auth schema
    const userCount = await prisma.auth_users.count();
    console.log(`- Database connection successful.`);
    console.log(`- Auth User count: ${userCount}`);
    
    // Check public schema
    const configCount = await prisma.agent_configuration.count();
    console.log(`- Agent configuration count: ${configCount}`);
    
    // Check a message count if it exists
    const messageCount = await prisma.agent_messages.count();
    console.log(`- Agent messages count: ${messageCount}`);

    console.log('\n✅ DATABASE AUDIT PASSED 100%');
    console.log('Prisma is correctly configured for Multi-Schema access.');
  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
