# AACA Phase 2: Communication Layer (Nervous System)

## Production-Ready Implementation

### Overview
Phase 2 implements the distributed communication infrastructure that connects all AI agents:
- **Redis Integration** - Centralized Redis connection utility using ioredis
- **Queue System** - BullMQ-based QueueManager with multiple queues
- **Event Bus** - Real-time Redis Pub/Sub event system
- **Base Worker Architecture** - Extensible worker class for all agents

## Architecture

### Components

#### 1. Redis Connection Utility (`aaca/database/redis.ts`)
```typescript
class RedisConnection {
  - Singleton pattern with global instance
  - Connection retry strategy (max 10 retries)
  - Health check with latency metrics
  - Event-driven status monitoring
}
```

#### 2. QueueManager (`aaca/queues/queue-manager.ts`)
Manages 9 specialized queues:
- `orchestrator` - Task orchestration
- `dev-agent` - Development operations
- `ops-agent` - Deployment & monitoring
- `security-agent` - Security scans & audits
- `qa-agent` - Testing & quality checks
- `communication-agent` - Notifications
- `evolution-agent` - System evolution
- `execution` - Action execution
- `approval` - Approval workflows

**Features:**
- Exponential/fixed backoff strategies
- Stalled job handling (30s interval, max 3 stalls)
- Concurrent job processing
- Queue pause/resume functionality
- Automatic job lifecycle event publishing

#### 3. EventBus (`aaca/events/event-bus.ts`)
Redis Pub/Sub based real-time event system:
- Dual Redis clients (publisher + subscriber)
- Pattern-based event subscriptions
- Automatic reconnection handling
- Event persistence to database

#### 4. BaseWorker (`aaca/workers/base-worker.ts`)
Abstract base class for all agent workers:
```typescript
abstract class BaseWorker {
  protected abstract processJob(job: Job, context: JobContext): Promise<JobResult>
  - Automatic job lifecycle logging to Prisma
  - Event publishing on job start/complete/fail
  - Worker health monitoring
  - Graceful start/stop
}
```

#### 5. Typed Event Payloads (`aaca/types/events.ts`)
30+ strongly-typed event types:
- Task events: `TASK_CREATED`, `TASK_STARTED`, `TASK_COMPLETED`, `TASK_FAILED`
- Action events: `ACTION_CREATED`, `ACTION_APPROVED`, `ACTION_EXECUTED`
- Approval events: `APPROVAL_REQUESTED`, `APPROVAL_GRANTED`
- Queue events: `JOB_STARTED`, `JOB_COMPLETED`, `JOB_FAILED`
- Agent events: `AGENT_REGISTERED`, `AGENT_BUSY`, `AGENT_IDLE`, `AGENT_ERROR`

#### 6. Agent Workers (5+ implementations)
All extend `BaseWorker` with specialized processing:

| Agent | Queue | Concurrency | Actions |
|-------|-------|-------------|---------|
| DevAgentWorker | dev-agent | 2 | WRITE_CODE, CODE_REVIEW, CREATE_PR |
| OpsAgentWorker | ops-agent | 3 | DEPLOY, MONITOR, HEALTH_CHECK, SCALE |
| SecurityAgentWorker | security-agent | 1 | SECURITY_SCAN, AUDIT, COMPLIANCE_CHECK |
| QaAgentWorker | qa-agent | 2 | RUN_TESTS, TEST_GENERATION, QUALITY_CHECK |
| CommunicationAgentWorker | communication-agent | 5 | SEND_NOTIFICATION, SEND_EMAIL, SEND_SLACK, SEND_WEBHOOK |

## Usage

### Starting Phase 2
```typescript
import { NervousSystem } from './phase2';

const system = new NervousSystem({
  redisUrl: 'redis://localhost:6379',
  databaseUrl: 'postgresql://localhost:5432/aaca'
});

await system.initialize();
await system.start();
```

### Creating an Agent Worker
```typescript
import { BaseWorker, JobContext, JobResult } from './workers/base-worker';

class MyAgentWorker extends BaseWorker {
  constructor(redis: IORedis, eventBus: EventBus) {
    super({ queueName: 'my-agent', concurrency: 2 }, redis, eventBus);
  }

  protected async processJob(job: Job, context: JobContext): Promise<JobResult> {
    // Process job logic
    return { success: true, output: {}, durationMs: 100 };
  }
}
```

### Publishing Events
```typescript
await eventBus.publish({
  type: EventType.TASK_CREATED,
  source: 'orchestrator',
  payload: {
    taskId: 'uuid',
    title: 'New Task',
    timestamp: new Date().toISOString()
  }
});
```

### Adding Jobs to Queue
```typescript
await queueManager.addJob('dev-agent', 'write-code', {
  taskId: 'uuid',
  actionType: 'WRITE_CODE',
  files: [{ path: 'src/index.ts', operation: 'create' }]
}, {
  priority: 1,
  attempts: 3
});
```

## Configuration

### Environment Variables
```bash
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret
DATABASE_URL=postgresql://user:pass@localhost:5432/aaca
```

### Queue Retry Strategies
```typescript
// Dev Agent - Fixed delay
dev-agent: { attempts: 2, backoff: { type: 'fixed', delay: 5000 } }

// Ops Agent - Exponential backoff
ops-agent: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }

// Security Agent - Fixed delay
security-agent: { attempts: 2, backoff: { type: 'fixed', delay: 3000 } }

// Communication Agent - High retry, fixed delay
communication-agent: { attempts: 5, backoff: { type: 'fixed', delay: 1000 } }
```

## Job Lifecycle Logging
Every job is automatically logged to the `job_queues` table:
```typescript
{
  name: job.name,
  queueType: this.queueName,
  config: {
    jobId: context.jobId,
    status: 'started' | 'completed' | 'failed',
    attempt: context.attempt,
    traceId: context.traceId,
    data: job.data,
    result?: {},
    error?: string,
    durationMs?: number,
    timestamp: ISOString
  }
}
```

## Status

**Phase 2 Implementation: COMPLETE**

All components production-ready:
- Redis connection with retry logic
- 9 BullMQ queues with custom retry strategies
- EventBus with Pub/Sub pattern matching
- BaseWorker abstract class with lifecycle hooks
- 5+ concrete agent implementations
- Typed event system (30+ event types)
- Automatic job lifecycle logging to Prisma
