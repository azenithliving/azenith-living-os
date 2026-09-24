/**
 * VANGUARD Phase 5: Smart Automation - Data Operations Actions
 * 
 * Actions for data manipulation and API calls
 */

import { BaseAction, ActionContext, ActionConfig, ActionResult, ActionRegistry } from './base_action';
import { createClient } from '@/utils/supabase/client';

// HTTP Request Action
export class HttpRequestAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { url, method, headers, body, timeout } = config.params;

      const resolvedUrl = this.resolveTemplate(url, context.variables);
      const resolvedHeaders: Record<string, string> = {};
      
      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          resolvedHeaders[key] = this.resolveTemplate(String(value), context.variables);
        }
      }

      const resolvedBody = body 
        ? JSON.parse(this.resolveTemplate(JSON.stringify(body), context.variables))
        : undefined;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout || 30000);

      const response = await fetch(resolvedUrl, {
        method: method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...resolvedHeaders,
        },
        body: resolvedBody ? JSON.stringify(resolvedBody) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await this.publishEvent('http.request_completed', {
        url: resolvedUrl,
        method,
        status: response.status,
      }, context);

      return {
        success: true,
        data: responseData,
        metadata: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'HTTP request failed',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return this.validateRequired(config, ['url']);
  }
}

// Query Database Action
export class QueryDatabaseAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { table, operation, filters, data, select } = config.params;

      const supabase = createClient();
      let query: any = supabase.from(table);

      // Build query based on operation
      switch (operation) {
        case 'select':
          query = query.select(select || '*');
          if (filters) {
            for (const [field, value] of Object.entries(filters)) {
              const resolvedValue = typeof value === 'string'
                ? this.resolveTemplate(value, context.variables)
                : value;
              query = query.eq(field, resolvedValue);
            }
          }
          break;

        case 'insert':
          const resolvedData = this.resolveObjectTemplates(data, context.variables);
          query = query.insert(resolvedData).select();
          break;

        case 'update':
          const resolvedUpdates = this.resolveObjectTemplates(data, context.variables);
          query = query.update(resolvedUpdates);
          if (filters) {
            for (const [field, value] of Object.entries(filters)) {
              const resolvedValue = typeof value === 'string'
                ? this.resolveTemplate(value, context.variables)
                : value;
              query = query.eq(field, resolvedValue);
            }
          }
          query = query.select();
          break;

        case 'delete':
          if (filters) {
            for (const [field, value] of Object.entries(filters)) {
              const resolvedValue = typeof value === 'string'
                ? this.resolveTemplate(value, context.variables)
                : value;
              query = query.eq(field, resolvedValue);
            }
          }
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      const { data: result, error } = await query;
      if (error) throw error;

      return {
        success: true,
        data: result,
        metadata: {
          table,
          operation,
          rowCount: Array.isArray(result) ? result.length : result ? 1 : 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Database query failed',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    const validation = this.validateRequired(config, ['table', 'operation']);
    if (!validation.valid) return validation;

    const validOperations = ['select', 'insert', 'update', 'delete'];
    if (!validOperations.includes(config.params.operation)) {
      return { valid: false, error: `Invalid operation. Must be one of: ${validOperations.join(', ')}` };
    }

    return { valid: true };
  }

  private resolveObjectTemplates(obj: any, variables: Record<string, any>): any {
    if (typeof obj === 'string') {
      return this.resolveTemplate(obj, variables);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveObjectTemplates(item, variables));
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.resolveObjectTemplates(value, variables);
      }
      return result;
    }
    return obj;
  }
}

// Transform Data Action
export class TransformDataAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { input, transformations } = config.params;
      
      let data = context.variables[input] || input;

      // Apply transformations sequentially
      for (const transformation of transformations) {
        data = this.applyTransformation(data, transformation, context.variables);
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Data transformation failed',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return this.validateRequired(config, ['input', 'transformations']);
  }

  private applyTransformation(data: any, transformation: any, variables: Record<string, any>): any {
    const { type, params } = transformation;

    switch (type) {
      case 'map':
        if (!Array.isArray(data)) throw new Error('Map transformation requires array input');
        return data.map(item => {
          const result: Record<string, any> = {};
          for (const [key, value] of Object.entries(params.mapping)) {
            result[key] = typeof value === 'string' && value.startsWith('$')
              ? item[value.slice(1)]
              : value;
          }
          return result;
        });

      case 'filter':
        if (!Array.isArray(data)) throw new Error('Filter transformation requires array input');
        return data.filter(item => this.evaluateCondition(item, params.condition));

      case 'reduce':
        if (!Array.isArray(data)) throw new Error('Reduce transformation requires array input');
        return data.reduce((acc, item) => {
          return params.operation === 'sum' 
            ? acc + (item[params.field] || 0)
            : params.operation === 'count'
            ? acc + 1
            : acc;
        }, params.initial || 0);

      case 'extract':
        return params.path.split('.').reduce((obj: any, key: string) => obj?.[key], data);

      case 'format':
        return this.resolveTemplate(params.template, { data, ...variables });

      default:
        throw new Error(`Unknown transformation type: ${type}`);
    }
  }

  private evaluateCondition(item: any, condition: any): boolean {
    const { field, operator, value } = condition;
    const itemValue = item[field];

    switch (operator) {
      case 'eq': return itemValue === value;
      case 'ne': return itemValue !== value;
      case 'gt': return itemValue > value;
      case 'gte': return itemValue >= value;
      case 'lt': return itemValue < value;
      case 'lte': return itemValue <= value;
      case 'contains': return String(itemValue).includes(String(value));
      case 'startsWith': return String(itemValue).startsWith(String(value));
      case 'endsWith': return String(itemValue).endsWith(String(value));
      default: return false;
    }
  }
}

// Wait Action
export class WaitAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { duration, unit } = config.params;
      
      const milliseconds = unit === 'seconds' 
        ? duration * 1000
        : unit === 'minutes'
        ? duration * 60 * 1000
        : unit === 'hours'
        ? duration * 60 * 60 * 1000
        : duration;

      await new Promise(resolve => setTimeout(resolve, milliseconds));

      return {
        success: true,
        data: { waited: milliseconds, unit },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Wait action failed',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    const validation = this.validateRequired(config, ['duration']);
    if (!validation.valid) return validation;

    if (config.params.duration < 0) {
      return { valid: false, error: 'Duration must be positive' };
    }

    return { valid: true };
  }
}

// Register data actions
ActionRegistry.register('http_request', new HttpRequestAction());
ActionRegistry.register('query_database', new QueryDatabaseAction());
ActionRegistry.register('transform_data', new TransformDataAction());
ActionRegistry.register('wait', new WaitAction());
