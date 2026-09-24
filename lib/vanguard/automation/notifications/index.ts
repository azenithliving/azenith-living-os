/**
 * VANGUARD Phase 5: Smart Automation - Notifications Index
 * 
 * نظام الإشعارات - Central export point
 */

// Export main components
export * from './notification_engine';

// Import and register notification actions
import './notification_actions';

// Re-export convenience
export { notificationEngine } from './notification_engine';
