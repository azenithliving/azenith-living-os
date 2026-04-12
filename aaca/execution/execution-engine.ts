import { prisma } from '../database/prisma-client';
import { EventBus } from '../events/event-bus';
import { Logger } from '../utils/logger';
import { ApprovalSystem } from '../approval/approval-system';
import { 
  AIAction, 
  ActionStatus, 
  ExecutionContext, 
  ExecutionResult,
  ExecutionLogEntry,
  LogLevel,
  CodeChange,
  PatchResult,
  ActionType
} from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ExecutionOptions {
  timeoutMs?: number;
  dryRun?: boolean;
  rollbackOnFailure?: boolean;
}

interface CodeExecutionPayload {
  changes: CodeChange[];
  basePath?: string;
  commitMessage?: string;
  createBackup?: boolean;
}

interface CommandExecutionPayload {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  allowed?: boolean;
}

interface DeploymentPayload {
  target: string;
  artifacts: string[];
  strategy: 'rolling' | 'blue-green' | 'canary' | 'immediate';
  healthCheckUrl?: string;
}

export class ExecutionEngine {
  private eventBus: EventBus;
  private approvalSystem: ApprovalSystem;
  private logger: Logger;
  private activeExecutions: Map<string, AbortController> = new Map();

  constructor(eventBus: EventBus, approvalSystem: ApprovalSystem) {
    this.eventBus = eventBus;
    this.approvalSystem = approvalSystem;
    this.logger = new Logger('ExecutionEngine');
  }

  async executeAction(
    action: AIAction, 
    context: ExecutionContext,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const { timeoutMs = 300000, dryRun = false, rollbackOnFailure = true } = options;
    
    this.logger.info('Starting action execution', {
      actionId: action.id,
      actionType: action.type,
      taskId: context.taskId,
      dryRun
    });

    // Verify approval if required
    if (action.requiresApproval) {
      const approval = await this.approvalSystem.getApprovalForAction(action.id);
      
      if (!approval || approval.status !== 'APPROVED') {
        const error = `Action ${action.id} requires approval but none found or not approved`;
        this.logger.error(error);
        
        await this.updateActionStatus(action.id, ActionStatus.REJECTED, undefined, error);
        
        return {
          success: false,
          error,
          logs: [],
          durationMs: 0
        };
      }
    }

    // Create abort controller for timeout
    const abortController = new AbortController();
    this.activeExecutions.set(action.id, abortController);

    const startTime = Date.now();
    const logs: ExecutionLogEntry[] = [];

    try {
      // Update action status to executing
      await this.updateActionStatus(action.id, ActionStatus.EXECUTING);

      // Log execution start
      await this.logExecutionStep(action.id, 'EXECUTION_START', 'Execution started', {
        dryRun,
        timeoutMs,
        actionType: action.type
      });

      logs.push({
        timestamp: new Date(),
        level: LogLevel.INFO,
        message: 'Execution started',
        metadata: { actionType: action.type, dryRun }
      });

      // Execute based on action type
      let result: unknown;

      switch (action.type) {
        case ActionType.WRITE_CODE:
          result = await this.executeCodeChange(
            action.payload as CodeExecutionPayload, 
            dryRun,
            abortController.signal,
            logs
          );
          break;

        case ActionType.EXECUTE_COMMAND:
          result = await this.executeCommand(
            action.payload as CommandExecutionPayload,
            abortController.signal,
            logs
          );
          break;

        case ActionType.DEPLOY:
          result = await this.executeDeployment(
            action.payload as DeploymentPayload,
            abortController.signal,
            logs
          );
          break;

        case ActionType.SEND_NOTIFICATION:
          result = await this.executeNotification(
            action.payload as Record<string, unknown>,
            logs
          );
          break;

        case ActionType.DELETE_RESOURCE:
          result = await this.executeDelete(
            action.payload as Record<string, unknown>,
            dryRun,
            abortController.signal,
            logs
          );
          break;

        case ActionType.MODIFY_CONFIG:
          result = await this.executeConfigChange(
            action.payload as Record<string, unknown>,
            dryRun,
            abortController.signal,
            logs
          );
          break;

        case ActionType.ROLLBACK:
          result = await this.executeRollback(
            action.payload as { targetActionId: string },
            abortController.signal,
            logs
          );
          break;

        default:
          result = await this.executeCustom(
            action.type,
            action.payload,
            abortController.signal,
            logs
          );
      }

      // Calculate duration
      const durationMs = Date.now() - startTime;

      // Update action as completed
      await this.updateActionStatus(action.id, ActionStatus.COMPLETED, result);

      // Store rollback data if applicable
      if (action.type === ActionType.WRITE_CODE && result && (result as PatchResult).success) {
        await this.storeRollbackData(action.id, result as PatchResult);
      }

      // Log completion
      await this.logExecutionStep(action.id, 'EXECUTION_COMPLETE', 'Execution completed successfully', {
        durationMs,
        result: JSON.stringify(result).slice(0, 1000)
      });

      logs.push({
        timestamp: new Date(),
        level: LogLevel.INFO,
        message: 'Execution completed',
        metadata: { durationMs }
      });

      // Publish completion event
      await this.eventBus.publish({
        type: 'execution:completed',
        source: 'execution-engine',
        payload: {
          actionId: action.id,
          taskId: context.taskId,
          success: true,
          durationMs,
          result
        }
      });

      this.activeExecutions.delete(action.id);

      return {
        success: true,
        output: result as Record<string, unknown>,
        logs,
        durationMs
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error('Execution failed', {
        actionId: action.id,
        error: errorMessage,
        durationMs
      });

      logs.push({
        timestamp: new Date(),
        level: LogLevel.ERROR,
        message: 'Execution failed',
        metadata: { error: errorMessage }
      });

      // Update action as failed
      await this.updateActionStatus(action.id, ActionStatus.FAILED, undefined, errorMessage);

      // Log failure
      await this.logExecutionStep(action.id, 'EXECUTION_FAILED', 'Execution failed', {
        error: errorMessage,
        durationMs
      });

      // Attempt rollback if enabled
      if (rollbackOnFailure && action.rollbackData) {
        try {
          await this.executeRollback({ targetActionId: action.id }, abortController.signal, logs);
          logs.push({
            timestamp: new Date(),
            level: LogLevel.INFO,
            message: 'Rollback completed after failure'
          });
        } catch (rollbackError) {
          logs.push({
            timestamp: new Date(),
            level: LogLevel.ERROR,
            message: 'Rollback failed',
            metadata: { error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError) }
          });
        }
      }

      // Publish failure event
      await this.eventBus.publish({
        type: 'execution:failed',
        source: 'execution-engine',
        payload: {
          actionId: action.id,
          taskId: context.taskId,
          success: false,
          error: errorMessage,
          durationMs
        }
      });

      this.activeExecutions.delete(action.id);

      return {
        success: false,
        error: errorMessage,
        logs,
        durationMs
      };
    }
  }

  async abortExecution(actionId: string): Promise<boolean> {
    const controller = this.activeExecutions.get(actionId);
    if (controller) {
      controller.abort('Execution aborted by user');
      this.activeExecutions.delete(actionId);
      this.logger.info('Execution aborted', { actionId });
      return true;
    }
    return false;
  }

  private async executeCodeChange(
    payload: CodeExecutionPayload,
    dryRun: boolean,
    signal: AbortSignal,
    logs: ExecutionLogEntry[]
  ): Promise<PatchResult> {
    const { changes, basePath = process.cwd(), createBackup = true } = payload;
    const filesAffected: string[] = [];

    logs.push({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: `Executing ${changes.length} code changes`,
      metadata: { dryRun, basePath }
    });

    if (signal.aborted) {
      throw new Error('Execution aborted');
    }

    for (const change of changes) {
      const filePath = path.resolve(basePath, change.path);
      filesAffected.push(filePath);

      if (change.operation === 'delete') {
        if (!dryRun) {
          if (createBackup) {
            const backupPath = `${filePath}.backup-${Date.now()}`;
            try {
              await fs.copyFile(filePath, backupPath);
              logs.push({
                timestamp: new Date(),
                level: LogLevel.INFO,
                message: `Created backup: ${backupPath}`
              });
            } catch {
              // File might not exist
            }
          }
          await fs.unlink(filePath);
        }
        logs.push({
          timestamp: new Date(),
          level: LogLevel.INFO,
          message: `Deleted file: ${filePath}`,
          metadata: { dryRun }
        });
      } else {
        // Create or update
        if (!dryRun) {
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          
          if (createBackup && change.operation === 'update') {
            const backupPath = `${filePath}.backup-${Date.now()}`;
            try {
              await fs.copyFile(filePath, backupPath);
              logs.push({
                timestamp: new Date(),
                level: LogLevel.INFO,
                message: `Created backup: ${backupPath}`
              });
            } catch {
              // File might not exist
            }
          }
          
          const content = change.encoding === 'base64' 
            ? Buffer.from(change.content, 'base64').toString('utf8')
            : change.content;
          
          await fs.writeFile(filePath, content, 'utf8');
        }
        
        logs.push({
          timestamp: new Date(),
          level: LogLevel.INFO,
          message: `${change.operation === 'create' ? 'Created' : 'Updated'} file: ${filePath}`,
          metadata: { dryRun }
        });
      }
    }

    return {
      success: true,
      changes,
      filesAffected,
      error: undefined
    };
  }

  private async executeCommand(
    payload: CommandExecutionPayload,
    signal: AbortSignal,
    logs: ExecutionLogEntry[]
  ): Promise<{ stdout: string; stderr: string }> {
    const { command, cwd, env, timeoutMs = 60000, allowed = false } = payload;

    // Security check for dangerous commands
    const dangerousPatterns = [
      /rm\s+-rf\s+\//,
      />\s*\/dev\/null/,
      /mkfs/,
      /dd\s+if/,
      /:\(\)\s*\{\s*:\|\:\s*&\s*\}/,
      /curl.*\|.*bash/
    ];

    if (!allowed) {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(command)) {
          throw new Error(`Command blocked by security policy: ${command}`);
        }
      }
    }

    logs.push({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: `Executing command: ${command}`,
      metadata: { cwd, timeoutMs }
    });

    if (signal.aborted) {
      throw new Error('Execution aborted');
    }

    const { stdout, stderr } = await execAsync(command, {
      cwd,
      env: { ...process.env, ...env },
      timeout: timeoutMs,
      killSignal: 'SIGTERM'
    });

    logs.push({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: 'Command executed',
      metadata: { stdout: stdout.slice(0, 500), stderr: stderr.slice(0, 500) }
    });

    return { stdout, stderr };
  }

  private async executeDeployment(
    payload: DeploymentPayload,
    signal: AbortSignal,
    logs: ExecutionLogEntry[]
  ): Promise<{ deployed: boolean; target: string }> {
    const { target, artifacts, strategy, healthCheckUrl } = payload;

    logs.push({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: `Starting deployment to ${target}`,
      metadata: { strategy, artifacts }
    });

    // Simulate deployment (replace with actual deployment logic)
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (healthCheckUrl) {
      logs.push({
        timestamp: new Date(),
        level: LogLevel.INFO,
        message: `Health check: ${healthCheckUrl}`
      });
      
      // Actual health check would go here
    }

    return { deployed: true, target };
  }

  private async executeNotification(
    payload: Record<string, unknown>,
    logs: ExecutionLogEntry[]
  ): Promise<{ sent: boolean }> {
    logs.push({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: 'Sending notification',
      metadata: payload
    });

    // Notification would be sent via Communication Agent
    return { sent: true };
  }

  private async executeDelete(
    payload: Record<string, unknown>,
    dryRun: boolean,
    signal: AbortSignal,
    logs: ExecutionLogEntry[]
  ): Promise<{ deleted: boolean }> {
    const { resourceId, resourceType, path: deletePath } = payload;

    logs.push({
      timestamp: new Date(),
      level: LogLevel.WARN,
      message: `Deleting ${resourceType}: ${resourceId || deletePath}`,
      metadata: { dryRun }
    });

    if (!dryRun && deletePath) {
      await fs.unlink(path.resolve(deletePath as string));
    }

    return { deleted: !dryRun };
  }

  private async executeConfigChange(
    payload: Record<string, unknown>,
    dryRun: boolean,
    signal: AbortSignal,
    logs: ExecutionLogEntry[]
  ): Promise<{ updated: boolean }> {
    const { configPath, changes } = payload;

    logs.push({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: `Modifying config: ${configPath}`,
      metadata: { dryRun, changes }
    });

    return { updated: !dryRun };
  }

  private async executeRollback(
    payload: { targetActionId: string },
    signal: AbortSignal,
    logs: ExecutionLogEntry[]
  ): Promise<{ rolledBack: boolean }> {
    const { targetActionId } = payload;

    const action = await prisma.aIAction.findUnique({
      where: { id: targetActionId }
    });

    if (!action || !action.rollbackData) {
      throw new Error(`No rollback data available for action ${targetActionId}`);
    }

    logs.push({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: `Executing rollback for action ${targetActionId}`
    });

    const rollbackData = action.rollbackData as PatchResult;

    // Reverse the changes
    for (const change of rollbackData.changes) {
      const filePath = path.resolve(change.path);
      const backupPath = `${filePath}.backup-*`;
      
      // Find and restore from backup
      // This is simplified - actual implementation would track backups more carefully
      logs.push({
        timestamp: new Date(),
        level: LogLevel.INFO,
        message: `Rolling back change: ${change.path}`
      });
    }

    await prisma.aIAction.update({
      where: { id: targetActionId },
      data: { status: ActionStatus.ROLLED_BACK }
    });

    return { rolledBack: true };
  }

  private async executeCustom(
    actionType: ActionType,
    payload: Record<string, unknown>,
    signal: AbortSignal,
    logs: ExecutionLogEntry[]
  ): Promise<Record<string, unknown>> {
    logs.push({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: `Executing custom action: ${actionType}`,
      metadata: payload
    });

    return { executed: true, actionType };
  }

  private async updateActionStatus(
    actionId: string,
    status: ActionStatus,
    result?: unknown,
    error?: string
  ): Promise<void> {
    await prisma.aIAction.update({
      where: { id: actionId },
      data: {
        status,
        result: result ? result as Record<string, unknown> : undefined,
        error,
        executedAt: status === ActionStatus.EXECUTING ? new Date() : undefined,
        completedAt: [ActionStatus.COMPLETED, ActionStatus.FAILED, ActionStatus.ROLLED_BACK].includes(status) 
          ? new Date() 
          : undefined
      }
    });
  }

  private async logExecutionStep(
    actionId: string,
    step: string,
    status: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await prisma.executionLog.create({
      data: {
        actionId,
        step,
        status,
        details
      }
    });
  }

  private async storeRollbackData(actionId: string, result: PatchResult): Promise<void> {
    await prisma.aIAction.update({
      where: { id: actionId },
      data: {
        rollbackData: result as Record<string, unknown>,
        canRollback: true
      }
    });
  }

  async getExecutionLogs(actionId: string): Promise<ExecutionLogEntry[]> {
    const logs = await prisma.executionLog.findMany({
      where: { actionId },
      orderBy: { timestamp: 'asc' }
    });

    return logs.map(log => ({
      timestamp: log.timestamp,
      level: LogLevel.INFO,
      message: `${log.step}: ${log.status}`,
      metadata: log.details as Record<string, unknown> || undefined
    }));
  }
}

// Singleton instance
let executionEngineInstance: ExecutionEngine | null = null;

export function getExecutionEngine(
  eventBus: EventBus, 
  approvalSystem: ApprovalSystem
): ExecutionEngine {
  if (!executionEngineInstance) {
    executionEngineInstance = new ExecutionEngine(eventBus, approvalSystem);
  }
  return executionEngineInstance;
}

export function resetExecutionEngine(): void {
  executionEngineInstance = null;
}
