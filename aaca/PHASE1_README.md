# AACA Phase 1: Foundation & Database Layer

## Production-Ready Implementation

### Overview
Phase 1 establishes the foundational infrastructure for the Azenith Autonomous Company AI System (AACA):
- Monorepo-ready folder structure
- Comprehensive Prisma database schema
- DatabaseService class with connection management
- Express server with error handling and request validation
- Full CRUD API routes for Tasks and Approvals

## Architecture

### Folder Structure
```
aaca/
├── api/
│   └── routes/
│       ├── tasks.ts          # Task CRUD operations
│       ├── approvals.ts      # Approval workflow management
│       └── health.ts         # Health check endpoints
├── database/
│   ├── database-service.ts   # Production DatabaseService class
│   └── prisma-client.ts      # Legacy compatibility
├── prisma/
│   ├── schema.prisma         # Complete database schema
│   └── seed.ts              # Database seeding
├── types/
│   └── index.ts             # TypeScript type definitions
├── utils/
│   └── logger.ts            # Structured logging utility
├── app.ts                   # Core server application class
└── phase1.ts               # Phase 1 entry point
```

### Database Schema

#### Core Tables
- **users** - System users with roles and permissions
- **ai_tasks** - AI task queue with status, priority, and workflow linking
- **ai_actions** - Executable actions linked to tasks
- **approvals** - Approval requests with expiry and status tracking
- **execution_logs** - Detailed action execution logs
- **events** - System event stream for async processing
- **notifications** - Multi-channel notification system
- **system_logs** - Centralized system logging
- **workflows** - Workflow DAG definitions
- **capabilities** - Self-extension capability management
- **job_queues** - Queue configuration storage

#### Key Relations
- Task → Actions (1:N)
- Task → SubTasks (self-referential)
- Task → Workflow (N:1)
- Action → Approval (1:1)
- Action → ExecutionLogs (1:N)
- User → Tasks, Actions, Approvals, Notifications (1:N)

### API Endpoints

#### Tasks
- `POST /api/v1/tasks` - Create new task
- `GET /api/v1/tasks` - List tasks (with pagination, filters)
- `GET /api/v1/tasks/:id` - Get task details with relations
- `PATCH /api/v1/tasks/:id` - Update task status/fields
- `DELETE /api/v1/tasks/:id` - Delete task

#### Approvals
- `POST /api/v1/approvals` - Create approval request
- `GET /api/v1/approvals` - List approvals (with pagination, filters)
- `GET /api/v1/approvals/pending` - Get pending approvals
- `GET /api/v1/approvals/:id` - Get approval details
- `POST /api/v1/approvals/:id/decision` - Approve/Reject request
- `DELETE /api/v1/approvals/:id` - Delete approval

#### Health
- `GET /health` - Full system health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

## Usage

### Installation
```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate
```

### Running Phase 1 Server
```bash
# Production mode
npm run aaca:start

# Development mode with hot reload
npm run aaca:dev
```

### Environment Variables
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/aaca
AACA_PORT=3001
CORS_ORIGIN=*
NODE_ENV=production
LOG_LEVEL=info
```

## Implementation Details

### DatabaseService Class
- Singleton pattern with global instance management
- Connection retry logic with configurable max retries
- Event-driven logging integration
- Transaction wrapper with error handling
- Raw query execution with safety checks
- Health check with latency metrics

### Request Validation (Zod)
All API routes use Zod schemas for strict validation:
- UUID validation for IDs
- Enum validation for status/priority/type fields
- Automatic type coercion for query parameters
- Detailed error responses with field-level messages

### Error Handling
- Global error handler with stack traces in development
- 404 handler for unmatched routes
- Database error logging and retry logic
- Graceful shutdown on SIGTERM/SIGINT

### Security
- Helmet.js security headers
- CORS configuration
- Request size limits (10MB)
- X-Powered-By header disabled

## Status

**Phase 1 Implementation: COMPLETE**

All components are production-ready with:
- Full TypeScript type safety
- Comprehensive error handling
- Request validation
- Database transaction support
- Structured logging
- Health monitoring endpoints
