/**
 * VANGUARD Phase 5: Smart Automation - Central Export
 * 
 * نظام الأتمتة الذكية - نقطة التصدير المركزية
 */

// Core automation systems
export * from './event_bus';
export * from './trigger_engine';
export * from './workflow_engine';
export * from './task_queue';

// Actions
export * from './actions';

// Routing
export * from './routing';

// Notifications
export * from './notifications';

// Templates
export * from './templates';

// Convenience exports
export { eventBus } from './event_bus';
export { WorkflowEngine } from './workflow_engine';
export { TriggerEngine } from './trigger_engine';
export { TaskQueue } from './task_queue';
export { smartRouter, agentLoader } from './routing';
export { notificationEngine } from './notifications';
export { 
  workflowTemplates,
  getWorkflowTemplate,
  getAllWorkflowTemplates,
  createFromTemplate 
} from './templates';
