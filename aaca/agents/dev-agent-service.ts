import { Job } from 'bullmq';
import { EventBus } from '../events/event-bus';
import { Logger } from '../utils/logger';
import { prisma } from '../database/prisma-client';
import { 
  AITask, 
  AIAction, 
  TaskStatus, 
  ActionType, 
  ActionStatus,
  CodeChange,
  PatchResult,
  TaskType
} from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

interface RepositoryConfig {
  basePath: string;
  allowedExtensions: string[];
  maxFileSize: number;
  excludePatterns: string[];
}

interface CodeGenerationRequest {
  taskId: string;
  prompt: string;
  targetPath: string;
  language: string;
  context?: string[];
}

interface CodeReviewRequest {
  taskId: string;
  filePaths: string[];
  reviewType: 'full' | 'security' | 'performance';
}

interface PRRequest {
  taskId: string;
  branchName: string;
  title: string;
  description: string;
  changes: CodeChange[];
}

const DEFAULT_REPO_CONFIG: RepositoryConfig = {
  basePath: process.cwd(),
  allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.scss'],
  maxFileSize: 1024 * 1024, // 1MB
  excludePatterns: ['node_modules', '.git', 'dist', 'build', '.next']
};

export class DevAgentService {
  private eventBus: EventBus;
  private logger: Logger;
  private repoConfig: RepositoryConfig;

  constructor(eventBus: EventBus, repoConfig: RepositoryConfig = DEFAULT_REPO_CONFIG) {
    this.eventBus = eventBus;
    this.logger = new Logger('DevAgentService');
    this.repoConfig = repoConfig;
  }

  async processJob(job: Job): Promise<unknown> {
    const { taskId, title, type, payload } = job.data;
    
    this.logger.info('Processing dev agent job', { jobId: job.id, taskId, type });

    try {
      // Update task status
      await this.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);

      let result: unknown;

      switch (type) {
        case TaskType.CODE_GENERATION:
          result = await this.generateCode(payload as CodeGenerationRequest);
          break;

        case TaskType.CODE_REVIEW:
          result = await this.reviewCode(payload as CodeReviewRequest);
          break;

        case TaskType.DEPLOYMENT:
          result = await this.handleDeployment(payload as Record<string, unknown>);
          break;

        case TaskType.ANALYSIS:
          result = await this.analyzeRepository(payload as Record<string, unknown>);
          break;

        default:
          throw new Error(`Unknown task type: ${type}`);
      }

      // Update task as completed
      await this.updateTaskStatus(taskId, TaskStatus.COMPLETED, result);

      // Publish completion event
      await this.eventBus.publish({
        type: 'task:completed',
        source: 'dev-agent',
        payload: { taskId, result }
      });

      this.logger.info('Dev agent job completed', { jobId: job.id, taskId });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Dev agent job failed', { jobId: job.id, taskId, error: errorMessage });

      // Update task as failed
      await this.updateTaskStatus(taskId, TaskStatus.FAILED, undefined, errorMessage);

      // Publish failure event
      await this.eventBus.publish({
        type: 'task:failed',
        source: 'dev-agent',
        payload: { taskId, error: errorMessage }
      });

      throw error;
    }
  }

  async generateCode(request: CodeGenerationRequest): Promise<PatchResult> {
    const { taskId, prompt, targetPath, language, context } = request;

    this.logger.info('Generating code', { taskId, targetPath, language });

    // Create an action for this code generation
    const action = await this.createAction(taskId, ActionType.WRITE_CODE, {
      prompt,
      targetPath,
      language,
      context
    });

    // Generate code using AI (simulated for now - would use actual AI service)
    const generatedCode = await this.generateCodeWithAI(prompt, language, context);

    const changes: CodeChange[] = [{
      path: targetPath,
      content: generatedCode,
      operation: 'create'
    }];

    // Store the changes in the action
    await prisma.aIAction.update({
      where: { id: action.id },
      data: {
        status: ActionStatus.COMPLETED,
        result: { changes },
        completedAt: new Date()
      }
    });

    this.logger.info('Code generation action completed', { actionId: action.id });

    return {
      success: true,
      changes,
      filesAffected: [targetPath]
    };
  }

  async reviewCode(request: CodeReviewRequest): Promise<{
    findings: Array<{
      file: string;
      line: number;
      severity: 'error' | 'warning' | 'info';
      message: string;
      rule?: string;
    }>;
    summary: {
      totalIssues: number;
      errors: number;
      warnings: number;
      infos: number;
    };
  }> {
    const { taskId, filePaths, reviewType } = request;

    this.logger.info('Reviewing code', { taskId, fileCount: filePaths.length, reviewType });

    const findings: Array<{
      file: string;
      line: number;
      severity: 'error' | 'warning' | 'info';
      message: string;
      rule?: string;
    }> = [];

    for (const filePath of filePaths) {
      const fullPath = path.resolve(this.repoConfig.basePath, filePath);
      
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        const lines = content.split('\n');

        // Basic linting (would integrate with actual linting tools)
        lines.forEach((line, index) => {
          // Check for common issues
          if (line.includes('console.log') && reviewType !== 'security') {
            findings.push({
              file: filePath,
              line: index + 1,
              severity: 'warning',
              message: 'console.log statement found',
              rule: 'no-console'
            });
          }

          if (line.includes('eval(') && reviewType === 'security') {
            findings.push({
              file: filePath,
              line: index + 1,
              severity: 'error',
              message: 'Dangerous eval() usage detected',
              rule: 'security/no-eval'
            });
          }

          if (line.length > 120) {
            findings.push({
              file: filePath,
              line: index + 1,
              severity: 'info',
              message: 'Line exceeds 120 characters',
              rule: 'max-len'
            });
          }
        });
      } catch (error) {
        this.logger.warn('Failed to read file for review', { filePath, error });
      }
    }

    const summary = {
      totalIssues: findings.length,
      errors: findings.filter(f => f.severity === 'error').length,
      warnings: findings.filter(f => f.severity === 'warning').length,
      infos: findings.filter(f => f.severity === 'info').length
    };

    this.logger.info('Code review completed', { taskId, ...summary });

    return { findings, summary };
  }

  async createPatch(changes: CodeChange[], commitMessage: string): Promise<PatchResult> {
    this.logger.info('Creating patch', { changeCount: changes.length, commitMessage });

    const filesAffected: string[] = [];

    for (const change of changes) {
      const fullPath = path.resolve(this.repoConfig.basePath, change.path);

      // Validate path is within repo
      if (!fullPath.startsWith(this.repoConfig.basePath)) {
        throw new Error(`Invalid path: ${change.path}`);
      }

      // Validate extension
      const ext = path.extname(change.path);
      if (!this.repoConfig.allowedExtensions.includes(ext)) {
        throw new Error(`File type not allowed: ${ext}`);
      }

      filesAffected.push(change.path);
    }

    return {
      success: true,
      changes,
      filesAffected
    };
  }

  async readRepository(filePattern: string = '**/*'): Promise<{
    files: Array<{ path: string; content: string; size: number }>;
    totalSize: number;
    fileCount: number;
  }> {
    const pattern = path.join(this.repoConfig.basePath, filePattern);
    const files: Array<{ path: string; content: string; size: number }> = [];
    let totalSize = 0;

    try {
      const matches: string[] = await glob(pattern, {
        ignore: this.repoConfig.excludePatterns,
        nodir: true,
        dot: true
      } as any) as unknown as string[];

      for (const filePath of matches) {
        const ext = path.extname(filePath);
        if (!this.repoConfig.allowedExtensions.includes(ext)) continue;

        try {
          const stats = await fs.stat(filePath);
          
          if (stats.size > this.repoConfig.maxFileSize) {
            this.logger.warn('File too large, skipping', { filePath, size: stats.size });
            continue;
          }

          const content = await fs.readFile(filePath, 'utf8');
          const relativePath = path.relative(this.repoConfig.basePath, filePath);

          files.push({
            path: relativePath,
            content,
            size: stats.size
          });

          totalSize += stats.size;
        } catch (error) {
          this.logger.warn('Failed to read file', { filePath, error });
        }
      }
    } catch (error) {
      this.logger.error('Failed to read repository', { error });
      throw error;
    }

    return {
      files,
      totalSize,
      fileCount: files.length
    };
  }

  async writeFile(filePath: string, content: string, createBackup: boolean = true): Promise<void> {
    const fullPath = path.resolve(this.repoConfig.basePath, filePath);

    // Validate path
    if (!fullPath.startsWith(this.repoConfig.basePath)) {
      throw new Error(`Invalid path: ${filePath}`);
    }

    // Validate file extension for security
    const allowedExtensions = ['.ts', '.tsx', '.js', '.json', '.md', '.css'];
    const ext = path.extname(filePath);
    if (!allowedExtensions.includes(ext)) {
      throw new Error(`نوع الملف ${ext} غير مسموح به لأسباب أمنية.`);
    }

    // Create backup if file exists
    if (createBackup) {
      try {
        await fs.access(fullPath);
        const backupPath = `${fullPath}.backup-${Date.now()}`;
        await fs.copyFile(fullPath, backupPath);
        this.logger.info('Created backup', { original: filePath, backup: backupPath });
      } catch {
        // File doesn't exist, no backup needed
      }
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Write file
    await fs.writeFile(fullPath, content, 'utf8');

    this.logger.info('File written', { filePath });
  }

  async analyzeRepository(payload: Record<string, unknown>): Promise<{
    structure: {
      directories: string[];
      fileTypes: Record<string, number>;
      totalLines: number;
    };
    dependencies: {
      production: string[];
      development: string[];
    };
    metrics: {
      complexity: number;
      maintainability: number;
    };
  }> {
    this.logger.info('Analyzing repository');

    const repo = await this.readRepository();
    
    const directories = new Set<string>();
    const fileTypes: Record<string, number> = {};
    let totalLines = 0;

    for (const file of repo.files) {
      const dir = path.dirname(file.path);
      directories.add(dir);

      const ext = path.extname(file.path);
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;

      totalLines += file.content.split('\n').length;
    }

    // Read package.json for dependencies
    let dependencies = { production: [] as string[], development: [] as string[] };
    try {
      const packageJsonPath = path.join(this.repoConfig.basePath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      dependencies.production = Object.keys(packageJson.dependencies || {});
      dependencies.development = Object.keys(packageJson.devDependencies || {});
    } catch {
      // package.json not found or invalid
    }

    return {
      structure: {
        directories: Array.from(directories),
        fileTypes,
        totalLines
      },
      dependencies,
      metrics: {
        complexity: Math.min(100, totalLines / 100),
        maintainability: 70 // Placeholder
      }
    };
  }

  private async generateCodeWithAI(
    prompt: string, 
    language: string, 
    context?: string[]
  ): Promise<string> {
    // This would integrate with actual AI service (OpenAI, Anthropic, etc.)
    // For now, returning a placeholder
    
    const templates: Record<string, string> = {
      typescript: `// Generated TypeScript code
// Prompt: ${prompt}

export function generatedFunction() {
  // TODO: Implement based on: ${prompt}
  console.log('Generated function executed');
}`,
      javascript: `// Generated JavaScript code
// Prompt: ${prompt}

function generatedFunction() {
  // TODO: Implement based on: ${prompt}
  console.log('Generated function executed');
}`,
      python: `# Generated Python code
# Prompt: ${prompt}

def generated_function():
    # TODO: Implement based on: ${prompt}
    print('Generated function executed')`
    };

    return templates[language] || templates.typescript;
  }

  private async handleDeployment(payload: Record<string, unknown>): Promise<{ deployed: boolean }> {
    this.logger.info('Handling deployment request', payload);
    
    // Deployment logic would go here
    // This would integrate with CI/CD systems

    return { deployed: true };
  }

  private async createAction(
    taskId: string, 
    type: ActionType, 
    payload: Record<string, unknown>
  ): Promise<AIAction> {
    const action = await prisma.aIAction.create({
      data: {
        taskId,
        type,
        status: ActionStatus.PENDING,
        payload,
        requiresApproval: this.requiresApproval(type)
      }
    });

    this.logger.info('Action created', { actionId: action.id, type, taskId });

    return action as AIAction;
  }

  private requiresApproval(type: ActionType): boolean {
    const approvalRequired = [
      ActionType.WRITE_CODE,
      ActionType.DELETE_RESOURCE,
      ActionType.MODIFY_CONFIG,
      ActionType.MERGE_CODE,
      ActionType.DEPLOY
    ];

    return approvalRequired.includes(type);
  }

  private async updateTaskStatus(
    taskId: string, 
    status: TaskStatus, 
    result?: unknown, 
    error?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (result) {
      updateData.result = result;
    }

    if (error) {
      updateData.error = error;
      updateData.failedAt = new Date();
    }

    if (status === TaskStatus.IN_PROGRESS) {
      updateData.startedAt = new Date();
    }

    if (status === TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    await prisma.aITask.update({
      where: { id: taskId },
      data: updateData
    });
  }

  updateConfig(config: Partial<RepositoryConfig>): void {
    this.repoConfig = { ...this.repoConfig, ...config };
    this.logger.info('Repository config updated', { ...this.repoConfig } as Record<string, unknown>);
  }
}

// Singleton instance
let devAgentInstance: DevAgentService | null = null;

export function getDevAgentService(eventBus: EventBus, config?: RepositoryConfig): DevAgentService {
  if (!devAgentInstance) {
    devAgentInstance = new DevAgentService(eventBus, config);
  }
  return devAgentInstance;
}

export function resetDevAgentService(): void {
  devAgentInstance = null;
}
