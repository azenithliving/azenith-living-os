/**
 * VANGUARD Phase 5: Smart Automation - Routing System Index
 * 
 * نظام التوجيه الذكي - Central export point
 */

// Export main components
export * from './smart_router';
export * from './agent_loader';

// Import and register routing actions
import './routing_actions';

// Re-export convenience functions
export { smartRouter } from './smart_router';
export { agentLoader } from './agent_loader';
