import { PrismaClient, UserRole, TaskType, TaskStatus, TaskPriority, ActionType, ActionStatus, ApprovalStatus, WorkflowStatus, LogLevel, CapabilityStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // 1. Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@azenith.ai' },
    update: {},
    create: {
      email: 'admin@azenith.ai',
      name: 'System Administrator',
      role: UserRole.ADMIN,
      permissions: ['*'],
      isActive: true
    }
  });
  console.log('✅ Created admin user:', admin.email);

  // 2. Create system user (for automated tasks)
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@azenith.ai' },
    update: {},
    create: {
      email: 'system@azenith.ai',
      name: 'AACA System',
      role: UserRole.SYSTEM,
      permissions: ['*'],
      isActive: true
    }
  });
  console.log('✅ Created system user:', systemUser.email);

  // 3. Create operator user
  const operator = await prisma.user.upsert({
    where: { email: 'operator@azenith.ai' },
    update: {},
    create: {
      email: 'operator@azenith.ai',
      name: 'AI Operator',
      role: UserRole.OPERATOR,
      permissions: ['task:read', 'task:write', 'approval:give'],
      isActive: true
    }
  });
  console.log('✅ Created operator user:', operator.email);

  // 4. Create security officer
  const securityOfficer = await prisma.user.upsert({
    where: { email: 'security@azenith.ai' },
    update: {},
    create: {
      email: 'security@azenith.ai',
      name: 'Security Officer',
      role: UserRole.SECURITY_OFFICER,
      permissions: ['security:*', 'approval:give'],
      isActive: true
    }
  });
  console.log('✅ Created security officer:', securityOfficer.email);

  // 5. Create sample workflow
  const sampleWorkflow = await prisma.workflow.upsert({
    where: { id: 'workflow-sample-001' },
    update: {},
    create: {
      id: 'workflow-sample-001',
      name: 'CI/CD Pipeline',
      description: 'Continuous Integration and Deployment workflow',
      definition: {
        steps: [
          { id: '1', type: 'TEST', dependencies: [] },
          { id: '2', type: 'BUILD', dependencies: ['1'] },
          { id: '3', type: 'DEPLOY', dependencies: ['2'] }
        ]
      },
      status: WorkflowStatus.ACTIVE,
      version: 1
    }
  });
  console.log('✅ Created sample workflow:', sampleWorkflow.name);

  // 6. Create sample task
  const sampleTask = await prisma.aITask.create({
    data: {
      title: 'Initialize System',
      description: 'System initialization and health check',
      type: TaskType.MONITORING,
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      payload: { action: 'system_init' },
      result: { status: 'success', initialized: true },
      createdById: systemUser.id,
      workflowId: sampleWorkflow.id,
      startedAt: new Date(),
      completedAt: new Date()
    }
  });
  console.log('✅ Created sample task:', sampleTask.title);

  // 7. Create sample action
  const sampleAction = await prisma.aIAction.create({
    data: {
      type: ActionType.CUSTOM,
      status: ActionStatus.COMPLETED,
      taskId: sampleTask.id,
      payload: { command: 'init' },
      result: { success: true },
      riskScore: 10,
      requiresApproval: false,
      executedById: systemUser.id,
      executedAt: new Date(),
      completedAt: new Date()
    }
  });
  console.log('✅ Created sample action:', sampleAction.id);

  // 8. Create system logs
  await prisma.systemLog.createMany({
    data: [
      { level: LogLevel.INFO, service: 'seed', message: 'Database seed started', metadata: { timestamp: new Date().toISOString() } },
      { level: LogLevel.INFO, service: 'seed', message: 'Users created successfully', metadata: { count: 4 } },
      { level: LogLevel.INFO, service: 'seed', message: 'Workflows created successfully', metadata: { count: 1 } },
      { level: LogLevel.INFO, service: 'seed', message: 'Database seed completed', metadata: { timestamp: new Date().toISOString() } }
    ]
  });
  console.log('✅ Created system logs');

  // 9. Create job queue entries
  await prisma.jobQueue.createMany({
    data: [
      { name: 'dev-agent', queueType: 'agent', config: { concurrency: 2 } },
      { name: 'ops-agent', queueType: 'agent', config: { concurrency: 2 } },
      { name: 'security-agent', queueType: 'agent', config: { concurrency: 1 } },
      { name: 'qa-agent', queueType: 'agent', config: { concurrency: 2 } },
      { name: 'communication-agent', queueType: 'agent', config: { concurrency: 3 } },
      { name: 'evolution-agent', queueType: 'agent', config: { concurrency: 1 } },
      { name: 'execution', queueType: 'system', config: { concurrency: 2 } },
      { name: 'approval', queueType: 'system', config: { concurrency: 1 } }
    ],
    skipDuplicates: true
  });
  console.log('✅ Created job queue entries');

  console.log('\n✨ Database seed completed successfully!');
  console.log('\nSummary:');
  console.log('  - Users: 4 (admin, system, operator, security)');
  console.log('  - Workflows: 1');
  console.log('  - Tasks: 1');
  console.log('  - Actions: 1');
  console.log('  - Job Queues: 8');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
