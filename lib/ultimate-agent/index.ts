/**
 * Ultimate Intelligence Agent - Barrel Export
 *
 * "One import, infinite power."
 *
 * Centralized exports for the Ultimate Agent system
 */

// Core exports (main API)
export {
  // Initialization & Config
  initializeAgent,
  getAgentConfig,
  updateAgentConfig,
  getAgentStatus,
  
  // Command Processing
  executeCommand,
  processAIRequest,
  
  // Planning & Execution
  createAndExecutePlan,
  runProactiveCheck,
  
  // Learning & Feedback
  learnFromInteraction,
  
  // Reporting
  generateDailyReport,
  handleApproval,
  exportAgentData,
  
  // Types
  type AgentConfig,
  type AgentStatus,
  type ActionPlan,
  type CommandResult,
} from "./agent-core";

// Memory Store exports
export {
  storeMemory,
  updateMemory,
  searchMemories,
  getRecentMemories,
  storeUserPreference,
  getUserPreferences,
  getUserPreference,
  createGoal,
  getActiveGoals,
  updateGoalProgress,
  completeGoalStep,
  learnFromFeedback,
  getMemoryStats,
  cleanExpiredMemories,
  type MemoryEntry,
  type MemoryType,
  type PriorityLevel,
  type UserPreference,
  type AgentGoal,
  type GoalStep,
  type MemoryFilters,
} from "./memory-store";

// Security Manager exports
export {
  classifyRisk,
  validateAction,
  createApprovalRequest,
  getPendingApprovals,
  approveRequest,
  rejectRequest,
  isActionApproved,
  logAuditEvent,
  getAuditEvents,
  checkDailyCriticalLimit,
  getSecurityStats,
  type RiskLevel,
  type ActionCategory,
  type AgentAction,
  type ApprovalRequest,
  type SecurityPolicy,
} from "./security-manager";

// Predictive Engine exports
export {
  getMetricsSnapshot,
  analyzeTrend,
  detectAnomalies,
  generateOpportunities,
  runWhatIfScenario,
  generateStrategicRecommendations,
  predictResourceDepletion,
  type DataPoint,
  type TrendAnalysis,
  type Anomaly,
  type Prediction,
  type StrategicOpportunity,
  type WhatIfScenario,
  type MetricsSnapshot,
} from "./predictive-engine";

// Executor exports
export {
  executeAction,
  executeBatch,
  executeDatabaseRead,
  executeDatabaseWrite,
  executeRPC,
  readSafeFile,
  writeSafeFile,
  listSafeFiles,
  callInternalAPI,
  sendWhatsAppMessage,
  sendTelegramNotification,
  sendEmail,
  updateEnvironmentVariable,
  triggerDeployment,
  executeCodeSuggestion,
  type ExecutionResult,
  type DatabaseOperationResult,
  type FileOperationResult,
  type ExternalServiceResult,
} from "./executor-omnipotent";
