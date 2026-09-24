/**
 * lib/vanguard/types.ts
 * =====================
 * Shared type definitions for the Vanguard Sales Ops Nervous System.
 * All interfaces, enums, and utility types used across the entire vanguard layer.
 *
 * Design principles:
 * - 100% TypeScript strict mode compatible
 * - Immutable where possible (readonly)
 * - Discriminated unions for exhaustive handling
 * - No `any` — use `unknown` + type guards
 */

// ════════════════════════════════════════════════════════════════════════════
// CORE ENUMS
// ════════════════════════════════════════════════════════════════════════════

export enum ConsciousnessState {
  DORMANT = "dormant",
  AWAKENING = "awakening",
  ACTIVE = "active",
  REASONING = "reasoning",
  PLANNING = "planning",
  EXECUTING = "executing",
  REFLECTING = "reflecting",
  LEARNING = "learning",
  EVOLVING = "evolving",
  DORMANTING = "dormanting",
}

export enum GoalPriority {
  CRITICAL = 100,
  HIGH = 75,
  MEDIUM = 50,
  LOW = 25,
  BACKGROUND = 10,
}

export enum GoalStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  PAUSED = "paused",
}

export enum MemoryType {
  EPISODIC = "episodic",
  SEMANTIC = "semantic",
  PROCEDURAL = "procedural",
  WORKING = "working",
  PROSPECTIVE = "prospective",
  AUTOBIOGRAPHICAL = "autobiographical",
}

export enum VerificationTier {
  TIER1 = "tier1",   // In-memory knowledge graph (site-content)
  TIER2 = "tier2",   // Browser/web search verification
  TIER3 = "tier3",   // Learned facts from admin corrections
  FAILED = "failed", // Could not verify
}

export enum LeadStage {
  NEW = "new",
  QUALIFIED = "qualified",
  QUOTED = "quoted",
  NEGOTIATING = "negotiating",
  CONTRACTED = "contracted",
  WON = "won",
  LOST = "lost",
}

export enum LeadTier {
  DIAMOND = "diamond",
  GOLD = "gold",
  SILVER = "silver",
  BRONZE = "bronze",
}

export enum LeadUrgency {
  IMMEDIATE = "immediate",
  THIS_WEEK = "this_week",
  THIS_MONTH = "this_month",
  QUARTER = "quarter",
  EXPLORING = "exploring",
}

export enum AgentStatus {
  IDLE = "idle",
  RUNNING = "running",
  SLEEPING = "sleeping",
  ERROR = "error",
}

export enum IntentCategory {
  PRICING_INQUIRY = "pricing_inquiry",
  PRODUCT_INQUIRY = "product_inquiry",
  BOOKING_REQUEST = "booking_request",
  COMPLAINT = "complaint",
  ESCALATION = "escalation",
  GENERAL_INQUIRY = "general_inquiry",
  LOCATION_REQUEST = "location_request",
  FOOD_REQUEST = "food_request",
  DESIGN_CONSULTATION = "design_consultation",
  QUALIFICATION = "qualification",
  OBJECTION = "objection",
  CLOSING = "closing",
}

export enum RiskSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// ════════════════════════════════════════════════════════════════════════════
// RESULT TYPE — no exceptions for control flow
// ════════════════════════════════════════════════════════════════════════════

export type Result<T, E = VanguardError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok === true;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false;
}

// ════════════════════════════════════════════════════════════════════════════
// ERROR TYPES
// ════════════════════════════════════════════════════════════════════════════

export interface VanguardError {
  readonly code: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly cause?: Error;
  readonly timestamp: string;
}

export function makeError(
  code: string,
  message: string,
  context?: Record<string, unknown>,
  cause?: Error
): VanguardError {
  return {
    code,
    message,
    context,
    cause,
    timestamp: new Date().toISOString(),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// IDENTITY
// ════════════════════════════════════════════════════════════════════════════

export interface CoreValues {
  readonly userInterestFirst: boolean;
  readonly truthFirst: boolean;
  readonly executionFirst: boolean;
  readonly egyptOnly: boolean;
  readonly zeroPricingWithoutConsent: boolean;
  readonly zeroHallucination: boolean;
  readonly fullTransparency: boolean;
}

export interface PersonalityTraits {
  readonly directness: number;       // 0.0–1.0
  readonly expertise: number;
  readonly proactivity: number;
  readonly empathy: number;
  readonly humor: number;
  readonly formality: number;
}

export interface VanguardIdentity {
  readonly name: string;
  readonly nameAr: string;
  readonly version: string;
  readonly role: "frontend_consultant" | "admin_ops_manager";
  readonly language: "arabic-egyptian";
  readonly timezone: "Africa/Cairo";
  readonly coreValues: CoreValues;
  readonly personality: PersonalityTraits;
  readonly birthDate: string; // ISO
}

// ════════════════════════════════════════════════════════════════════════════
// GOAL SYSTEM
// ════════════════════════════════════════════════════════════════════════════

export interface SuccessCriterion {
  readonly id: string;
  readonly description: string;
  readonly checkFn?: () => Promise<boolean>;
}

export interface Goal {
  readonly id: string;
  description: string;
  priority: GoalPriority;
  status: GoalStatus;
  progress: number; // 0.0–1.0
  parentId: string | null;
  childrenIds: string[];
  successCriteria: SuccessCriterion[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deadline: string | null;
}

export function makeGoal(partial: Partial<Goal> & { description: string }): Goal {
  return {
    id: crypto.randomUUID(),
    priority: GoalPriority.MEDIUM,
    status: GoalStatus.ACTIVE,
    progress: 0.0,
    parentId: null,
    childrenIds: [],
    successCriteria: [],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    deadline: null,
    ...partial,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MEMORY SYSTEM
// ════════════════════════════════════════════════════════════════════════════

export interface Memory {
  readonly id: string;
  type: MemoryType;
  content: string;
  importance: number;       // 0.0–1.0
  emotionalValence: number; // -1.0–1.0
  tags: string[];
  context: Record<string, unknown>;
  embedding?: number[];
  createdAt: string;
  accessedAt: string;
  accessCount: number;
  source: "experience" | "learning" | "instruction" | "reflection" | "inference";
  confidence: number; // 0.0–1.0
  associationIds: string[];
}

export function makeMemory(partial: Partial<Memory> & { content: string }): Memory {
  return {
    id: crypto.randomUUID(),
    type: MemoryType.EPISODIC,
    importance: 0.5,
    emotionalValence: 0.0,
    tags: [],
    context: {},
    createdAt: new Date().toISOString(),
    accessedAt: new Date().toISOString(),
    accessCount: 0,
    source: "experience",
    confidence: 1.0,
    associationIds: [],
    ...partial,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// BELIEF SYSTEM
// ════════════════════════════════════════════════════════════════════════════

export interface Belief {
  readonly id: string;
  proposition: string;
  confidence: number;    // 0.0–1.0
  evidenceIds: string[]; // memory IDs
  source: "experience" | "instruction" | "reflection" | "reflection:pipeline" | "inference";
  domain: "sales" | "operations" | "psychology" | "technical" | "cultural" | "general";
  createdAt: string;
  updatedAt: string;
  lastChallenged: string | null;
  challengeCount: number;
}

export function makeBelief(partial: Partial<Belief> & { proposition: string }): Belief {
  return {
    id: crypto.randomUUID(),
    confidence: 0.8,
    evidenceIds: [],
    source: "experience",
    domain: "general",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastChallenged: null,
    challengeCount: 0,
    ...partial,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// VERIFICATION / CITATION SYSTEM
// ════════════════════════════════════════════════════════════════════════════

export interface Citation {
  readonly id: string;
  readonly tier: VerificationTier;
  readonly source: string;         // URL, table name, or "knowledge_graph"
  readonly excerpt: string;        // relevant snippet
  readonly claim: string;          // the claim being verified
  readonly confidence: number;     // 0.0–1.0
  readonly verifiedAt: string;
  readonly metadata: Record<string, unknown>;
}

export interface VerificationResult {
  readonly claim: string;
  readonly verified: boolean;
  readonly confidence: number;
  readonly tier: VerificationTier;
  readonly citations: Citation[];
  readonly latencyMs: number;
  readonly failureReason?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// GUARDRAILS
// ════════════════════════════════════════════════════════════════════════════

export interface GuardrailViolation {
  readonly rule: string;
  readonly severity: "block" | "warn" | "sanitize";
  readonly original: string;
  readonly sanitized: string | null;
  readonly reason: string;
}

export interface GuardrailResult {
  readonly passed: boolean;
  readonly violations: GuardrailViolation[];
  readonly safeOutput: string;
  readonly blockedCompletely: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// CONVERSATION / SESSION
// ════════════════════════════════════════════════════════════════════════════

export interface ConversationMessage {
  readonly role: "user" | "assistant" | "system" | "admin";
  readonly content: string;
  readonly timestamp: string;
  readonly source?: "user" | "assistant" | "admin" | "fate" | "system";
  readonly metadata?: Record<string, unknown>;
}

export interface SessionInsights {
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  roomType?: string;
  style?: string;
  budget?: string;
  urgency?: string;
  familySize?: string;
  lifestyle?: string;
  concerns?: string;
  lastTopic?: string;
  summary?: string;
  location?: string;
  gpsLocation?: string;
  conversionStage?: string;
  mood?: string;
  pipelineStage?: LeadStage;
  [key: string]: string | undefined;
}

export interface VanguardSession {
  readonly sessionId: string;
  messages: ConversationMessage[];
  insights: SessionInsights;
  uiState: Record<string, unknown>;
  pipelineStage?: LeadStage;
  coachingNotes: CoachingNote[];
  verificationLog: VerificationLogEntry[];
  consciousnessState?: ConsciousnessStateSnapshot;
  autonomousActions: AutonomousAction[];
  createdAt: string;
  updatedAt: string;
}

// ════════════════════════════════════════════════════════════════════════════
// LEAD / PIPELINE
// ════════════════════════════════════════════════════════════════════════════

export interface RiskFactor {
  readonly factor: string;
  readonly severity: RiskSeverity;
  readonly mitigation: string;
}

export interface Lead {
  readonly id: string;
  sessionId: string;
  stage: LeadStage;
  tier: LeadTier | null;
  score: number; // 0–100
  roomSlug: string | null;
  materialPreferences: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  urgency: LeadUrgency | null;
  nextAction: string | null;
  assignedTo: string;
  probability: number; // 0.0–1.0
  predictedValue: number | null; // EGP
  predictedCloseDate: string | null;
  riskFactors: RiskFactor[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

/**
 * Pipeline type — represents a lead in vanguard_leads table
 * Alias for Lead, with database column names for SQL queries
 */
export interface Pipeline {
  readonly id: string;
  session_id: string;
  stage: string; // 'new','qualified','quoted','negotiating','contracted','won','lost'
  tier: string | null;
  score: number;
  room_slug: string | null;
  material_preferences: string[];
  budget_min: number | null;
  budget_max: number | null;
  urgency: string | null;
  next_action: string | null;
  assigned_to: string;
  probability: number;
  predicted_value: number | null;
  predicted_close_date: string | null;
  risk_factors: unknown[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  status?: 'closed_won' | 'closed_lost' | 'open'; // Derived field for pattern detection
  value?: number | null; // Alias for predicted_value
}


// ════════════════════════════════════════════════════════════════════════════
// COACHING
// ════════════════════════════════════════════════════════════════════════════

export interface CoachingNote {
  readonly id: string;
  readonly content: string;
  readonly type: "hint" | "warning" | "opportunity" | "pattern";
  readonly confidence: number;
  readonly sourcePattern: string | null;
  readonly createdAt: string;
}

// ════════════════════════════════════════════════════════════════════════════
// AUTONOMOUS ACTIONS
// ════════════════════════════════════════════════════════════════════════════

export interface AutonomousAction {
  readonly id: string;
  readonly type: string;
  readonly description: string;
  readonly payload: Record<string, unknown>;
  readonly result: Record<string, unknown> | null;
  readonly status: "pending" | "success" | "failed";
  readonly executedAt: string | null;
  readonly createdAt: string;
}

// ════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE GRAPH
// ════════════════════════════════════════════════════════════════════════════

export interface KnowledgeEntity {
  readonly id: string;
  readonly type: "material" | "product" | "room" | "process" | "certification" | "concept";
  readonly slug: string;
  readonly nameAr: string;
  readonly nameEn: string | null;
  readonly properties: Record<string, unknown>;
  readonly embedding?: number[];
  readonly confidence: number;
  readonly citations: Citation[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface KnowledgeRelation {
  readonly id: string;
  readonly fromType: string;
  readonly fromId: string;
  readonly toType: string;
  readonly toId: string;
  readonly relationType:
    | "used_in"
    | "compatible_with"
    | "part_of"
    | "package_includes"
    | "requires"
    | "alternative_to"
    | "incompatible_with"
    | "related_to";
  readonly properties: Record<string, unknown>;
  readonly confidence: number;
  readonly citations: Citation[];
  readonly createdAt: string;
}

// ════════════════════════════════════════════════════════════════════════════
// BACKGROUND SWARM
// ════════════════════════════════════════════════════════════════════════════

export interface BackgroundTask {
  readonly id: string;
  readonly agentName: string;
  readonly taskType: string;
  status: "pending" | "running" | "completed" | "failed" | "scheduled";
  priority: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  scheduledFor: string | null;
  recurring: boolean;
  cronExpression: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SwarmAgentConfig {
  readonly name: string;
  readonly description: string;
  readonly schedule: string; // cron expression
  readonly priority: number;
  readonly maxConcurrency: number;
  readonly timeoutMs: number;
  readonly retryCount: number;
}

// ════════════════════════════════════════════════════════════════════════════
// INTENT ANALYSIS
// ════════════════════════════════════════════════════════════════════════════

export interface IntentAnalysis {
  readonly primaryIntent: IntentCategory;
  readonly secondaryIntents: IntentCategory[];
  readonly confidence: number;
  readonly entities: ExtractedEntity[];
  readonly sentiment: SentimentResult;
  readonly urgency: "immediate" | "normal" | "low";
  readonly requiresEscalation: boolean;
  readonly requiresVerification: boolean;
  readonly suggestedActions: string[];
}

export interface ExtractedEntity {
  readonly type: "room" | "material" | "style" | "budget" | "phone" | "location" | "name" | "date";
  readonly value: string;
  readonly normalized: string | null;
  readonly confidence: number;
  readonly span: readonly [number, number]; // [start, end] char positions
}

export interface SentimentResult {
  readonly overall: "positive" | "negative" | "neutral" | "mixed";
  readonly score: number;   // -1.0 to 1.0
  readonly emotions: {
    readonly satisfaction: number;
    readonly frustration: number;
    readonly excitement: number;
    readonly hesitation: number;
    readonly trust: number;
  };
}

// ════════════════════════════════════════════════════════════════════════════
// PLAN / REASONING
// ════════════════════════════════════════════════════════════════════════════

export interface ThoughtStep {
  readonly stepNumber: number;
  readonly thought: string;
  readonly action: string | null;
  readonly observation: string | null;
  readonly confidence: number;
}

export interface ReasoningTrace {
  readonly id: string;
  readonly query: string;
  readonly steps: ThoughtStep[];
  readonly conclusion: string;
  readonly confidence: number;
  readonly latencyMs: number;
  readonly createdAt: string;
}

export interface PlanStep {
  readonly id: string;
  readonly description: string;
  readonly toolName: string | null;
  readonly toolArgs: Record<string, unknown>;
  readonly estimatedDurationMs: number;
  readonly dependencies: string[]; // step IDs
  readonly rollbackDescription: string | null;
}

export interface ExecutionPlan {
  readonly id: string;
  readonly goalId: string;
  readonly steps: PlanStep[];
  readonly estimatedTotalMs: number;
  readonly riskLevel: RiskSeverity;
  readonly createdAt: string;
}

export interface StepExecutionResult {
  readonly stepId: string;
  readonly success: boolean;
  readonly result: unknown;
  readonly error: VanguardError | null;
  readonly latencyMs: number;
  readonly executedAt: string;
}

// ════════════════════════════════════════════════════════════════════════════
// EVOLUTION
// ════════════════════════════════════════════════════════════════════════════

export interface EvolutionChange {
  readonly type: "strategy_update" | "new_capability" | "prompt_optimization" | "rule_update";
  readonly description: string;
  readonly diff: string | null;
  readonly testsPass: boolean;
  readonly appliedAt: string | null;
}

export interface EvolutionResult {
  readonly id: string;
  readonly triggerType: "scheduled" | "performance_threshold" | "error_threshold" | "manual";
  readonly changes: EvolutionChange[];
  readonly strategyUpdates: Record<string, unknown>[];
  readonly newCapabilities: string[];
  readonly performanceBefore: Record<string, number>;
  readonly performanceAfter: Record<string, number>;
  readonly rollbackPerformed: boolean;
  readonly rollbackReason: string | null;
  readonly status: "completed" | "rolled_back" | "failed";
  readonly createdAt: string;
}

// ════════════════════════════════════════════════════════════════════════════
// OBSERVABILITY
// ════════════════════════════════════════════════════════════════════════════

export interface ApiUsageRecord {
  readonly apiName: string;
  readonly endpoint: string;
  readonly method: string;
  readonly statusCode: number;
  readonly latencyMs: number;
  readonly tokensUsed: number | null;
  readonly costUsd: number | null;
  readonly sessionId: string | null;
  readonly timestamp: string;
}

export interface VerificationLogEntry {
  readonly sessionId: string;
  readonly claim: string;
  readonly tierUsed: VerificationTier;
  readonly citations: Citation[];
  readonly confidence: number;
  readonly verified: boolean;
  readonly latencyMs: number;
  readonly timestamp: string;
}

export interface ConsciousnessStateSnapshot {
  readonly state: ConsciousnessState;
  readonly activeGoalCount: number;
  readonly attentionFocus: string | null;
  readonly cycleCount: number;
  readonly timestamp: string;
}

// ════════════════════════════════════════════════════════════════════════════
// MARKET INTELLIGENCE
// ════════════════════════════════════════════════════════════════════════════

export interface MarketSignal {
  readonly id: string;
  readonly type: "price_change" | "competitor_activity" | "demand_shift" | "regulation" | "opportunity";
  readonly description: string;
  readonly source: string;
  readonly confidence: number;
  readonly impact: RiskSeverity;
  readonly actionable: boolean;
  readonly detectedAt: string;
}

export interface Competitor {
  readonly id: string;
  readonly name: string;
  readonly website: string | null;
  readonly priceRange: "budget" | "mid" | "premium" | "luxury";
  readonly strengths: string[];
  readonly weaknesses: string[];
  readonly lastChecked: string;
}

// ════════════════════════════════════════════════════════════════════════════
// ENRICHMENT SERVICES
// ════════════════════════════════════════════════════════════════════════════

export interface WeatherData {
  readonly city: string;
  readonly tempC: number;
  readonly condition: string;
  readonly conditionAr: string;
  readonly humidity: number;
  readonly feelsLikeC: number;
  readonly fetchedAt: string;
}

export interface HolidayInfo {
  readonly date: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly isPublicHoliday: boolean;
}

export interface EgpRateInfo {
  readonly usdToEgp: number;
  readonly eurToEgp: number;
  readonly source: string;
  readonly fetchedAt: string;
}

// ════════════════════════════════════════════════════════════════════════════
// DAILY BRIEF
// ════════════════════════════════════════════════════════════════════════════

export interface DailyBriefData {
  readonly date: string;
  readonly weather: WeatherData | null;
  readonly holidays: HolidayInfo[];
  readonly isWorkday: boolean;
  readonly leadsToday: number;
  readonly hotLeads: Lead[];
  readonly pendingActions: PendingAction[];
  readonly pipelineSummary: PipelineSummary;
  readonly risks: MarketSignal[];
  readonly opportunities: MarketSignal[];
  readonly backgroundActivity: BackgroundActivitySummary;
  readonly generatedAt: string;
}

export interface PendingAction {
  readonly id: string;
  readonly type: string;
  readonly descriptionAr: string;
  readonly priority: GoalPriority;
  readonly dueBy: string | null;
  readonly sessionId: string | null;
  readonly createdAt: string;
}

export interface PipelineSummary {
  readonly totalLeads: number;
  readonly byStage: Record<LeadStage, number>;
  readonly totalPredictedValue: number;
  readonly avgCloseProb: number;
  readonly hotLeadCount: number;
}

export interface BackgroundActivitySummary {
  readonly agentsRunning: number;
  readonly tasksCompleted24h: number;
  readonly insightsGenerated: number;
  readonly alertsTriggered: number;
  readonly lastEvolutionCycle: string | null;
}

// ════════════════════════════════════════════════════════════════════════════
// UNIFIED BRAIN REQUEST / RESPONSE
// ════════════════════════════════════════════════════════════════════════════

export interface BrainRequest {
  readonly message: string;
  readonly sessionId: string;
  readonly userName?: string;
  readonly userEmail?: string;
  readonly language?: "ar" | "en";
  readonly location?: ClientLocation;
  readonly history?: ConversationMessage[];
  readonly adminOverride?: boolean;
  readonly requestId?: string; // for idempotency
}

export interface BrainResponse {
  readonly reply: string;
  readonly sessionId: string;
  readonly uiAction?: string;
  readonly queued?: boolean;
  readonly verification?: VerificationResult;
  readonly proactiveNudge?: ProactiveNudge;
  readonly coachingHint?: CoachingNote;
  readonly intentAnalysis?: IntentAnalysis;
  readonly requestId?: string;
  readonly latencyMs: number;
  readonly model: string;
}

export interface ProactiveNudge {
  readonly id: string;
  readonly type: "opportunity" | "risk" | "capability" | "follow_up" | "market_insight";
  readonly titleAr: string;
  readonly bodyAr: string;
  readonly actionLabel?: string;
  readonly actionPayload?: Record<string, unknown>;
  readonly confidence: number;
  readonly priority: GoalPriority;
  readonly expiresAt: string | null;
}

export interface ClientLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy?: number;
  readonly label?: string;
  readonly address?: string;
  readonly source: "browser";
  readonly capturedAt: string;
}

// ════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ════════════════════════════════════════════════════════════════════════════

export function isValidLeadStage(value: unknown): value is LeadStage {
  return typeof value === "string" && Object.values(LeadStage).includes(value as LeadStage);
}

export function isValidGoalPriority(value: unknown): value is GoalPriority {
  return typeof value === "number" && Object.values(GoalPriority).includes(value as GoalPriority);
}

export function isClientLocation(value: unknown): value is ClientLocation {
  if (typeof value !== "object" || value === null) return false;
  const loc = value as Record<string, unknown>;
  return (
    typeof loc.latitude === "number" &&
    typeof loc.longitude === "number" &&
    typeof loc.source === "string" &&
    loc.source === "browser"
  );
}

export function isBrainRequest(value: unknown): value is BrainRequest {
  if (typeof value !== "object" || value === null) return false;
  const req = value as Record<string, unknown>;
  return typeof req.message === "string" && typeof req.sessionId === "string";
}
