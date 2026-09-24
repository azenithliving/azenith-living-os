/**
 * VANGUARD Phase 5: Smart Automation - Actions Index
 * 
 * Central export point for all workflow actions
 */

// Export base action types
export * from './base_action';

// Import and register all actions
import './messaging_actions';
import './lead_actions';
import './task_actions';
import './data_actions';
import '../routing/routing_actions';
import '../notifications/notification_actions';

// Export action registry
export { ActionRegistry } from './base_action';

/**
 * Available Action Types:
 * 
 * Messaging:
 * - send_whatsapp: Send WhatsApp message
 * - send_email: Send email
 * - send_notification: Send push notification
 * 
 * Lead Management:
 * - create_lead: Create new lead
 * - update_lead: Update lead fields
 * - assign_lead: Assign lead to agent
 * - update_lead_score: Update lead scoring
 * - convert_lead: Convert lead to opportunity
 * 
 * Task Management:
 * - create_task: Create new task
 * - update_task: Update task fields
 * - complete_task: Mark task as completed
 * - assign_task: Assign task to user
 * 
 * Routing:
 * - route_lead: Route lead to best agent
 * - route_conversation: Route conversation to best agent
 * - find_best_agent: Find best available agent
 * - rebalance_workload: Rebalance agent workload
 * - get_routing_stats: Get routing statistics
 * 
 * Notifications:
 * - send_notification: Send notification via channel
 * - send_template_notification: Send notification from template
 * - send_batch_notification: Send batch notifications
 * - get_notification_stats: Get notification statistics
 * 
 * Data Operations:
 * - http_request: Make HTTP API call
 * - query_database: Query Supabase tables
 * - transform_data: Transform data structures
 * - wait: Wait for specified duration
 */

// Helper function to execute action
export async function executeAction(
  actionType: string,
  context: any,
  config: any
): Promise<any> {
  const { ActionRegistry } = await import('./base_action');
  
  const action = ActionRegistry.get(actionType);
  if (!action) {
    throw new Error(`Unknown action type: ${actionType}`);
  }

  // Validate configuration
  const validation = action.validate(config);
  if (!validation.valid) {
    throw new Error(`Invalid action configuration: ${validation.error}`);
  }

  // Execute action
  return await action.execute(context, config);
}

// Helper function to get all registered actions
export function getRegisteredActions(): string[] {
  const { ActionRegistry } = require('./base_action');
  return ActionRegistry.getAll();
}
