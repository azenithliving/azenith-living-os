import { Job } from 'bullmq';
import { EventBus } from '../events/event-bus';
import { Logger } from '../utils/logger';
import { prisma } from '../database/prisma-client';
import { 
  AITask, 
  AIAction,
  TaskStatus, 
  TaskType,
  ActionType,
  RiskAssessment,
  RiskLevel,
  RiskFactor,
  SecurityScan,
  SecurityScanType,
  SecurityFinding
} from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

interface SecurityConfig {
  maxRiskScore: number;
  blockHighRiskActions: boolean;
  scanOnCodeChange: boolean;
  secretPatterns: RegExp[];
  forbiddenCommands: string[];
}

interface RiskAssessmentRequest {
  taskId: string;
  action: AIAction;
  context?: Record<string, unknown>;
}

interface SecurityScanRequest {
  taskId: string;
  target: string;
  scanType: SecurityScanType;
  rules?: string[];
}

const DEFAULT_SECRET_PATTERNS = [
  /[aA][pP][iI][_-]?[kK][eE][yY]\s*[:=]\s*['"][a-zA-Z0-9]{32,}['"]/,
  /[sS][eE][cC][rR][eE][tT][_-]?[kK][eE][yY]\s*[:=]\s*['"][a-zA-Z0-9]{32,}['"]/,
  /[pP][aA][sS][sS][wW][oO][rR][dD]\s*[:=]\s*['"][^'"]{8,}['"]/,
  /[tT][oO][kK][eE][nN]\s*[:=]\s*['"][a-zA-Z0-9]{32,}['"]/,
  /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,  // AWS Access Key
  /ghp_[a-zA-Z0-9]{36}/,  // GitHub Personal Access Token
  /glpat-[a-zA-Z0-9\-_]{20}/,  // GitLab PAT
];

const DEFAULT_FORBIDDEN_COMMANDS = [
  'rm -rf /',
  'mkfs',
  'dd if=/dev/zero',
  ':(){ :|:& };:',  // Fork bomb
  'curl | bash',
  'curl | sh',
  'wget | bash',
  'wget | sh',
  'sudo rm -rf',
  'chmod -R 777 /',
  'chown -R root:root /',
];

const DEFAULT_CONFIG: SecurityConfig = {
  maxRiskScore: 75,
  blockHighRiskActions: true,
  scanOnCodeChange: true,
  secretPatterns: DEFAULT_SECRET_PATTERNS,
  forbiddenCommands: DEFAULT_FORBIDDEN_COMMANDS
};

export class SecurityAgentService {
  private eventBus: EventBus;
  private logger: Logger;
  private config: SecurityConfig;

  constructor(eventBus: EventBus, config: Partial<SecurityConfig> = {}) {
    this.eventBus = eventBus;
    this.logger = new Logger('SecurityAgentService');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async processJob(job: Job): Promise<unknown> {
    const { taskId, title, type, payload } = job.data;
    
    this.logger.info('Processing security agent job', { jobId: job.id, taskId, type });

    try {
      await this.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);

      let result: unknown;

      switch (type) {
        case TaskType.SECURITY_SCAN:
          result = await this.performSecurityScan(payload as SecurityScanRequest);
          break;

        case TaskType.CODE_REVIEW:
          result = await this.assessCodeSecurity(payload as Record<string, unknown>);
          break;

        default:
          throw new Error(`Unknown task type: ${type}`);
      }

      await this.updateTaskStatus(taskId, TaskStatus.COMPLETED, result);

      await this.eventBus.publish({
        type: 'task:completed',
        source: 'security-agent',
        payload: { taskId, result }
      });

      this.logger.info('Security agent job completed', { jobId: job.id, taskId });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Security agent job failed', { jobId: job.id, taskId, error: errorMessage });

      await this.updateTaskStatus(taskId, TaskStatus.FAILED, undefined, errorMessage);

      await this.eventBus.publish({
        type: 'task:failed',
        source: 'security-agent',
        payload: { taskId, error: errorMessage }
      });

      throw error;
    }
  }

  async assessRisk(request: RiskAssessmentRequest): Promise<RiskAssessment> {
    const { action, context } = request;
    
    this.logger.info('Assessing risk for action', { 
      actionId: action.id, 
      actionType: action.type 
    });

    const factors: RiskFactor[] = [];
    let totalScore = 0;

    // Assess based on action type
    const typeRisk = this.assessActionTypeRisk(action.type);
    if (typeRisk > 0) {
      factors.push({
        type: 'ACTION_TYPE',
        severity: typeRisk,
        description: `Action type ${action.type} has inherent risk level ${typeRisk}`
      });
      totalScore += typeRisk;
    }

    // Assess payload for dangerous patterns
    const payloadRisk = this.assessPayloadRisk(action.payload);
    if (payloadRisk.score > 0) {
      factors.push(...payloadRisk.factors);
      totalScore += payloadRisk.score;
    }

    // Assess context
    if (context) {
      const contextRisk = this.assessContextRisk(context);
      if (contextRisk > 0) {
        factors.push({
          type: 'CONTEXT',
          severity: contextRisk,
          description: 'Risk factors in execution context'
        });
        totalScore += contextRisk;
      }
    }

    // Cap at 100
    totalScore = Math.min(100, totalScore);

    const level = this.calculateRiskLevel(totalScore);
    const recommendation = this.generateRecommendation(totalScore, factors);

    const assessment: RiskAssessment = {
      score: totalScore,
      level,
      factors,
      recommendation
    };

    // Update action with risk score
    await prisma.aIAction.update({
      where: { id: action.id },
      data: { 
        riskScore: totalScore,
        requiresApproval: totalScore > this.config.maxRiskScore || this.requiresApprovalByDefault(action.type)
      }
    });

    // Publish security assessment event
    await this.eventBus.publish({
      type: 'security:risk-assessed',
      source: 'security-agent',
      payload: {
        actionId: action.id,
        riskScore: totalScore,
        riskLevel: level,
        requiresApproval: assessment.score > this.config.maxRiskScore
      }
    });

    this.logger.info('Risk assessment complete', { 
      actionId: action.id, 
      score: totalScore, 
      level 
    });

    return assessment;
  }

  async performSecurityScan(request: SecurityScanRequest): Promise<SecurityScan> {
    const { taskId, target, scanType, rules } = request;

    this.logger.info('Performing security scan', { target, scanType });

    const startTime = Date.now();
    const findings: SecurityFinding[] = [];

    try {
      switch (scanType) {
        case SecurityScanType.SECRETS:
          findings.push(...await this.scanForSecrets(target));
          break;
        
        case SecurityScanType.CODE:
          findings.push(...await this.scanCode(target));
          break;
        
        case SecurityScanType.DEPENDENCIES:
          findings.push(...await this.scanDependencies(target));
          break;
        
        case SecurityScanType.CONFIGURATION:
          findings.push(...await this.scanConfiguration(target));
          break;
      }

      const durationMs = Date.now() - startTime;

      const scan: SecurityScan = {
        id: this.generateId(),
        target,
        scanType,
        findings,
        scannedAt: new Date(),
        durationMs
      };

      // Store findings if critical or high
      const criticalFindings = findings.filter(f => f.severity === 'critical' || f.severity === 'high');
      if (criticalFindings.length > 0) {
        await this.eventBus.publish({
          type: 'security:critical-findings',
          source: 'security-agent',
          payload: {
            scanId: scan.id,
            target,
            findings: criticalFindings
          }
        });
      }

      return scan;

    } catch (error) {
      this.logger.error('Security scan failed', { target, scanType, error });
      throw error;
    }
  }

  async validateAction(action: AIAction): Promise<{
    valid: boolean;
    blocked: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    // Check action type
    if (this.isForbiddenAction(action.type)) {
      reasons.push(`Action type ${action.type} is forbidden`);
      return { valid: false, blocked: true, reasons };
    }

    // Check payload for forbidden patterns
    const payloadCheck = this.checkPayload(action.payload);
    if (!payloadCheck.valid) {
      reasons.push(...payloadCheck.reasons);
    }

    // Check risk score
    if (action.riskScore && action.riskScore > this.config.maxRiskScore && this.config.blockHighRiskActions) {
      reasons.push(`Risk score ${action.riskScore} exceeds maximum allowed ${this.config.maxRiskScore}`);
      return { valid: false, blocked: true, reasons };
    }

    return { 
      valid: reasons.length === 0, 
      blocked: false, 
      reasons 
    };
  }

  async scanRepository(repoPath: string): Promise<{
    scans: SecurityScan[];
    summary: {
      totalFindings: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  }> {
    this.logger.info('Scanning repository', { repoPath });

    const scans = await Promise.all([
      this.performSecurityScan({ 
        taskId: 'repo-scan', 
        target: repoPath, 
        scanType: SecurityScanType.SECRETS 
      }),
      this.performSecurityScan({ 
        taskId: 'repo-scan', 
        target: repoPath, 
        scanType: SecurityScanType.CODE 
      }),
      this.performSecurityScan({ 
        taskId: 'repo-scan', 
        target: repoPath, 
        scanType: SecurityScanType.DEPENDENCIES 
      })
    ]);

    const allFindings = scans.flatMap(s => s.findings);

    const summary = {
      totalFindings: allFindings.length,
      critical: allFindings.filter(f => f.severity === 'critical').length,
      high: allFindings.filter(f => f.severity === 'high').length,
      medium: allFindings.filter(f => f.severity === 'medium').length,
      low: allFindings.filter(f => f.severity === 'low').length
    };

    return { scans, summary };
  }

  private assessActionTypeRisk(actionType: ActionType): number {
    const riskMap: Record<ActionType, number> = {
      [ActionType.WRITE_CODE]: 20,
      [ActionType.EXECUTE_COMMAND]: 60,
      [ActionType.DEPLOY]: 40,
      [ActionType.DELETE_RESOURCE]: 70,
      [ActionType.MODIFY_CONFIG]: 50,
      [ActionType.SEND_NOTIFICATION]: 10,
      [ActionType.CREATE_PR]: 15,
      [ActionType.MERGE_CODE]: 45,
      [ActionType.ROLLBACK]: 30,
      [ActionType.CUSTOM]: 25
    };

    return riskMap[actionType] || 25;
  }

  private assessPayloadRisk(payload: Record<string, unknown>): { score: number; factors: RiskFactor[] } {
    const factors: RiskFactor[] = [];
    let score = 0;

    // Check for forbidden commands
    const payloadStr = JSON.stringify(payload);
    
    for (const cmd of this.config.forbiddenCommands) {
      if (payloadStr.toLowerCase().includes(cmd.toLowerCase())) {
        factors.push({
          type: 'FORBIDDEN_COMMAND',
          severity: 100,
          description: `Forbidden command pattern detected: ${cmd}`
        });
        score += 100;
      }
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      { pattern: /eval\s*\(/, severity: 80, desc: 'Dangerous eval() usage' },
      { pattern: /Function\s*\(/, severity: 70, desc: 'Dynamic code execution' },
      { pattern: /child_process/, severity: 60, desc: 'Process spawning' },
      { pattern: /fs\.unlink\s*\(/, severity: 40, desc: 'File deletion' },
      { pattern: /fs\.rmdir\s*\(/, severity: 40, desc: 'Directory deletion' },
    ];

    for (const { pattern, severity, desc } of suspiciousPatterns) {
      if (pattern.test(payloadStr)) {
        factors.push({
          type: 'SUSPICIOUS_PATTERN',
          severity,
          description: desc
        });
        score += severity;
      }
    }

    return { score, factors };
  }

  private assessContextRisk(context: Record<string, unknown>): number {
    let score = 0;

    // Check if in production
    if (context.environment === 'production') {
      score += 20;
    }

    // Check user permissions
    if (context.userRole === 'ADMIN') {
      score += 10;
    }

    return score;
  }

  private calculateRiskLevel(score: number): RiskLevel {
    if (score >= 80) return RiskLevel.CRITICAL;
    if (score >= 60) return RiskLevel.HIGH;
    if (score >= 40) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  private generateRecommendation(score: number, factors: RiskFactor[]): string {
    if (score >= 80) {
      return 'CRITICAL: This action requires immediate security review before approval';
    }
    if (score >= 60) {
      return 'HIGH RISK: Additional security validation recommended';
    }
    if (score >= 40) {
      return 'MEDIUM RISK: Standard approval process required';
    }
    return 'LOW RISK: Action can proceed with standard monitoring';
  }

  private requiresApprovalByDefault(actionType: ActionType): boolean {
    const alwaysRequireApproval = [
      ActionType.EXECUTE_COMMAND,
      ActionType.DELETE_RESOURCE,
      ActionType.MODIFY_CONFIG,
      ActionType.DEPLOY
    ];
    return alwaysRequireApproval.includes(actionType);
  }

  private isForbiddenAction(actionType: ActionType): boolean {
    // No action types are completely forbidden, just high risk
    return false;
  }

  private checkPayload(payload: Record<string, unknown>): { valid: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const payloadStr = JSON.stringify(payload);

    // Check for obvious attacks
    const attacks = [
      { pattern: /<script/i, desc: 'XSS attempt detected' },
      { pattern: /SELECT.*FROM/i, desc: 'Potential SQL injection' },
      { pattern: /\$\{.*\}/, desc: 'Template injection attempt' },
    ];

    for (const { pattern, desc } of attacks) {
      if (pattern.test(payloadStr)) {
        reasons.push(desc);
      }
    }

    return { valid: reasons.length === 0, reasons };
  }

  private async scanForSecrets(target: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const files = await glob('**/*', { 
        cwd: target, 
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
        nodir: true 
      });

      for (const file of files) {
        const filePath = path.join(target, file);
        
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            for (let j = 0; j < this.config.secretPatterns.length; j++) {
              const pattern = this.config.secretPatterns[j];
              
              if (pattern.test(line)) {
                findings.push({
                  severity: 'critical',
                  ruleId: `SECRET_PATTERN_${j}`,
                  message: 'Potential secret/key detected',
                  file,
                  line: i + 1,
                  column: line.search(pattern) + 1
                });
              }
            }
          }
        } catch {
          // Skip binary or unreadable files
        }
      }
    } catch (error) {
      this.logger.error('Secret scan failed', { target, error });
    }

    return findings;
  }

  private async scanCode(target: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const files = await glob('**/*.{js,ts,jsx,tsx}', { 
        cwd: target, 
        ignore: ['node_modules/**', 'dist/**', 'build/**'],
        nodir: true 
      });

      const securityRules = [
        { pattern: /eval\s*\(/, severity: 'high' as const, message: 'Dangerous eval() usage' },
        { pattern: /innerHTML\s*=/, severity: 'medium' as const, message: 'Potential XSS via innerHTML' },
        { pattern: /document\.write\s*\(/, severity: 'medium' as const, message: 'Dangerous document.write usage' },
        { pattern: /window\[.*\]\s*=/, severity: 'low' as const, message: 'Dynamic global assignment' },
        { pattern: /JSON\.parse\s*\(\s*[^)]*\)/, severity: 'low' as const, message: 'Potential JSON parsing without validation' },
      ];

      for (const file of files) {
        const filePath = path.join(target, file);
        
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            for (const rule of securityRules) {
              if (rule.pattern.test(line)) {
                findings.push({
                  severity: rule.severity,
                  ruleId: 'SECURITY_CODE_SCAN',
                  message: rule.message,
                  file,
                  line: i + 1,
                  column: line.search(rule.pattern) + 1
                });
              }
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    } catch (error) {
      this.logger.error('Code scan failed', { target, error });
    }

    return findings;
  }

  private async scanDependencies(target: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const packageJsonPath = path.join(target, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);

      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Check for known vulnerable patterns
      const vulnerablePackages = [
        { name: 'lodash', version: '<4.17.21', severity: 'high' as const },
        { name: 'express', version: '<4.17.3', severity: 'medium' as const },
      ];

      for (const [depName, depVersion] of Object.entries(deps)) {
        for (const vulnerable of vulnerablePackages) {
          if (depName === vulnerable.name) {
            findings.push({
              severity: vulnerable.severity,
              ruleId: 'VULNERABLE_DEPENDENCY',
              message: `${depName}@${depVersion} may have known vulnerabilities`,
              file: 'package.json'
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Dependency scan failed', { target, error });
    }

    return findings;
  }

  private async scanConfiguration(target: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      // Check .env files
      const envFiles = await glob('.env*', { cwd: target, nodir: true });
      
      for (const envFile of envFiles) {
        const content = await fs.readFile(path.join(target, envFile), 'utf8');
        
        if (content.includes('PASSWORD') || content.includes('SECRET') || content.includes('KEY')) {
          findings.push({
            severity: 'info',
            ruleId: 'ENV_FILE_CHECK',
            message: `Environment file ${envFile} contains sensitive keys - ensure it's in .gitignore`,
            file: envFile
          });
        }
      }
    } catch (error) {
      this.logger.error('Configuration scan failed', { target, error });
    }

    return findings;
  }

  private async assessCodeSecurity(payload: Record<string, unknown>): Promise<{
    safe: boolean;
    findings: SecurityFinding[];
    recommendation: string;
  }> {
    const filePaths = payload.filePaths as string[] || [];
    const findings: SecurityFinding[] = [];

    for (const filePath of filePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');

        // Quick security scan
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (/eval\s*\(/.test(line)) {
            findings.push({
              severity: 'high',
              ruleId: 'NO_EVAL',
              message: 'eval() is dangerous and should not be used',
              file: filePath,
              line: i + 1
            });
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return {
      safe: findings.length === 0,
      findings,
      recommendation: findings.length > 0 
        ? 'Security issues found - review required before approval'
        : 'No security issues detected'
    };
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

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  updateConfig(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Security config updated', this.config as unknown as Record<string, unknown>);
  }
}

// Singleton instance
let securityAgentInstance: SecurityAgentService | null = null;

export function getSecurityAgentService(eventBus: EventBus, config?: Partial<SecurityConfig>): SecurityAgentService {
  if (!securityAgentInstance) {
    securityAgentInstance = new SecurityAgentService(eventBus, config);
  }
  return securityAgentInstance;
}

export function resetSecurityAgentService(): void {
  securityAgentInstance = null;
}
