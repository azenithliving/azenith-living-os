/**
 * Security Agent
 * Specialized in vulnerability detection, security audits, and recommendations
 * Uses Claude Haiku or similar security-focused models
 */

import { routeRequest, getBestModelForTask } from "../openrouter-service";

export interface SecurityTask {
  id: string;
  type: "audit" | "vulnerability_scan" | "review" | "policy_check";
  target: string;
  context?: string;
}

export interface Vulnerability {
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  recommendation: string;
  cwe?: string;
}

export interface SecurityResult {
  success: boolean;
  vulnerabilities?: Vulnerability[];
  summary?: string;
  score?: number; // 0-100
  recommendations?: string[];
  error?: string;
  executionTime: number;
}

export class SecurityAgent {
  private readonly name = "Security";
  private readonly role = "Security Expert";
  private readonly goal = "Identify vulnerabilities and ensure system security";

  async execute(task: SecurityTask): Promise<SecurityResult> {
    const startTime = Date.now();
    
    try {
      switch (task.type) {
        case "audit":
          return await this.performSecurityAudit(task, startTime);
        case "vulnerability_scan":
          return await this.scanVulnerabilities(task, startTime);
        case "review":
          return await this.reviewCodeSecurity(task, startTime);
        case "policy_check":
          return await this.checkSecurityPolicy(task, startTime);
        default:
          return {
            success: false,
            error: `Unknown task type: ${task.type}`,
            executionTime: Date.now() - startTime,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async performSecurityAudit(task: SecurityTask, startTime: number): Promise<SecurityResult> {
    const prompt = `Perform a comprehensive security audit for:

Target: ${task.target}
${task.context ? `Context:\n${task.context}\n` : ""}

Analyze for:
1. Authentication and authorization issues
2. Data protection vulnerabilities
3. Input validation weaknesses
4. Configuration security
5. Dependency vulnerabilities

Respond with JSON:
{
  "score": 0-100,
  "summary": "Overall security assessment",
  "vulnerabilities": [
    {
      "severity": "critical|high|medium|low",
      "title": "Vulnerability name",
      "description": "Detailed description",
      "recommendation": "How to fix",
      "cwe": "CWE-ID"
    }
  ],
  "recommendations": ["general recommendation 1", "recommendation 2"]
}`;

    const response = await routeRequest({
      modelPreference: "anthropic/claude-3.5-haiku",
      prompt,
      systemPrompt: "You are a cybersecurity expert. Be thorough and specific.",
      temperature: 0.3,
      maxTokens: 2048,
    });

    if (!response.success) {
      return {
        success: false,
        error: response.error,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      const result = JSON.parse(response.content);
      return {
        success: true,
        score: result.score,
        summary: result.summary,
        vulnerabilities: result.vulnerabilities || [],
        recommendations: result.recommendations || [],
        executionTime: Date.now() - startTime,
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        success: true,
        summary: response.content,
        vulnerabilities: [],
        recommendations: ["Manual review recommended"],
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async scanVulnerabilities(task: SecurityTask, startTime: number): Promise<SecurityResult> {
    const prompt = `Scan for known vulnerabilities in:

Target: ${task.target}
${task.context ? `Context:\n${task.context}\n` : ""}

Check against:
- OWASP Top 10
- CWE Top 25
- Common security misconfigurations

List any findings with severity levels.`;

    const response = await routeRequest({
      modelPreference: getBestModelForTask("security"),
      prompt,
      temperature: 0.3,
    });

    return {
      success: response.success,
      summary: response.success ? response.content : undefined,
      error: response.error,
      executionTime: Date.now() - startTime,
    };
  }

  private async reviewCodeSecurity(task: SecurityTask, startTime: number): Promise<SecurityResult> {
    const prompt = `Review this code for security issues:

Code:
${task.target}

Identify:
1. Injection vulnerabilities
2. Authentication/authorization flaws
3. Sensitive data exposure
4. Security misconfigurations
5. Input validation issues
6. Insecure dependencies

Format findings as actionable items.`;

    const response = await routeRequest({
      modelPreference: "anthropic/claude-3.5-haiku",
      prompt,
      temperature: 0.3,
    });

    return {
      success: response.success,
      summary: response.success ? response.content : undefined,
      error: response.error,
      executionTime: Date.now() - startTime,
    };
  }

  private async checkSecurityPolicy(task: SecurityTask, startTime: number): Promise<SecurityResult> {
    const prompt = `Check compliance with security policies:

Target: ${task.target}
${task.context ? `Context:\n${task.context}\n` : ""}

Verify:
1. Password policies
2. Access controls
3. Encryption requirements
4. Logging and monitoring
5. Incident response readiness`;

    const response = await routeRequest({
      modelPreference: getBestModelForTask("security"),
      prompt,
      temperature: 0.3,
    });

    return {
      success: response.success,
      summary: response.success ? response.content : undefined,
      error: response.error,
      executionTime: Date.now() - startTime,
    };
  }

  getInfo(): { name: string; role: string; goal: string } {
    return {
      name: this.name,
      role: this.role,
      goal: this.goal,
    };
  }
}

// Singleton instance
export const securityAgent = new SecurityAgent();
