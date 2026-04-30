/**
 * Agent Types - TypeScript definitions for 100% real agent capabilities
 * 
 * These types correspond to the new database tables in migration 031
 * and provide type safety for all agent operations.
 */

import { Database } from "./supabase/database.types";

// ============================================
// Core Database Types from Supabase
// ============================================
export type Tables = Database["public"]["Tables"];

export type AgentExecution = Tables["agent_executions"]["Row"];
export type AgentExecutionInsert = Tables["agent_executions"]["Insert"];
export type AgentExecutionUpdate = Tables["agent_executions"]["Update"];

export type SEOAnalysisResult = Tables["seo_analysis_results"]["Row"];
export type SEOAnalysisResultInsert = Tables["seo_analysis_results"]["Insert"];

export type ContentRevision = Tables["content_revisions"]["Row"];
export type ContentRevisionInsert = Tables["content_revisions"]["Insert"];
export type ContentRevisionUpdate = Tables["content_revisions"]["Update"];

export type SiteSection = Tables["site_sections"]["Row"];
export type SiteSectionInsert = Tables["site_sections"]["Insert"];
export type SiteSectionUpdate = Tables["site_sections"]["Update"];

export type BackupSnapshot = Tables["backup_snapshots"]["Row"];
export type BackupSnapshotInsert = Tables["backup_snapshots"]["Insert"];
export type BackupSnapshotUpdate = Tables["backup_snapshots"]["Update"];

// ============================================
// Execution Types
// ============================================

export type ExecutionType =
  | "seo_analysis"
  | "content_update"
  | "content_create"
  | "backup"
  | "section_create"
  | "section_update"
  | "section_delete"
  | "setting_update"
  | "automation_rule"
  | "api_call"
  | "file_operation"
  | "database_operation"
  | "speed_optimization"
  | "security_audit"
  | "revenue_analysis"
  | "affiliate_setup"
  | "adsense_setup"
  | "general_chat";

export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "rolled_back";

// ============================================
// SEO Analysis Types
// ============================================

export interface MetaTagAnalysis {
  value: string;
  length: number;
  optimal: { min: number; max: number };
  isOptimal: boolean;
  score: number;
}

export interface MetaTagsAnalysis {
  title: MetaTagAnalysis;
  description: MetaTagAnalysis;
  ogTitle?: MetaTagAnalysis;
  ogDescription?: MetaTagAnalysis;
  canonical?: { value: string; valid: boolean };
  viewport?: { value: string; mobileOptimized: boolean };
  charset?: { value: string; valid: boolean };
}

export interface HeadingNode {
  level: number;
  text: string;
  id?: string;
}

export interface HeadingsAnalysis {
  h1: HeadingNode[];
  h2: HeadingNode[];
  h3: HeadingNode[];
  h4: HeadingNode[];
  h5: HeadingNode[];
  h6: HeadingNode[];
  hierarchyValid: boolean;
  multipleH1: boolean;
  missingH1: boolean;
}

export interface ImageInfo {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  size?: number;
  format?: string;
  hasAlt: boolean;
  isModernFormat: boolean;
  isLazyLoaded: boolean;
}

export interface ImagesAnalysis {
  total: number;
  withoutAlt: number;
  oversized: number; // > 1MB
  modernFormat: number; // WebP, AVIF
  lazyLoaded: number;
  images: ImageInfo[];
}

export interface LinkInfo {
  url: string;
  text: string;
  isExternal: boolean;
  isNofollow: boolean;
  isBroken?: boolean;
}

export interface LinksAnalysis {
  internal: number;
  external: number;
  nofollow: number;
  broken?: number;
  links: LinkInfo[];
}

export interface PerformanceMetrics {
  loadTimeMs: number;
  pageSizeKb: number;
  requestsCount: number;
  mobileFriendly: boolean;
  hasHttps: boolean;
  serverResponseTime?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
}

export interface SEOIssue {
  code: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "meta" | "headings" | "images" | "links" | "performance" | "mobile";
  message: string;
  element?: string;
  recommendation: string;
  autoFixable: boolean;
  estimatedImpact: number; // 0-100
}

export interface SEORecommendation {
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  expectedImpact: string;
  autoFixable: boolean;
  estimatedTime: string;
  steps?: string[];
}

export interface SEOAnalysis {
  pageUrl: string;
  pageTitle?: string;
  score: number;
  scoreBreakdown: {
    meta: number;
    headings: number;
    images: number;
    links: number;
    performance: number;
    mobile: number;
  };
  metaTags: MetaTagsAnalysis;
  headings: HeadingsAnalysis;
  images: ImagesAnalysis;
  links: LinksAnalysis;
  performance: PerformanceMetrics;
  issues: SEOIssue[];
  recommendations: SEORecommendation[];
  rawHtmlSnapshot?: string;
}

// ============================================
// Content Revision Types
// ============================================

export type RevisionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "applied"
  | "rejected"
  | "rolled_back";

export type ChangeCategory =
  | "seo"
  | "content"
  | "design"
  | "automation"
  | "manual"
  | "system";

export interface RevisionWithDetails extends ContentRevision {
  created_by_email?: string;
  approved_by_email?: string;
  execution_type?: string;
  suggestion_title?: string;
}

// ============================================
// Site Section Types
// ============================================

export type SectionType =
  | "hero"
  | "features"
  | "testimonials"
  | "pricing"
  | "cta"
  | "content"
  | "gallery"
  | "faq"
  | "contact"
  | "team"
  | "stats"
  | "logos"
  | "newsletter"
  | "text"
  | "video"
  | "custom";

export type PlacementPosition =
  | "header"
  | "body_top"
  | "body_middle"
  | "body_bottom"
  | "footer";

export interface SectionLayout {
  type: "fullwidth" | "contained" | "split" | "grid";
  columns?: number;
  gap?: string;
  padding?: string;
  background?: "white" | "gray" | "dark" | "primary" | "custom";
  customBackgroundColor?: string;
}

export interface SectionContent {
  heading?: string;
  subheading?: string;
  body?: string;
  ctaText?: string;
  ctaLink?: string;
  media?: Array<{
    type: "image" | "video";
    url: string;
    alt?: string;
  }>;
  items?: Array<{
    title: string;
    description?: string;
    icon?: string;
    image?: string;
  }>;
}

export interface SectionConfig {
  layout: SectionLayout;
  colors?: {
    primary?: string;
    secondary?: string;
    text?: string;
    background?: string;
  };
  spacing?: {
    top?: string;
    bottom?: string;
  };
  animations?: {
    enabled: boolean;
    type?: "fade" | "slide" | "zoom";
    duration?: number;
  };
  responsive?: {
    mobile?: boolean;
    tablet?: boolean;
    desktop?: boolean;
  };
}

export interface VisibilityConditions {
  showFrom?: string;
  showUntil?: string;
  userSegments?: string[];
  devices?: ("mobile" | "tablet" | "desktop")[];
}

export interface RenderMetrics {
  renderCount: number;
  avgRenderTimeMs: number;
  lastRenderedAt?: string;
}

export interface SiteSectionWithDetails extends SiteSection {
  company_name?: string;
  created_by_email?: string;
  preview_url?: string;
}

// ============================================
// Backup Types
// ============================================

export type BackupType =
  | "database_full"
  | "database_partial"
  | "files"
  | "code"
  | "full_system";

export type BackupStatus =
  | "creating"
  | "completed"
  | "failed"
  | "restoring"
  | "restored"
  | "expired"
  | "deleted";

export type StorageProvider = "vercel_blob" | "s3" | "gcs" | "local";

export interface TableBackupInfo {
  table_name: string;
  row_count: number;
  size_bytes: number;
}

export interface FileBackupInfo {
  path: string;
  size_bytes: number;
  checksum: string;
}

export interface BackupScope {
  tables?: string[];
  files?: string[];
  exclude_patterns?: string[];
}

export interface RestorationResult {
  success: boolean;
  tablesRestored?: number;
  filesRestored?: number;
  errors?: string[];
  durationMs?: number;
}

export interface BackupSnapshotWithDetails extends BackupSnapshot {
  created_by_email?: string;
  tables_count?: number;
  files_count?: number;
}

// ============================================
// Agent Execution Result Types
// ============================================

export interface ExecutionResult<T = unknown> {
  success: boolean;
  executionId?: string;
  message: string;
  data?: T;
  error?: string;
  executionTimeMs?: number;
  requiresApproval?: boolean;
  approvalRequestId?: string;
  canRollback?: boolean;
  affectedRows?: number;
  affectedTables?: string[];
}

export interface ExecutionWithSEO extends ExecutionResult {
  data?: SEOAnalysis;
}

export interface ExecutionWithSection extends ExecutionResult {
  data?: {
    sectionId: string;
    previewUrl: string;
    section: SiteSection;
  };
}

export interface ExecutionWithBackup extends ExecutionResult {
  data?: {
    backupId: string;
    downloadUrl: string;
    sizeBytes: number;
    tables: string[];
    expiresAt: string;
  };
}

export interface ExecutionWithRevision extends ExecutionResult {
  data?: {
    revisionId: string;
    oldValue: unknown;
    newValue: unknown;
    canRollback: boolean;
  };
}

// ============================================
// Tool Execution Types
// ============================================

export interface ToolExecutionContext {
  executionId: string;
  companyId?: string;
  actorUserId?: string;
  commandLogId?: string;
  suggestionId?: string;
}

export interface ToolExecutionOptions {
  skipAudit?: boolean;
  requireApproval?: boolean;
  createRevision?: boolean;
  autoApprove?: boolean;
  learningEnabled?: boolean;
}

export type ToolName =
  | "seo_analyze"
  | "section_create"
  | "section_update"
  | "section_delete"
  | "backup_create"
  | "backup_restore"
  | "setting_update"
  | "content_update"
  | "speed_analyze"
  | "revenue_analyze"
  | "adsense_setup"
  | "affiliate_setup"
  | "automation_create"
  | "database_query"
  | "api_call"
  | "file_read"
  | "file_write"
  // Product Management Tools
  | "product_list"
  | "product_create"
  | "product_update"
  | "product_delete"
  | "product_get"
  | "category_list"
  | "category_create"
  | "inventory_update"
  | "inventory_check_low";

export interface ToolDefinition {
  name: ToolName;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required: boolean;
    default?: unknown;
  }>;
  requiresApproval: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
  category: string;
}

// ============================================
// Statistics and Metrics Types
// ============================================

export interface ExecutionStats {
  execution_type: string;
  total_count: number;
  completed_count: number;
  failed_count: number;
  avg_execution_time_ms: number;
  total_affected_rows: number;
}

export interface AgentHealth {
  isActive: boolean;
  mode: "active" | "paused" | "maintenance";
  lastCheck: string;
  nextCheck: string;
  pendingApprovals: number;
  actionsToday: number;
  anomaliesDetected: number;
  goalsActive: number;
  modelMesh: Array<{
    provider: string;
    healthy: boolean;
    keys: number;
  }>;
  capabilities: string[];
}

export interface PendingChangesSummary {
  totalPending: number;
  pendingByCategory: Record<ChangeCategory, number>;
  oldestPending: string;
  requiresAttention: boolean;
}

// ============================================
// View Types (from database views)
// ============================================

export interface AgentExecutionSummary {
  id: string;
  execution_type: ExecutionType;
  execution_status: ExecutionStatus;
  execution_time_ms: number | null;
  affected_tables: string[] | null;
  affected_rows: number | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  rollback_available: boolean;
  company_name: string | null;
  actor_email: string | null;
  seo_score: number | null;
}

export interface PendingContentChange extends ContentRevision {
  execution_type: string | null;
  suggestion_title: string | null;
  created_by_email: string | null;
  approved_by_email: string | null;
}

export interface ActiveSection extends SiteSection {
  company_name: string | null;
  created_by_email: string | null;
}

// ============================================
// Helper Types
// ============================================

export type Nullable<T> = T | null;

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface FilterOptions {
  status?: ExecutionStatus | ExecutionStatus[];
  type?: ExecutionType | ExecutionType[];
  dateFrom?: Date;
  dateTo?: Date;
  companyId?: string;
  actorId?: string;
}
