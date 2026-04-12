# Azenith Autonomous Company AI System (AACA) v1.0.0

A production-ready distributed Multi-Agent AI system built with TypeScript, Node.js, BullMQ, Redis, and PostgreSQL.

## 🎯 System Overview

AACA is a fully autonomous AI company system with 7 specialized agents:

| Agent | Role | Status |
|-------|------|--------|
| **Orchestrator** | Task routing & workflow management | ✅ Active |
| **Dev Agent** | Code generation & repository analysis | ✅ Active |
| **Security Agent** | Risk scoring & security scanning | ✅ Active |
| **QA Agent** | Test execution & build validation | ✅ Active |
| **Ops Agent** | Monitoring & health checks | ✅ Active |
| **Communication Agent** | Notifications (Email/Telegram/Dashboard) | ✅ Active |
| **Evolution Agent** | Self-extension & capability evolution | ✅ Active |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AACA SYSTEM                              │
├─────────────────────────────────────────────────────────────────┤
│  Phase 4: Full Integration                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Express   │  │   Approval  │  │    Execution Engine     │ │
│  │    Server   │  │   System    │  │   (Safe Code Execution) │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
│         │                │                      │               │
│  Phase 3: The Brains (Multi-Agent Services)                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Orchestrator  │  Dev  │ Security │  QA  │ Ops │ Comm  │   │
│  └────────────────┴───────┴──────────┴──────┴─────┴───────┘   │
│                         │                                      │
│  Phase 2: Nervous System (Queue & Event System)                 │
│  ┌─────────────┐      ┌─────────────┐                          │
│  │   BullMQ    │◄────►│  EventBus   │                          │
│  │  (Queues)   │      │  (Redis)    │                          │
│  └─────────────┘      └─────────────┘                          │
│         │                                                      │
│  Phase 1: Foundation (Database)                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL + Prisma ORM (11 tables, 11 enums)         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
aaca/
├── agents/                    # 7 Agent Services
│   ├── orchestrator-service.ts   # Task orchestration & workflows
│   ├── dev-agent-service.ts      # Code generation & repository analysis
│   ├── ops-agent-service.ts      # Monitoring & health checks
│   ├── security-agent-service.ts # Risk scoring & security scanning
│   ├── qa-agent-service.ts       # Test execution & build validation
│   ├── communication-agent-service.ts  # Notifications
│   └── evolution-agent-service.ts      # Self-extension capabilities
├── api/
│   ├── routes.ts              # Full API routes (Phase 1-3)
│   └── phase4-routes.ts       # Phase 4 complete API
├── approval/
│   └── approval-system.ts     # Approval workflow with expiry
├── config/
│   └── redis.ts               # Redis configuration for BullMQ
├── database/
│   └── prisma-client.ts       # Database connection with retry
├── events/
│   └── event-bus.ts           # Redis-based pub/sub event system
├── execution/
│   └── execution-engine.ts    # Safe action execution with rollback
├── prisma/
│   ├── schema.prisma          # Complete database schema
│   └── seed.ts                # Database seed script
├── queues/
│   └── queue-manager.ts       # BullMQ queue system
├── types/
│   └── index.ts               # TypeScript types (444 lines)
├── utils/
│   └── logger.ts              # Structured logging
├── workers/
│   └── task-worker.ts         # Queue-to-Event bridge worker
├── server.ts                  # Phase 1 Express server
├── phase2.ts                  # Phase 2 entry (Nervous System)
├── phase3.ts                  # Phase 3 entry (The Brains)
├── main.ts                    # Phase 4 full integration
└── index.ts                   # Complete system (legacy)
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- TypeScript

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cat > .env << EOF
DATABASE_URL="postgresql://user:password@localhost:5432/aaca"
REDIS_URL="redis://localhost:6379"
AACA_PORT=3001
NODE_ENV=development
EOF

# 3. Run database migrations
npx prisma migrate dev --schema=aaca/prisma/schema.prisma

# 4. Seed the database
npx ts-node aaca/prisma/seed.ts

# 5. Start the full system
npx ts-node aaca/main.ts
```

### Alternative: Run Individual Phases

```bash
# Phase 1: Foundation (Database + Basic API)
npx ts-node aaca/server.ts

# Phase 2: Nervous System (Queue + Event Bus)
npx ts-node aaca/phase2.ts

# Phase 3: The Brains (Multi-Agent System)
npx ts-node aaca/phase3.ts

# Phase 4: Full Integration
npx ts-node aaca/main.ts
```

## 📡 API Reference

### Base URL
```
http://localhost:3001/api/v1
```

### Endpoints

#### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | System info & status |
| GET | `/health` | Health check |
| GET | `/system/stats` | System statistics |
| GET | `/system/queues` | Queue status |
| GET | `/system/events` | Event bus stats |

#### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tasks` | Create new task |
| GET | `/tasks` | List all tasks |
| GET | `/tasks/:id` | Get task details |
| PATCH | `/tasks/:id` | Update task |
| GET | `/tasks/:id/actions` | Get task actions |

#### Workflows
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/workflows` | Create workflow |
| GET | `/workflows` | List workflows |
| POST | `/workflows/:id/execute` | Execute workflow |

#### Approvals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/approvals/pending` | Get pending approvals |
| GET | `/approvals` | List all approvals |
| GET | `/approvals/:id` | Get approval details |
| POST | `/approvals` | Create approval request |
| POST | `/approvals/:id/decision` | Approve/reject |

#### Actions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/actions` | Create action |

## 🧪 Testing

```bash
# Run tests
curl -X POST http://localhost:3001/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Task",
    "type": "CODE_GENERATION",
    "createdBy": "system@azenith.ai",
    "payload": { "prompt": "Generate test code" }
  }'

# Check system health
curl http://localhost:3001/api/v1/health

# List all tasks
curl http://localhost:3001/api/v1/tasks
```

## 📊 Database Schema

### Tables
- `users` - System users with roles/permissions
- `ai_tasks` - AI task management
- `ai_actions` - Action execution tracking
- `approvals` - Approval workflow
- `execution_logs` - Execution audit trail
- `events` - Event store
- `notifications` - Multi-channel notifications
- `workflows` - Workflow definitions
- `system_logs` - System logging
- `capabilities` - Self-extension system
- `job_queues` - Queue configuration

### Enums
- `UserRole`: USER, ADMIN, OPERATOR, SECURITY_OFFICER, SYSTEM
- `TaskType`: CODE_GENERATION, CODE_REVIEW, DEPLOYMENT, ANALYSIS, MONITORING, SECURITY_SCAN, TESTING, NOTIFICATION, EVOLUTION, CUSTOM
- `TaskStatus`: PENDING, QUEUED, IN_PROGRESS, COMPLETED, FAILED, CANCELLED, RETRYING
- `ActionType`: WRITE_CODE, EXECUTE_COMMAND, DEPLOY, DELETE_RESOURCE, MODIFY_CONFIG, SEND_NOTIFICATION, CREATE_PR, MERGE_CODE, ROLLBACK, CUSTOM
- `ApprovalStatus`: PENDING, APPROVED, REJECTED, EXPIRED

## 🔒 Security Features

- **Risk Scoring**: All actions are scored 0-100
- **Approval Workflow**: High-risk actions require approval
- **Secret Scanning**: Automatic detection of API keys, passwords, tokens
- **Command Validation**: Forbidden commands are blocked
- **Rollback Support**: Failed actions can be rolled back
- **Helmet.js**: Security headers
- **CORS**: Configurable origin restrictions

## 📈 Monitoring

- **System Health**: `/health` endpoint with DB & Redis status
- **Queue Stats**: Real-time queue metrics
- **Event Stats**: Event bus handler counts
- **Agent Stats**: Per-agent success/failure rates
- **Execution Logs**: Complete audit trail

## 🔧 Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/aaca

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Server
AACA_PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com

# Security
MAX_RISK_SCORE=75
AUTO_APPROVE_THRESHOLD=10
APPROVAL_EXPIRY_HOURS=24

# Agents
DEV_AGENT_CONCURRENCY=2
QA_AGENT_CONCURRENCY=2
SECURITY_AGENT_CONCURRENCY=1
```

## 📚 Documentation

- **Phase 1**: Database & Foundation
- **Phase 2**: Queue & Event System (Nervous System)
- **Phase 3**: Multi-Agent Services (The Brains)
- **Phase 4**: Full Integration & API

## 🤝 Contributing

This is a production-ready reference implementation. All code is TypeScript with no placeholders.

## 📄 License

MIT License - Azenith AI Systems

---

**Status**: ✅ **FULLY OPERATIONAL** - All 4 phases complete, 7 agents active
