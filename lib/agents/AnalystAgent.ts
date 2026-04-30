/**
 * Analyst Agent
 * Specialized in data analysis, insights generation, and reporting
 * Uses models optimized for analytical tasks
 */

import { routeRequest, getBestModelForTask } from "../openrouter-service";

export interface AnalystTask {
  id: string;
  type: "data_analysis" | "trend_identification" | "metric_extraction" | "report_generation";
  data: string | Record<string, unknown>;
  question?: string;
  format?: "summary" | "detailed" | "json";
}

export interface AnalysisResult {
  success: boolean;
  insights?: string[];
  summary?: string;
  metrics?: Record<string, number>;
  trends?: string[];
  recommendations?: string[];
  rawOutput?: string;
  error?: string;
  executionTime: number;
}

export class AnalystAgent {
  private readonly name = "Analyst";
  private readonly role = "Data Analyst";
  private readonly goal = "Extract insights and generate actionable recommendations from data";

  async execute(task: AnalystTask): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      switch (task.type) {
        case "data_analysis":
          return await this.analyzeData(task, startTime);
        case "trend_identification":
          return await this.identifyTrends(task, startTime);
        case "metric_extraction":
          return await this.extractMetrics(task, startTime);
        case "report_generation":
          return await this.generateReport(task, startTime);
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

  private async analyzeData(task: AnalystTask, startTime: number): Promise<AnalysisResult> {
    const dataString = typeof task.data === "string" ? task.data : JSON.stringify(task.data, null, 2);
    
    const prompt = `Analyze the following data and provide insights:

Data:
${dataString}

${task.question ? `Focus Question: ${task.question}\n` : ""}

Provide:
1. Key insights (3-5 bullet points)
2. Summary of findings
3. Metrics if applicable
4. Recommendations

${task.format === "json" ? "Respond in JSON format." : ""}`;

    const response = await routeRequest({
      modelPreference: getBestModelForTask("analysis"),
      prompt,
      systemPrompt: "You are a data analyst. Provide clear, actionable insights.",
      temperature: 0.4,
      maxTokens: 2048,
    });

    if (!response.success) {
      return {
        success: false,
        error: response.error,
        executionTime: Date.now() - startTime,
      };
    }

    // Parse insights from response
    const insights = this.extractInsights(response.content);
    const recommendations = this.extractRecommendations(response.content);

    return {
      success: true,
      insights,
      summary: response.content.slice(0, 500),
      recommendations,
      rawOutput: response.content,
      executionTime: Date.now() - startTime,
    };
  }

  private async identifyTrends(task: AnalystTask, startTime: number): Promise<AnalysisResult> {
    const dataString = typeof task.data === "string" ? task.data : JSON.stringify(task.data, null, 2);
    
    const prompt = `Identify trends and patterns in this data:

Data:
${dataString}

Focus on:
1. Temporal trends (if time data available)
2. Correlations between variables
3. Anomalies or outliers
4. Growth or decline patterns

List the top 5 trends with brief explanations.`;

    const response = await routeRequest({
      modelPreference: getBestModelForTask("analysis"),
      prompt,
      temperature: 0.4,
    });

    const trends = response.success 
      ? response.content.split("\n").filter(line => line.trim().startsWith("-") || line.trim().match(/^\d+\./))
      : [];

    return {
      success: response.success,
      trends,
      rawOutput: response.success ? response.content : undefined,
      error: response.error,
      executionTime: Date.now() - startTime,
    };
  }

  private async extractMetrics(task: AnalystTask, startTime: number): Promise<AnalysisResult> {
    const dataString = typeof task.data === "string" ? task.data : JSON.stringify(task.data, null, 2);
    
    const prompt = `Extract key metrics from this data:

Data:
${dataString}

Identify and calculate:
1. Counts and totals
2. Averages and medians
3. Percentages and ratios
4. Growth rates (if temporal)
5. Any other relevant metrics

Respond in JSON format:
{
  "metrics": {
    "metricName": numericValue,
    ...
  },
  "summary": "brief interpretation"
}`;

    const response = await routeRequest({
      modelPreference: getBestModelForTask("analysis"),
      prompt,
      temperature: 0.3,
    });

    let metrics: Record<string, number> = {};
    
    if (response.success) {
      try {
        const parsed = JSON.parse(response.content);
        metrics = parsed.metrics || {};
      } catch {
        // Fallback: try to extract metrics manually
        metrics = this.extractMetricsFromText(response.content);
      }
    }

    return {
      success: response.success,
      metrics,
      rawOutput: response.success ? response.content : undefined,
      error: response.error,
      executionTime: Date.now() - startTime,
    };
  }

  private async generateReport(task: AnalystTask, startTime: number): Promise<AnalysisResult> {
    const dataString = typeof task.data === "string" ? task.data : JSON.stringify(task.data, null, 2);
    
    const prompt = `Generate a comprehensive report based on this data:

Data:
${dataString}

${task.question ? `Report Focus: ${task.question}\n` : ""}

Include:
1. Executive Summary
2. Key Findings
3. Detailed Analysis
4. Visualizations suggestions (describe what would be helpful)
5. Recommendations
6. Next Steps

Format: Professional business report style.`;

    const response = await routeRequest({
      modelPreference: getBestModelForTask("analysis"),
      prompt,
      temperature: 0.5,
      maxTokens: 3000,
    });

    return {
      success: response.success,
      summary: response.success ? response.content.slice(0, 1000) : undefined,
      rawOutput: response.success ? response.content : undefined,
      error: response.error,
      executionTime: Date.now() - startTime,
    };
  }

  private extractInsights(text: string): string[] {
    const insights: string[] = [];
    const lines = text.split("\n");
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("-") || trimmed.startsWith("•") || trimmed.match(/^\d+\./)) {
        insights.push(trimmed.replace(/^[-•\d.]+\s*/, ""));
      }
    }
    
    return insights.slice(0, 5);
  }

  private extractRecommendations(text: string): string[] {
    const recs: string[] = [];
    const lines = text.split("\n");
    let inRecsSection = false;
    
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      
      if (trimmed.includes("recommendation") || trimmed.includes("suggestion")) {
        inRecsSection = true;
        continue;
      }
      
      if (inRecsSection && (trimmed.startsWith("-") || trimmed.match(/^\d+\./))) {
        recs.push(line.trim().replace(/^[-\d.]+\s*/, ""));
      }
      
      // Stop if we hit another section
      if (inRecsSection && trimmed.match(/^(conclusion|summary|next steps)/)) {
        inRecsSection = false;
      }
    }
    
    return recs;
  }

  private extractMetricsFromText(text: string): Record<string, number> {
    const metrics: Record<string, number> = {};
    
    // Look for patterns like "X: 123" or "X = 123" or "123 X"
    const patterns = [
      /(\w+):\s*(\d+(?:\.\d+)?)/g,
      /(\w+)\s*=\s*(\d+(?:\.\d+)?)/g,
      /(\d+(?:\.\d+)?)\s*(\w+)/g,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const value = parseFloat(match[2]);
        if (!isNaN(value)) {
          metrics[match[1]] = value;
        }
      }
    }
    
    return metrics;
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
export const analystAgent = new AnalystAgent();
