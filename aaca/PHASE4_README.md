# AACA Phase 4: Full System Integration

## Production-Ready Implementation

### Overview
Phase 4 integrates all previous phases into a cohesive, production-ready autonomous company AI system:
- **Phase 1** (Foundation): Database layer with Prisma
- **Phase 2** (Nervous System): Queue & Event system with Redis/BullMQ
- **Phase 3** (The Brains): 7 specialized AI agents
- **Phase 4** (Integration): Execution Engine, Approval System, and API

## Architecture

### Phase 4 Components

#### 1. Execution Engine (`aaca/execution/execution-engine.ts`)
Handles safe execution of AI actions with rollback capabilities:
- **Code Execution**: Write files, create patches, Git operations
- **Command Execution**: Shell commands with safety checks
- **Deployment**: Multi-strategy deployments (rolling, blue-green, canary)
- **Rollback**: Automatic rollback on failure

**Safety Features:**
- Dry-run mode for testing
- Timeout protection (default: 5 minutes)
- Approval verification for high-risk actions
- Execution logging and audit trails

```typescript
const result = await executionEngine.executeAction(action, context, {
  timeoutMs: 300000,
  dryRun: false,
  rollbackOnFailure: true
});
```

#### 2. Approval System (`aaca/approval/approval-system.ts`)
Human-in-the-loop control for critical operations:
- **Risk Assessment**: Automatic risk scoring (0-100)
- **Approval Policies**: Configurable auto-approval thresholds
- **Expiry Handling**: Time-limited approval requests
- **Notifications**: Multi-channel approval alerts

**Default Policy:**
```typescript
{
  autoApprove: false,
  autoApproveThreshold: 10, // Risk score < 10 auto-approved
  requireApprovalFor: [
    DELETE_RESOURCE,
    MODIFY_CONFIG,
    MERGE_CODE,
    EXECUTE_COMMAND,
    DEPLOY
  ],
  expiryHours: 24
}
```

**Risk Levels:**
- 0-25: Low (auto-notify)
- 26-50: Medium (require approval)
- 51-75: High (require senior approval)
- 76-100: Critical (require security officer)

#### 3. Phase 4 Integration Layer (`aaca/phase4.ts`)
Bridges all 4 phases into unified system:
- Initializes all services in correct order
- Sets up execution and approval workers
- Provides unified API for external access
- Graceful startup and shutdown

**Initialization Order:**
1. Database (Phase 1)
2. Nervous System (Phase 2)
3. The Brains (Phase 3)
4. Execution Engine (Phase 4)
5. Approval System (Phase 4)
6. API Routes (Phase 4)

#### 4. Main Entry Point (`aaca/main.ts`)
Production server with full Express API:
- RESTful API endpoints
- Security middleware (Helmet, CORS, Compression)
- Request logging and tracing
- Health checks and metrics
- Graceful shutdown handling

#### 5. API Routes (`aaca/api/phase4-routes.ts`)
Complete REST API for external integration:

**System Routes:**
- `GET /api/v1/health` - System health status
- `GET /api/v1/` - System info and capabilities

**Task Routes:**
- `POST /api/v1/tasks` - Create new task
- `GET /api/v1/tasks` - List tasks with filtering
- `GET /api/v1/tasks/:id` - Get task details
- `PATCH /api/v1/tasks/:id` - Update task status
- `DELETE /api/v1/tasks/:id` - Delete task

**Workflow Routes:**
- `POST /api/v1/workflows` - Create workflow
- `GET /api/v1/workflows` - List workflows
- `POST /api/v1/workflows/:id/execute` - Execute workflow

**Approval Routes:**
- `GET /api/v1/approvals/pending` - Get pending approvals
- `POST /api/v1/approvals/:id/approve` - Grant approval
- `POST /api/v1/approvals/:id/reject` - Deny approval

**Agent Routes:**
- `GET /api/v1/agents` - List all agents
- `GET /api/v1/agents/stats` - Agent statistics
- `POST /api/v1/agents/:id/invoke` - Direct agent invocation

## Usage

### Starting the Full System
```typescript
import { AzenithAutonomousCompanyAI } from './main';

const aaca = new AzenithAutonomousCompanyAI();
await aaca.initialize();
await aaca.start();
// Server running on port 3001
```

### Using Phase 4 Directly
```typescript
import { startPhase4 } from './phase4';

const phase4 = await startPhase4({
  redisUrl: 'redis://localhost:6379',
  databaseUrl: 'postgresql://localhost:5432/aaca',
  port: 3001
});

// Create a task
const task = await phase4.createTask({
  title: 'Deploy new feature',
  type: TaskType.DEPLOYMENT,
  priority: TaskPriority.HIGH,
  createdBy: 'user-id',
  payload: {
    target: 'production',
    strategy: 'blue-green'
  }
});
```

### Environment Configuration
```bash
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/aaca
REDIS_URL=redis://localhost:6379

# Optional
AACA_PORT=3001
CORS_ORIGIN=*
NODE_ENV=production
LOG_LEVEL=info

# API Keys (for specific agents)
OPENAI_API_KEY=sk-...
GITHUB_TOKEN=ghp_...
SLACK_WEBHOOK_URL=https://...
```

## System Flow

### Task Execution Flow
```
1. API Request → Create Task
2. Orchestrator assigns to agent queue
3. Agent Worker processes job
4. High-risk? → Approval System
5. Approved? → Execution Engine
6. Execute action (with rollback protection)
7. Log results → EventBus
8. Update task status → Database
```

### Approval Workflow
```
1. Action marked as "requires approval"
2. Risk assessment calculates score
3. Auto-approve? (score < threshold)
4. Create approval request
5. Send notifications (email, Slack)
6. Human reviews and decides
7. Action proceeds or rejected
8. Audit trail recorded
```

### Error Handling & Recovery
- All actions support rollback
- Failed jobs auto-retry with exponential backoff
- Graceful degradation if agents unavailable
- Circuit breaker pattern for external services

## API Examples

### Create a Code Generation Task
```bash
curl -X POST http://localhost:3001/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Generate API endpoint",
    "type": "CODE_GENERATION",
    "priority": "HIGH",
    "createdBy": "user-uuid",
    "payload": {
      "prompt": "Create Express auth endpoint",
      "targetPath": "./src/routes/auth.ts"
    }
  }'
```

### Execute a Workflow
```bash
curl -X POST http://localhost:3001/api/v1/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "workflow-uuid",
    "createdBy": "user-uuid"
  }'
```

### Approve an Action
```bash
curl -X POST http://localhost:3001/api/v1/approvals/approval-uuid/approve \
  -H "Content-Type: application/json" \
  -d '{
    "decidedBy": "admin-uuid",
    "reason": "Reviewed and approved"
  }'
```

## Status

**Phase 4 Implementation: COMPLETE**

All 4 phases integrated and operational:
- Phase 1: Database Layer (Prisma + PostgreSQL)
- Phase 2: Communication Layer (Redis + BullMQ + EventBus)
- Phase 3: Agent Layer (7 Specialized AI Agents)
- Phase 4: Integration Layer (Execution + Approval + API)

**Production Features:**
- Full REST API
- Human-in-the-loop approval system
- Automatic rollback capabilities
- Comprehensive logging and auditing
- Health monitoring and metrics
- Graceful error recovery
