# AACA Phase 3: The Brains (Multi-Agent Services)

## Production-Ready Implementation

### Overview
Phase 3 implements the 7 core AI agents that form the intelligence layer of AACA:
- **Orchestrator** - Central coordinator and task router
- **Dev Agent** - Code generation, review, and repository management
- **Security Agent** - Security scanning and risk assessment
- **QA Agent** - Testing, quality checks, and validation
- **Ops Agent** - Deployment, monitoring, and health checks
- **Communication Agent** - Multi-channel notifications and messaging
- **Evolution Agent** - System self-improvement and capability extension

## Architecture

### Agent Services (`aaca/agents/`)

#### 1. Orchestrator Service (`orchestrator-service.ts`)
Central coordinator that manages the entire agent ecosystem:
- Task creation and routing to appropriate agents
- Workflow execution with DAG support
- Task assignment based on type and priority
- Event-driven coordination

**Key Methods:**
```typescript
createTask(request: TaskRequest): Promise<AITask>
executeWorkflow(workflowId: string, createdBy: string): Promise<AITask>
assignTask(taskId: string): Promise<TaskAssignment | null>
getSystemStats(): SystemStats
```

#### 2. Dev Agent Service (`dev-agent-service.ts`)
Software development automation:
- **CODE_GENERATION**: Generate code from natural language prompts
- **CODE_REVIEW**: Review code for quality, security, performance
- **DEPLOYMENT**: Deploy code to various environments
- **ANALYSIS**: Repository analysis and dependency mapping

**Features:**
- File system operations with safety checks
- Git integration (branches, commits, PRs)
- Code parsing and AST analysis
- Repository health scoring

#### 3. Security Agent Service (`security-agent-service.ts`)
Security-first automation:
- **SECURITY_SCAN**: Multi-layer security scanning
  - Code scanning (vulnerabilities, anti-patterns)
  - Dependency scanning (outdated packages, CVEs)
  - Secret detection (API keys, tokens)
  - Configuration scanning (misconfigurations)
- **AUDIT**: Security posture assessment
- **COMPLIANCE_CHECK**: Framework compliance (SOC2, GDPR)

**Risk Scoring:**
- 0-25: Low risk (auto-approve)
- 26-50: Medium risk (notify)
- 51-75: High risk (require approval)
- 76-100: Critical risk (block + alert)

#### 4. QA Agent Service (`qa-agent-service.ts`)
Quality assurance automation:
- **RUN_TESTS**: Execute test suites
- **TEST_GENERATION**: Generate test cases from code
- **QUALITY_CHECK**: Code quality analysis
- **BUILD_VALIDATION**: Verify builds and artifacts

**Integrations:**
- Jest, Vitest, Playwright
- ESLint, TypeScript, Prettier
- Code coverage reporting
- Automated test generation with AI

#### 5. Ops Agent Service (`ops-agent-service.ts`)
Operations and infrastructure automation:
- **DEPLOY**: Multi-environment deployments
- **MONITOR**: System monitoring and metrics
- **HEALTH_CHECK**: Service health validation
- **SCALE**: Auto-scaling operations

**Features:**
- Container orchestration (Docker, Kubernetes)
- Cloud provider integration (AWS, GCP, Azure)
- Real-time metrics collection
- Automated rollback on failure

#### 6. Communication Agent Service (`communication-agent-service.ts`)
Multi-channel notification system:
- **SEND_EMAIL**: SMTP/email provider integration
- **SEND_SLACK**: Slack workspace notifications
- **SEND_WEBHOOK**: Generic webhook delivery
- **SEND_SMS**: SMS gateway integration
- **SEND_TELEGRAM**: Telegram bot messaging

**Templates:**
- Approval request notifications
- Security alert broadcasts
- Task completion summaries
- System health reports

#### 7. Evolution Agent Service (`evolution-agent-service.ts`)
System self-improvement capabilities:
- **CAPABILITY_PROPOSAL**: Propose new system capabilities
- **CAPABILITY_VALIDATION**: Validate proposed changes
- **CODE_EVOLUTION**: Self-modifying code generation
- **PERFORMANCE_OPTIMIZATION**: Auto-optimization suggestions

**Safety Mechanisms:**
- Sandboxed testing environment
- Multi-stage approval workflow
- Automatic rollback capability
- Human-in-the-loop for critical changes

## Usage

### Starting Phase 3
```typescript
import { startBrains } from './phase3';

const brains = await startBrains({
  redisUrl: 'redis://localhost:6379',
  databaseUrl: 'postgresql://localhost:5432/aaca'
});

// All 7 agents are now running and ready
```

### Creating Tasks
```typescript
// Create a code generation task
const task = await brains.createTask({
  title: 'Generate API endpoint',
  description: 'Create REST endpoint for user authentication',
  type: TaskType.CODE_GENERATION,
  priority: TaskPriority.HIGH,
  createdBy: 'user-id',
  payload: {
    prompt: 'Generate Express.js authentication endpoint',
    targetPath: './src/routes/auth.ts',
    language: 'typescript'
  }
});
```

### Executing Workflows
```typescript
// Execute a multi-step workflow
const result = await brains.executeWorkflow('workflow-id', 'user-id');
```

### Accessing Agent Services
```typescript
const {
  orchestrator,
  devAgent,
  securityAgent,
  qaAgent,
  opsAgent,
  communicationAgent,
  evolutionAgent
} = brains.getServices();
```

## Configuration

### Environment Variables
```bash
# Phase 2 (Nervous System)
REDIS_URL=redis://localhost:6379

# Phase 1 (Database)
DATABASE_URL=postgresql://user:pass@localhost:5432/aaca

# Agent-specific
OPENAI_API_KEY=sk-...           # For AI-powered agents
GITHUB_TOKEN=ghp_...            # For Dev Agent repository access
SLACK_WEBHOOK_URL=https://...   # For Communication Agent
SMTP_HOST=smtp.gmail.com        # For email notifications
```

### Queue Concurrency Settings
| Agent | Queue | Concurrency | Reasoning |
|-------|-------|-------------|-----------|
| Dev Agent | dev-agent | 2 | CPU-intensive, needs balance |
| Security Agent | security-agent | 1 | Security-critical, serialized |
| QA Agent | qa-agent | 2 | Can run tests in parallel |
| Ops Agent | ops-agent | 3 | I/O-bound operations |
| Communication Agent | communication-agent | 5 | High-throughput messaging |
| Evolution Agent | evolution-agent | 1 | Self-modification, careful |

## Integration with Phase 2

All agents use the Phase 2 Communication Layer:
```
Agent Service → QueueManager (BullMQ) → Worker → EventBus (Pub/Sub)
                     ↓
              Job Lifecycle Logging
                     ↓
              Prisma job_queues table
```

## Event Communication

Agents communicate via the EventBus:
```typescript
// Agent publishes completion
eventBus.publish({
  type: 'agent:complete',
  source: 'dev-agent',
  payload: {
    taskId: 'uuid',
    result: { filesModified: 3, filesCreated: 1 }
  }
});

// Orchestrator listens for completion
await eventBus.subscribe('agent:complete', {
  eventType: 'agent:complete',
  handler: async (event) => {
    // Route next workflow step
  }
});
```

## Status

**Phase 3 Implementation: COMPLETE**

All 7 agents production-ready:
- Orchestrator with workflow DAG support
- Dev Agent with file system integration
- Security Agent with risk scoring
- QA Agent with test framework integration
- Ops Agent with deployment capabilities
- Communication Agent with multi-channel support
- Evolution Agent with self-improvement capabilities
