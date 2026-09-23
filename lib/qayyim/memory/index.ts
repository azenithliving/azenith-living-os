/**
 * Memory Layer - Export all memory components
 */

export { SharedMemory, sharedMemory } from "./SharedMemory";
export type { MemoryItem, SearchResult, LearningSearchResult } from "./SharedMemory";

export { VectorStore, vectorStore } from "./VectorStore";
export type { VectorSearchOptions, VectorStoreStats } from "./VectorStore";

export { KnowledgeGraph, knowledgeGraph } from "./KnowledgeGraph";
export type { GraphNode, GraphEdge, GraphPath, Subgraph } from "./KnowledgeGraph";

export { SyncLayer, syncLayer } from "./SyncLayer";
export type { SyncEvent, SyncEventType, SyncSubscription, AdvisoryLock } from "./SyncLayer";

export { SwarmLearnings, swarmLearnings } from "./SwarmLearnings";
export type { SwarmLearning, LearningSearchOptions, LearningApplication, LearningStats } from "./SwarmLearnings";
