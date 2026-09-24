# VANGUARD Smart Routing System

نظام التوجيه الذكي - توزيع العملاء والمحادثات على الوكلاء بناءً على المهارات والتوفر والأداء

## Overview

Smart Routing System يوفر توزيعًا ذكيًا للعملاء والمحادثات على الوكلاء المتاحين باستخدام استراتيجيات متعددة:

- **Round Robin**: توزيع بالتناوب
- **Least Busy**: الأقل انشغالاً
- **Skill-Based**: حسب المهارات
- **Performance-Based**: حسب الأداء
- **Weighted**: موزون حسب معايير متعددة
- **Priority-Based**: حسب الأولوية

## Quick Start

### 1. Initialize Router and Load Agents

```typescript
import { smartRouter, agentLoader } from '@/lib/vanguard/automation/routing';

// Load agents from database
await agentLoader.loadAgents();

// Start periodic sync (every 60 seconds)
agentLoader.startSync(60000);
```

### 2. Register Agent Manually

```typescript
import { Agent } from '@/lib/vanguard/automation/routing';

const agent: Agent = {
  id: 'agent_123',
  name: 'أحمد محمد',
  email: 'ahmed@example.com',
  availability: 'available',
  skills: ['sales', 'technical_support', 'arabic'],
  languages: ['ar', 'en'],
  maxConcurrentChats: 5,
  currentChatCount: 2,
  
  performance: {
    averageResponseTime: 90,      // 90 seconds
    resolutionRate: 85,            // 85%
    satisfactionScore: 92,         // 92/100
    totalConversations: 156,
    activeConversations: 2,
  },
  
  capacity: {
    current: 2,
    maximum: 5,
    utilizationRate: 40,           // 40%
  },
  
  schedule: {
    timezone: 'Africa/Cairo',
    workingHours: {
      start: '09:00',
      end: '17:00',
    },
    workingDays: [0, 1, 2, 3, 4], // Sunday-Thursday
  },
};

await smartRouter.registerAgent(agent);
```

### 3. Route a Lead

```typescript
import { RoutingRequest } from '@/lib/vanguard/automation/routing';

const request: RoutingRequest = {
  type: 'lead',
  entityId: 'lead_456',
  priority: 'high',
  requiredSkills: ['sales', 'arabic'],
  preferredLanguage: 'ar',
  metadata: {
    source: 'whatsapp',
    leadScore: 85,
  },
};

const result = await smartRouter.route(request);

if (result.success) {
  console.log('Routed to agent:', result.agentId);
  console.log('Agent name:', result.agent?.name);
  console.log('Matching score:', result.score);
} else {
  console.error('Routing failed:', result.reason);
}
```

## Routing Strategies

### Round Robin (دوري)

التوزيع بالتناوب - كل وكيل يحصل على نفس عدد العملاء

```typescript
const rule: RoutingRule = {
  id: 'rule_1',
  name: 'Round Robin for New Leads',
  nameAr: 'توزيع دوري للعملاء الجدد',
  priority: 10,
  enabled: true,
  conditions: {
    leadSource: ['whatsapp', 'website'],
  },
  strategy: 'round_robin',
};

await smartRouter.addRoutingRule(rule);
```

### Least Busy (الأقل انشغالاً)

التوزيع على الوكيل ذو أقل عدد محادثات نشطة

```typescript
const rule: RoutingRule = {
  id: 'rule_2',
  name: 'Least Busy for Support',
  nameAr: 'الأقل انشغالاً للدعم الفني',
  priority: 20,
  enabled: true,
  conditions: {
    requiredSkills: ['technical_support'],
  },
  strategy: 'least_busy',
};
```

### Skill-Based (حسب المهارات)

التوزيع بناءً على مطابقة المهارات

```typescript
const rule: RoutingRule = {
  id: 'rule_3',
  name: 'Skill Match for VIP',
  nameAr: 'مطابقة المهارات لعملاء VIP',
  priority: 30,
  enabled: true,
  conditions: {
    leadScore: { min: 80 },
    requiredSkills: ['vip_support', 'sales'],
  },
  strategy: 'skill_based',
};
```

### Performance-Based (حسب الأداء)

التوزيع على الوكلاء الأفضل أداءً

```typescript
const rule: RoutingRule = {
  id: 'rule_4',
  name: 'Top Performers for Hot Leads',
  nameAr: 'أفضل الوكلاء للعملاء المهمين',
  priority: 40,
  enabled: true,
  conditions: {
    leadScore: { min: 90 },
  },
  strategy: 'performance_based',
};
```

### Weighted (موزون)

التوزيع بناءً على مزيج من العوامل (الافتراضي):

- **40%** - التوفر والقدرة الاستيعابية
- **30%** - الأداء (رضا العملاء + معدل الحل + سرعة الرد)
- **20%** - مطابقة المهارات
- **10%** - أولوية الطلب

```typescript
// Weighted strategy is default
const result = await smartRouter.route({
  type: 'lead',
  entityId: 'lead_789',
  priority: 'urgent',
  requiredSkills: ['sales'],
  preferredLanguage: 'ar',
});
```

## Agent Management

### Update Agent Availability

```typescript
import { AgentAvailability } from '@/lib/vanguard/automation/routing';

// Change availability
await smartRouter.updateAgentAvailability('agent_123', 'busy');

// Available states: 'available' | 'busy' | 'away' | 'offline'
```

### Update Agent Capacity

```typescript
// Update current workload
await smartRouter.updateAgentCapacity('agent_123', 3);

// Auto-updates:
// - capacity.current
// - capacity.utilizationRate
// - availability (if overloaded)
```

### Get Available Agents

```typescript
const agents = smartRouter.getAvailableAgents({
  skills: ['sales', 'arabic'],
  languages: ['ar'],
  minCapacity: 2, // At least 2 slots available
});

console.log(`Found ${agents.length} matching agents`);
```

## Workflow Actions

استخدام Routing في Workflows:

### Route Lead Action

```typescript
{
  id: 'route_lead_step',
  type: 'action',
  action: {
    type: 'route_lead',
    params: {
      leadId: '{{leadId}}',
      priority: 'high',
      requiredSkills: ['sales', 'arabic'],
      preferredLanguage: 'ar',
      autoAssign: true,  // Auto-assign in database
    }
  }
}
```

### Route Conversation Action

```typescript
{
  id: 'route_conversation_step',
  type: 'action',
  action: {
    type: 'route_conversation',
    params: {
      conversationId: '{{conversationId}}',
      priority: 'medium',
      requiredSkills: ['support'],
      autoAssign: true,
    }
  }
}
```

### Find Best Agent Action

```typescript
{
  id: 'find_agent_step',
  type: 'action',
  action: {
    type: 'find_best_agent',
    params: {
      requiredSkills: ['vip_support'],
      preferredLanguage: 'ar',
      minCapacity: 2,
    }
  }
}
// Returns: { agentId, agentName, utilizationRate, alternativeAgents }
```

### Rebalance Workload Action

```typescript
{
  id: 'rebalance_step',
  type: 'action',
  action: {
    type: 'rebalance_workload',
    params: {}
  }
}
```

## Load Balancing

### Automatic Rebalancing

```typescript
// Check if rebalancing is needed
await smartRouter.rebalanceWorkload();

// Publishes 'routing.rebalance_needed' event if:
// - Some agents are >20% above average utilization
// - Some agents are >20% below average utilization
```

### Get Routing Statistics

```typescript
const stats = smartRouter.getRoutingStats();

console.log(`
  Total Agents: ${stats.totalAgents}
  Available: ${stats.availableAgents}
  Avg Utilization: ${stats.avgUtilization}%
  Capacity: ${stats.usedCapacity}/${stats.totalCapacity}
`);
```

## Events

Smart Router publishes events to EventBus:

- `agent.registered` - Agent registered
- `agent.availability_changed` - Availability changed
- `routing.assigned` - Entity routed to agent
- `routing.rebalance_needed` - Load imbalance detected

### Subscribe to Routing Events

```typescript
import { eventBus } from '@/lib/vanguard/automation/event_bus';

eventBus.subscribe('routing.assigned', (event) => {
  console.log('Routed:', event.data);
  // { entityType, entityId, agentId, strategy, score }
});
```

## Database Schema

### Agent Data in `users` Table

```sql
-- Store agent metadata
UPDATE users 
SET metadata = jsonb_build_object(
  'availability', 'available',
  'skills', ARRAY['sales', 'support', 'arabic'],
  'languages', ARRAY['ar', 'en'],
  'maxConcurrentChats', 5,
  'schedule', jsonb_build_object(
    'timezone', 'Africa/Cairo',
    'workingHours', jsonb_build_object(
      'start', '09:00',
      'end', '17:00'
    ),
    'workingDays', ARRAY[0,1,2,3,4]
  )
)
WHERE role = 'agent';
```

### Agent Metrics Table

```sql
CREATE TABLE vanguard_agent_metrics (
  agent_id UUID PRIMARY KEY REFERENCES users(id),
  avg_response_time INT DEFAULT 120,        -- seconds
  resolution_rate INT DEFAULT 75,           -- percentage
  satisfaction_score INT DEFAULT 80,        -- 0-100
  total_conversations INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Best Practices

1. **Load Agents on Startup**
   ```typescript
   await agentLoader.loadAgents();
   agentLoader.startSync(60000);
   ```

2. **Use Routing Rules for Complex Logic**
   - Define rules with priorities
   - Use conditions to match specific scenarios
   - Set fallback strategies

3. **Monitor Capacity**
   - Check routing stats regularly
   - Rebalance when utilization is uneven
   - Alert when no agents available

4. **Update Availability in Real-Time**
   - When agent logs in/out
   - When agent status changes
   - When conversation starts/ends

5. **Track Performance Metrics**
   - Update agent metrics daily
   - Use metrics for performance-based routing
   - Reward high performers with priority leads

## Example: Complete Setup

```typescript
import { 
  smartRouter, 
  agentLoader,
  RoutingRule 
} from '@/lib/vanguard/automation/routing';

// 1. Load agents
await agentLoader.loadAgents();
agentLoader.startSync(60000);

// 2. Add routing rules
const rules: RoutingRule[] = [
  {
    id: 'vip_leads',
    name: 'VIP Leads to Top Performers',
    nameAr: 'عملاء VIP للوكلاء الأفضل',
    priority: 100,
    enabled: true,
    conditions: {
      leadScore: { min: 90 },
    },
    strategy: 'performance_based',
  },
  {
    id: 'skill_match',
    name: 'Skill-Based Routing',
    nameAr: 'التوزيع حسب المهارات',
    priority: 50,
    enabled: true,
    conditions: {
      requiredSkills: ['technical_support'],
    },
    strategy: 'skill_based',
  },
  {
    id: 'default_routing',
    name: 'Default Weighted Routing',
    nameAr: 'التوزيع الافتراضي الموزون',
    priority: 10,
    enabled: true,
    conditions: {},
    strategy: 'weighted',
  },
];

for (const rule of rules) {
  await smartRouter.addRoutingRule(rule);
}

// 3. Route incoming leads
const result = await smartRouter.route({
  type: 'lead',
  entityId: 'lead_123',
  priority: 'high',
  requiredSkills: ['sales'],
  preferredLanguage: 'ar',
});

console.log('Routed to:', result.agentId);
```

## Troubleshooting

### No Available Agents

```typescript
const agents = smartRouter.getAvailableAgents();
if (agents.length === 0) {
  console.log('No agents available');
  // Options:
  // 1. Queue the request
  // 2. Send to waiting pool
  // 3. Notify administrators
}
```

### High Utilization

```typescript
const stats = smartRouter.getRoutingStats();
if (stats.avgUtilization > 90) {
  console.warn('High utilization - consider adding agents');
  await smartRouter.rebalanceWorkload();
}
```

### Skills Not Matching

```typescript
const agents = smartRouter.getAvailableAgents({
  skills: ['rare_skill'],
});

if (agents.length === 0) {
  // Fallback: route without skill requirement
  const allAgents = smartRouter.getAvailableAgents();
  console.log(`No agents with rare_skill, using any available (${allAgents.length})`);
}
```
