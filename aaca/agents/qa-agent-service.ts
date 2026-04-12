import { Job } from 'bullmq';
import { EventBus } from '../events/event-bus';
import { Logger } from '../utils/logger';
import { prisma } from '../database/prisma-client';
import { 
  AITask, 
  TaskStatus, 
  TaskType,
  LogLevel
} from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

interface QAConfig {
  testTimeoutMs: number;
  coverageThreshold: number;
  failOnLowCoverage: boolean;
  testFramework: 'jest' | 'vitest' | 'mocha';
}

interface TestRequest {
  taskId: string;
  testPattern?: string;
  coverage?: boolean;
  updateSnapshots?: boolean;
}

interface BuildRequest {
  taskId: string;
  buildCommand?: string;
  checkTypes?: boolean;
  lint?: boolean;
}

const DEFAULT_CONFIG: QAConfig = {
  testTimeoutMs: 30000,
  coverageThreshold: 80,
  failOnLowCoverage: false,
  testFramework: 'vitest'
};

export class QAAgentService {
  private eventBus: EventBus;
  private logger: Logger;
  private config: QAConfig;

  constructor(eventBus: EventBus, config: QAConfig = DEFAULT_CONFIG) {
    this.eventBus = eventBus;
    this.logger = new Logger('QAAgentService');
    this.config = config;
  }

  async processJob(job: Job): Promise<unknown> {
    const { taskId, title, type, payload } = job.data;
    
    this.logger.info('Processing QA agent job', { jobId: job.id, taskId, type });

    try {
      await this.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);

      let result: unknown;

      switch (type) {
        case TaskType.TESTING:
          result = await this.runTests(payload as TestRequest);
          break;

        case TaskType.ANALYSIS:
          result = await this.validateBuild(payload as BuildRequest);
          break;

        default:
          throw new Error(`Unknown task type: ${type}`);
      }

      await this.updateTaskStatus(taskId, TaskStatus.COMPLETED, result);

      await this.eventBus.publish({
        type: 'task:completed',
        source: 'qa-agent',
        payload: { taskId, result }
      });

      this.logger.info('QA agent job completed', { jobId: job.id, taskId });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('QA agent job failed', { jobId: job.id, taskId, error: errorMessage });

      await this.updateTaskStatus(taskId, TaskStatus.FAILED, undefined, errorMessage);

      await this.eventBus.publish({
        type: 'task:failed',
        source: 'qa-agent',
        payload: { taskId, error: errorMessage }
      });

      throw error;
    }
  }

  async runTests(request: TestRequest): Promise<{
    success: boolean;
    passed: number;
    failed: number;
    skipped: number;
    durationMs: number;
    coverage?: {
      lines: number;
      functions: number;
      branches: number;
      statements: number;
      meetsThreshold: boolean;
    };
    errors: string[];
  }> {
    const { testPattern, coverage = false, updateSnapshots = false } = request;

    this.logger.info('Running tests', { testPattern, coverage, updateSnapshots });

    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Detect test framework
      const framework = await this.detectTestFramework();
      
      let command: string;
      
      switch (framework) {
        case 'vitest':
          command = 'npx vitest run';
          if (testPattern) command += ` ${testPattern}`;
          if (coverage) command += ' --coverage';
          break;
        
        case 'jest':
          command = 'npx jest';
          if (testPattern) command += ` --testPathPattern=${testPattern}`;
          if (coverage) command += ' --coverage';
          break;
        
        case 'mocha':
          command = 'npx mocha';
          if (testPattern) command += ` --grep "${testPattern}"`;
          break;
        
        default:
          throw new Error(`Unsupported test framework: ${framework}`);
      }

      this.logger.info('Executing test command', { command });

      const { stdout, stderr } = await execAsync(command, {
        timeout: this.config.testTimeoutMs,
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });

      const durationMs = Date.now() - startTime;

      // Parse results
      const results = this.parseTestResults(stdout, stderr, framework);

      // Get coverage if enabled
      let coverageResult;
      if (coverage) {
        coverageResult = await this.parseCoverage(framework);
      }

      const success = results.failed === 0;

      if (!success) {
        errors.push(...results.failures);
      }

      // Publish results
      await this.eventBus.publish({
        type: 'qa:test-results',
        source: 'qa-agent',
        payload: {
          success,
          passed: results.passed,
          failed: results.failed,
          skipped: results.skipped,
          durationMs,
          coverage: coverageResult
        }
      });

      return {
        success,
        passed: results.passed,
        failed: results.failed,
        skipped: results.skipped,
        durationMs,
        coverage: coverageResult,
        errors
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Test execution failed', { error: errorMessage });

      return {
        success: false,
        passed: 0,
        failed: 0,
        skipped: 0,
        durationMs: Date.now() - startTime,
        errors: [errorMessage]
      };
    }
  }

  async validateBuild(request: BuildRequest): Promise<{
    valid: boolean;
    buildSuccess: boolean;
    typeCheckSuccess: boolean;
    lintSuccess: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const { buildCommand, checkTypes = true, lint = true } = request;

    this.logger.info('Validating build', { buildCommand, checkTypes, lint });

    const errors: string[] = [];
    const warnings: string[] = [];
    
    let buildSuccess = true;
    let typeCheckSuccess = true;
    let lintSuccess = true;

    // Type checking
    if (checkTypes) {
      try {
        this.logger.info('Running type check');
        await execAsync('npx tsc --noEmit', { timeout: 120000 });
        this.logger.info('Type check passed');
      } catch (error) {
        typeCheckSuccess = false;
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Type check failed: ${message}`);
        this.logger.error('Type check failed', { error: message });
      }
    }

    // Linting
    if (lint) {
      try {
        this.logger.info('Running linter');
        await execAsync('npx eslint . --max-warnings 0', { timeout: 120000 });
        this.logger.info('Lint check passed');
      } catch (error) {
        lintSuccess = false;
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Lint failed: ${message}`);
        this.logger.error('Lint check failed', { error: message });
      }
    }

    // Build
    if (buildCommand) {
      try {
        this.logger.info('Running build', { command: buildCommand });
        await execAsync(buildCommand, { timeout: 300000 });
        this.logger.info('Build passed');
      } catch (error) {
        buildSuccess = false;
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Build failed: ${message}`);
        this.logger.error('Build failed', { error: message });
      }
    } else {
      // Try to detect build command
      const hasNext = await this.fileExists('next.config.js') || await this.fileExists('next.config.ts');
      const hasVite = await this.fileExists('vite.config.ts') || await this.fileExists('vite.config.js');
      
      if (hasNext) {
        try {
          this.logger.info('Detected Next.js, running build');
          await execAsync('npm run build', { timeout: 300000 });
          this.logger.info('Build passed');
        } catch (error) {
          buildSuccess = false;
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`Build failed: ${message}`);
          this.logger.error('Build failed', { error: message });
        }
      } else if (hasVite) {
        try {
          this.logger.info('Detected Vite, running build');
          await execAsync('npm run build', { timeout: 300000 });
          this.logger.info('Build passed');
        } catch (error) {
          buildSuccess = false;
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`Build failed: ${message}`);
          this.logger.error('Build failed', { error: message });
        }
      }
    }

    const valid = buildSuccess && typeCheckSuccess && lintSuccess;

    // Publish results
    await this.eventBus.publish({
      type: 'qa:build-validated',
      source: 'qa-agent',
      payload: {
        valid,
        buildSuccess,
        typeCheckSuccess,
        lintSuccess,
        errorCount: errors.length
      }
    });

    return {
      valid,
      buildSuccess,
      typeCheckSuccess,
      lintSuccess,
      errors,
      warnings
    };
  }

  async runFullValidation(): Promise<{
    success: boolean;
    tests: {
      passed: boolean;
      passedCount: number;
      failedCount: number;
    };
    build: {
      valid: boolean;
      errors: string[];
    };
    coverage: {
      meetsThreshold: boolean;
      percentage: number;
    };
  }> {
    this.logger.info('Running full validation suite');

    const testResults = await this.runTests({ 
      taskId: 'full-validation',
      coverage: true 
    });

    const buildResults = await this.validateBuild({
      taskId: 'full-validation',
      checkTypes: true,
      lint: true
    });

    const success = testResults.success && buildResults.valid;

    return {
      success,
      tests: {
        passed: testResults.success,
        passedCount: testResults.passed,
        failedCount: testResults.failed
      },
      build: {
        valid: buildResults.valid,
        errors: buildResults.errors
      },
      coverage: {
        meetsThreshold: testResults.coverage?.meetsThreshold ?? false,
        percentage: testResults.coverage?.lines ?? 0
      }
    };
  }

  private async detectTestFramework(): Promise<'jest' | 'vitest' | 'mocha'> {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    
    try {
      const content = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(content);
      
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      if (allDeps.vitest) return 'vitest';
      if (allDeps.jest) return 'jest';
      if (allDeps.mocha) return 'mocha';
    } catch {
      // Default to vitest if can't detect
    }

    return this.config.testFramework;
  }

  private parseTestResults(
    stdout: string, 
    stderr: string, 
    framework: string
  ): { passed: number; failed: number; skipped: number; failures: string[] } {
    const failures: string[] = [];
    
    switch (framework) {
      case 'vitest':
        // Vitest output parsing
        const vitestPassed = (stdout.match(/✓/g) || []).length;
        const vitestFailed = (stdout.match(/✗/g) || []).length;
        
        // Extract failure details
        const failureBlocks = stdout.split('FAIL').slice(1);
        for (const block of failureBlocks) {
          const lines = block.split('\n').slice(0, 5);
          failures.push(lines.join('\n'));
        }

        return {
          passed: vitestPassed,
          failed: vitestFailed,
          skipped: 0,
          failures
        };

      case 'jest':
        // Jest output parsing
        const jestMatch = stdout.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed,\s+(\d+)\s+skipped/);
        if (jestMatch) {
          return {
            passed: parseInt(jestMatch[1], 10),
            failed: parseInt(jestMatch[2], 10),
            skipped: parseInt(jestMatch[3], 10),
            failures: stderr ? [stderr] : []
          };
        }
        break;

      case 'mocha':
        // Mocha output parsing
        const mochaMatch = stdout.match(/passing\s+\((\d+)\)/);
        const mochaFail = stdout.match(/failing\s+\((\d+)\)/);
        return {
          passed: mochaMatch ? parseInt(mochaMatch[1], 10) : 0,
          failed: mochaFail ? parseInt(mochaFail[1], 10) : 0,
          skipped: 0,
          failures: stderr ? [stderr] : []
        };
    }

    return { passed: 0, failed: 0, skipped: 0, failures: [] };
  }

  private async parseCoverage(framework: string): Promise<{
    lines: number;
    functions: number;
    branches: number;
    statements: number;
    meetsThreshold: boolean;
  } | undefined> {
    try {
      if (framework === 'vitest' || framework === 'jest') {
        // Read coverage summary
        const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
        
        try {
          const content = await fs.readFile(coveragePath, 'utf8');
          const summary = JSON.parse(content);
          const total = summary.total;

          if (total) {
            const lines = total.lines?.pct || 0;
            const functions = total.functions?.pct || 0;
            const branches = total.branches?.pct || 0;
            const statements = total.statements?.pct || 0;

            return {
              lines,
              functions,
              branches,
              statements,
              meetsThreshold: lines >= this.config.coverageThreshold
            };
          }
        } catch {
          // Coverage file not found or invalid
        }
      }
    } catch (error) {
      this.logger.error('Failed to parse coverage', { error });
    }

    return undefined;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(process.cwd(), filePath));
      return true;
    } catch {
      return false;
    }
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

  updateConfig(config: Partial<QAConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('QA config updated', this.config as unknown as Record<string, unknown>);
  }
}

// Singleton instance
let qaAgentInstance: QAAgentService | null = null;

export function getQAAgentService(eventBus: EventBus, config?: QAConfig): QAAgentService {
  if (!qaAgentInstance) {
    qaAgentInstance = new QAAgentService(eventBus, config);
  }
  return qaAgentInstance;
}

export function resetQAAgentService(): void {
  qaAgentInstance = null;
}
