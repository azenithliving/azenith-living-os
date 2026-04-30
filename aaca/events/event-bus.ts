import { createClient, RedisClientType } from 'redis';
import { Event, EventHandler, LogLevel } from '../types';
import { Logger } from '../utils/logger';

interface EventBusConfig {
  redisUrl: string;
  maxListeners?: number;
}

interface EventSubscription {
  pattern: string;
  handler: EventHandler;
  active: boolean;
}

export class EventBus {
  private publisher: RedisClientType;
  private subscriber: RedisClientType;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private patternHandlers: EventSubscription[] = [];
  private logger: Logger;
  private isConnected: boolean = false;
  private config: EventBusConfig;

  constructor(config: EventBusConfig) {
    this.config = config;
    this.logger = new Logger('EventBus');
    this.publisher = createClient({ url: config.redisUrl });
    this.subscriber = createClient({ url: config.redisUrl });

    this.setupErrorHandlers();
  }

  private setupErrorHandlers(): void {
    this.publisher.on('error', (err) => {
      this.logger.error('Publisher error', { error: err.message });
    });

    this.subscriber.on('error', (err) => {
      this.logger.error('Subscriber error', { error: err.message });
    });

    this.subscriber.on('message', (channel, message) => {
      this.handleMessage(channel, message);
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      await this.publisher.connect();
      await this.subscriber.connect();
      this.isConnected = true;
      this.logger.info('EventBus connected to Redis');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    await this.publisher.quit();
    await this.subscriber.quit();
    this.isConnected = false;
    this.logger.info('EventBus disconnected');
  }

  async publish(event: Omit<Event, 'id' | 'createdAt' | 'processed' | 'processedAt'>): Promise<string> {
    if (!this.isConnected) {
      throw new Error('EventBus not connected');
    }

    const fullEvent: Event = {
      ...event,
      id: this.generateId(),
      createdAt: new Date(),
      processed: false
    };

    const channel = `events:${event.type}`;
    const payload = JSON.stringify(fullEvent);

    try {
      await this.publisher.publish(channel, payload);
      
      // Also publish to 'events:all' for catch-all subscribers
      await this.publisher.publish('events:all', payload);

      this.logger.debug('Event published', { 
        type: event.type, 
        channel,
        eventId: fullEvent.id 
      });

      return fullEvent.id;
    } catch (error) {
      this.logger.error('Failed to publish event', { 
        error: error instanceof Error ? error.message : String(error),
        type: event.type 
      });
      throw error;
    }
  }

  async subscribe(eventType: string, handler: EventHandler): Promise<void> {
    if (!this.isConnected) {
      throw new Error('EventBus not connected');
    }

    const channel = `events:${eventType}`;

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
      await this.subscriber.subscribe(channel, (message) => {
        this.handleChannelMessage(eventType, message);
      });
    }

    this.handlers.get(eventType)?.add(handler);

    this.logger.info('Subscribed to event type', { 
      eventType, 
      channel,
      totalHandlers: this.handlers.get(eventType)?.size 
    });
  }

  async subscribePattern(pattern: string, handler: EventHandler): Promise<void> {
    if (!this.isConnected) {
      throw new Error('EventBus not connected');
    }

    this.patternHandlers.push({
      pattern,
      handler,
      active: true
    });

    await this.subscriber.pSubscribe(pattern, (message, channel) => {
      this.handlePatternMessage(pattern, channel, message);
    });

    this.logger.info('Subscribed to pattern', { pattern });
  }

  async unsubscribe(eventType: string, handler: EventHandler): Promise<void> {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      
      if (handlers.size === 0) {
        const channel = `events:${eventType}`;
        await this.subscriber.unsubscribe(channel);
        this.handlers.delete(eventType);
      }
    }

    this.logger.info('Unsubscribed from event type', { eventType });
  }

  async unsubscribePattern(pattern: string, handler: EventHandler): Promise<void> {
    const index = this.patternHandlers.findIndex(
      sub => sub.pattern === pattern && sub.handler === handler
    );
    
    if (index !== -1) {
      this.patternHandlers[index].active = false;
      this.patternHandlers.splice(index, 1);
      await this.subscriber.pUnsubscribe(pattern);
    }

    this.logger.info('Unsubscribed from pattern', { pattern });
  }

  private handleChannelMessage(eventType: string, message: string): void {
    try {
      const event: Event = JSON.parse(message);
      const handlers = this.handlers.get(eventType);
      
      if (handlers) {
        handlers.forEach(handler => {
          this.executeHandler(handler, event).catch(err => {
            this.logger.error('Handler execution failed', { 
              error: err instanceof Error ? err.message : String(err),
              eventType 
            });
          });
        });
      }
    } catch (error) {
      this.logger.error('Failed to parse channel message', { 
        error: error instanceof Error ? error.message : String(error),
        eventType 
      });
    }
  }

  private handlePatternMessage(pattern: string, channel: string, message: string): void {
    try {
      const event: Event = JSON.parse(message);
      
      this.patternHandlers
        .filter(sub => sub.pattern === pattern && sub.active)
        .forEach(sub => {
          this.executeHandler(sub.handler, event).catch(err => {
            this.logger.error('Pattern handler execution failed', { 
              error: err instanceof Error ? err.message : String(err),
              pattern,
              channel 
            });
          });
        });
    } catch (error) {
      this.logger.error('Failed to parse pattern message', { 
        error: error instanceof Error ? error.message : String(error),
        pattern,
        channel 
      });
    }
  }

  private handleMessage(channel: string, message: string): void {
    try {
      const event: Event = JSON.parse(message);
      const eventType = channel.replace('events:', '');
      
      // Direct handlers
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        handlers.forEach(handler => {
          this.executeHandler(handler, event).catch(err => {
            this.logger.error('Handler execution failed', { 
              error: err instanceof Error ? err.message : String(err) 
            });
          });
        });
      }

      // Pattern handlers
      this.patternHandlers
        .filter(sub => sub.active && this.matchPattern(sub.pattern, channel))
        .forEach(sub => {
          this.executeHandler(sub.handler, event).catch(err => {
            this.logger.error('Pattern handler execution failed', { 
              error: err instanceof Error ? err.message : String(err) 
            });
          });
        });
    } catch (error) {
      this.logger.error('Failed to handle message', { 
        error: error instanceof Error ? error.message : String(error),
        channel 
      });
    }
  }

  private async executeHandler(handler: EventHandler, event: Event): Promise<void> {
    const startTime = Date.now();
    
    try {
      await handler.handler(event);
      
      this.logger.debug('Handler executed successfully', {
        eventType: event.type,
        eventId: event.id,
        durationMs: Date.now() - startTime
      });
    } catch (error) {
      this.logger.error('Handler execution error', {
        eventType: event.type,
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private matchPattern(pattern: string, channel: string): boolean {
    // Convert Redis pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(channel);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Utility method for request-response pattern
  async request<T>(
    eventType: string, 
    payload: Record<string, unknown>, 
    timeoutMs: number = 30000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const correlationId = this.generateId();
      const responseChannel = `responses:${correlationId}`;

      const timeout = setTimeout(() => {
        this.subscriber.unsubscribe(responseChannel);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.subscriber.subscribe(responseChannel, (message) => {
        clearTimeout(timeout);
        this.subscriber.unsubscribe(responseChannel);
        
        try {
          const response = JSON.parse(message);
          resolve(response as T);
        } catch (error) {
          reject(error);
        }
      }).then(() => {
        this.publish({
          type: eventType,
          source: 'requester',
          payload: {
            ...payload,
            _correlationId: correlationId,
            _responseChannel: responseChannel
          }
        }).catch(reject);
      });
    });
  }

  getStats(): { handlers: number; patterns: number; connected: boolean } {
    let handlerCount = 0;
    this.handlers.forEach(handlers => {
      handlerCount += handlers.size;
    });

    return {
      handlers: handlerCount,
      patterns: this.patternHandlers.length,
      connected: this.isConnected
    };
  }
}

// Singleton instance
let eventBusInstance: EventBus | null = null;

export function getEventBus(config?: EventBusConfig): EventBus {
  if (!eventBusInstance && config) {
    eventBusInstance = new EventBus(config);
  }
  
  if (!eventBusInstance) {
    throw new Error('EventBus not initialized');
  }
  
  return eventBusInstance;
}

export function resetEventBus(): void {
  eventBusInstance = null;
}
