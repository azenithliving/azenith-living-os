import { Logger } from "../utils/logger";
import type { Event, EventHandler } from "../types";

const logger = new Logger("AACA-Degraded");

/** In-process event bus when Redis is unavailable */
export class MemoryEventBus {
  private connected = false;
  private handlers = new Map<string, Set<EventHandler>>();
  private patternHandlers: Array<{ pattern: string; handler: EventHandler }> = [];

  async connect(): Promise<void> {
    this.connected = true;
    logger.warn("MemoryEventBus active (no Redis)");
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.handlers.clear();
    this.patternHandlers = [];
  }

  async publish(
    event: Omit<Event, "id" | "createdAt" | "processed" | "processedAt">
  ): Promise<string> {
    const id = `mem-${Date.now()}`;
    const full: Event = {
      ...event,
      id,
      createdAt: new Date(),
      processed: true,
      processedAt: new Date(),
    };

    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      for (const h of typeHandlers) {
        void h.handler(full).catch(() => undefined);
      }
    }

    for (const sub of this.patternHandlers) {
      if (this.matchPattern(sub.pattern, event.type)) {
        void sub.handler.handler(full).catch(() => undefined);
      }
    }
    return id;
  }

  async subscribe(eventType: string, handler: EventHandler): Promise<void> {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  async subscribePattern(pattern: string, handler: EventHandler): Promise<void> {
    this.patternHandlers.push({ pattern, handler });
  }

  getStats(): { handlers: number; patterns: number; connected: boolean } {
    let handlerCount = 0;
    this.handlers.forEach((set) => {
      handlerCount += set.size;
    });
    return {
      handlers: handlerCount + this.patternHandlers.length,
      patterns: this.patternHandlers.length,
      connected: this.connected,
    };
  }

  private matchPattern(pattern: string, channel: string): boolean {
    const regex = new RegExp(`^${pattern.replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
    return regex.test(channel);
  }
}

/** No-op queue manager — agents load but jobs are not persisted */
export class DegradedQueueManager {
  private queueNames = [
    "orchestrator",
    "dev-agent",
    "security-agent",
    "qa-agent",
    "ops-agent",
    "communication-agent",
    "evolution-agent",
  ];

  async initialize(): Promise<void> {
    logger.warn("DegradedQueueManager — BullMQ disabled");
  }

  async addWorker(_queue: string, _processor: (job: unknown) => Promise<unknown>): Promise<void> {}

  async addJob(
    _queue: string,
    _name: string,
    _data: unknown,
    _opts?: unknown
  ): Promise<string> {
    return `degraded-${Date.now()}`;
  }

  async removeJob(_queue: string, _jobId: string): Promise<void> {}

  getQueueNames(): string[] {
    return this.queueNames;
  }

  async getQueueStatus(name: string): Promise<{
    name: string;
    waiting: number;
    active: number;
    degraded: boolean;
  }> {
    return { name, waiting: 0, active: 0, degraded: true };
  }

  async pauseQueue(_name: string): Promise<void> {}
  async resumeQueue(_name: string): Promise<void> {}
  async close(): Promise<void> {}
}

export class DegradedTaskWorker {
  private running = false;

  async start(): Promise<void> {
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  getStats(): { running: boolean; processed: number; failed: number; degraded: boolean } {
    return { running: this.running, processed: 0, failed: 0, degraded: true };
  }
}
