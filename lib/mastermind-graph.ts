/**
 * Mastermind Workflow Orchestration
 * Sovereign HyperMind - Phase 2: Unlimited Intelligence
 * 
 * Workflow with paths: analyze -> plan -> delegate -> execute -> report
 */

import { routeRequest, getBestModelForTask } from "./openrouter-service";

// Graph State Interface
export interface MastermindState {
  // Input
  command: string;
  userId: string;
  context?: Record<string, unknown>;
  
  // Analysis
  analysis?: {
    taskType: string;
    complexity: "low" | "medium" | "high";
    requiresAgents: string[];
    estimatedTime: number;
  };
  
  // Planning
  plan?: {
    subtasks: Subtask[];
    dependencies: string[][];
    criticalPath: string[];
  };
  
  // Execution
  results?: TaskResult[];
  currentTaskIndex: number;
  
  // Report
  finalReport?: {
    summary: string;
    details: string;
    metrics: Record<string, number>;
    recommendations: string[];
  };
  
  // Metadata
  startTime: string;
  logs: string[];
  errors: string[];
}

export interface Subtask {
  id: string;
  description: string;
  assignedAgent: string;
  dependencies: string[];
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
}

export interface TaskResult {
  taskId: string;
  agent: string;
  status: "success" | "failure";
  output: string;
  executionTime: number;
  timestamp: string;
}

// Initial State Factory
export function createInitialState(
  command: string,
  userId: string,
  context?: Record<string, unknown>
): MastermindState {
  return {
    command,
    userId,
    context,
    currentTaskIndex: 0,
    startTime: new Date().toISOString(),
    logs: [`[${new Date().toISOString()}] Command received: ${command}`],
    errors: [],
  };
}

// Node 1: Analyze the command
async function analyzeNode(state: MastermindState): Promise<MastermindState> {
  const logEntry = `[${new Date().toISOString()}] Analyzing command...`;
  state.logs.push(logEntry);
  
  try {
    const response = await routeRequest({
      modelPreference: getBestModelForTask("analysis"),
      prompt: `Analyze this command and provide structured output:

Command: "${state.command}"

Respond with JSON only:
{
  "taskType": "one of: coding, security, analysis, operations, general",
  "complexity": "low|medium|high",
  "requiresAgents": ["list of required agent types: coder, security, analyst, ops"],
  "estimatedTime": estimated_minutes_number
}`,
      systemPrompt: "You are an expert task analyzer. Respond with valid JSON only.",
      temperature: 0.3,
    });

    if (response.success) {
      try {
        const analysis = JSON.parse(response.content);
        state.analysis = analysis;
        state.logs.push(`[${new Date().toISOString()}] Analysis complete: ${analysis.taskType} task`);
      } catch {
        state.analysis = {
          taskType: detectTaskType(state.command),
          complexity: "medium",
          requiresAgents: ["general"],
          estimatedTime: 5,
        };
      }
    }
  } catch (error) {
    state.errors.push(`Analysis error: ${error instanceof Error ? error.message : String(error)}`);
    state.analysis = {
      taskType: detectTaskType(state.command),
      complexity: "medium",
      requiresAgents: ["general"],
      estimatedTime: 5,
    };
  }

  return state;
}

// Node 2: Plan the execution
async function planNode(state: MastermindState): Promise<MastermindState> {
  const logEntry = `[${new Date().toISOString()}] Planning execution...`;
  state.logs.push(logEntry);

  try {
    const prompt = `Create a detailed execution plan for this task:

Command: "${state.command}"
Task Type: ${state.analysis?.taskType}
Complexity: ${state.analysis?.complexity}
Required Agents: ${state.analysis?.requiresAgents?.join(", ")}

Break this down into subtasks. Respond with JSON only:
{
  "subtasks": [
    {
      "id": "task-1",
      "description": "task description",
      "assignedAgent": "agentType",
      "dependencies": []
    }
  ],
  "dependencies": [["task-1", "task-2"]],
  "criticalPath": ["task-1", "task-2"]
}`;

    const response = await routeRequest({
      modelPreference: getBestModelForTask("planning"),
      prompt,
      systemPrompt: "You are an expert project planner. Create actionable subtasks. Respond with valid JSON only.",
      temperature: 0.4,
    });

    if (response.success) {
      try {
        const plan = JSON.parse(response.content);
        state.plan = plan;
        state.logs.push(`[${new Date().toISOString()}] Plan created: ${plan.subtasks.length} subtasks`);
      } catch {
        state.plan = createFallbackPlan(state);
      }
    }
  } catch (error) {
    state.errors.push(`Planning error: ${error instanceof Error ? error.message : String(error)}`);
    state.plan = createFallbackPlan(state);
  }

  return state;
}

// Node 3: Delegate to agents
async function delegateNode(state: MastermindState): Promise<MastermindState> {
  const logEntry = `[${new Date().toISOString()}] Delegating tasks to agents...`;
  state.logs.push(logEntry);

  if (!state.plan?.subtasks) {
    state.errors.push("No plan available for delegation");
    return state;
  }

  state.plan.subtasks = state.plan.subtasks.map(task => ({
    ...task,
    status: task.dependencies.length === 0 ? "pending" : "pending",
  }));

  state.logs.push(`[${new Date().toISOString()}] Delegated to ${state.plan.subtasks.length} agents`);
  return state;
}

// Node 4: Execute tasks
async function executeNode(state: MastermindState): Promise<MastermindState> {
  if (!state.plan?.subtasks) {
    return state;
  }

  const currentTask = state.plan.subtasks[state.currentTaskIndex];
  if (!currentTask) {
    state.logs.push(`[${new Date().toISOString()}] All tasks executed`);
    return state;
  }

  const startTime = Date.now();
  state.logs.push(`[${new Date().toISOString()}] Executing: ${currentTask.description}`);

  try {
    const result = await executeAgentTask(currentTask, state);
    
    const taskResult: TaskResult = {
      taskId: currentTask.id,
      agent: currentTask.assignedAgent,
      status: "success",
      output: result,
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    state.results = [...(state.results || []), taskResult];
    currentTask.status = "completed";
    currentTask.result = result;

  } catch (error) {
    const taskResult: TaskResult = {
      taskId: currentTask.id,
      agent: currentTask.assignedAgent,
      status: "failure",
      output: "",
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    state.results = [...(state.results || []), taskResult];
    currentTask.status = "failed";
    state.errors.push(`Task ${currentTask.id} failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  state.currentTaskIndex++;
  return state;
}

// Node 5: Generate report
async function reportNode(state: MastermindState): Promise<MastermindState> {
  const logEntry = `[${new Date().toISOString()}] Generating final report...`;
  state.logs.push(logEntry);

  const totalTime = Date.now() - new Date(state.startTime).getTime();
  const successfulTasks = state.results?.filter(r => r.status === "success").length || 0;
  const failedTasks = state.results?.filter(r => r.status === "failure").length || 0;

  try {
    const resultsSummary = state.results?.map(r => 
      `- ${r.taskId}: ${r.status} (${r.executionTime}ms)`
    ).join("\n") || "No results";

    const prompt = `Generate a final report for this task execution:

Command: ${state.command}
Total Time: ${totalTime}ms
Successful Tasks: ${successfulTasks}
Failed Tasks: ${failedTasks}

Results:
${resultsSummary}

Errors:
${state.errors.join("\n") || "None"}

Respond with JSON only:
{
  "summary": "Brief summary of what was accomplished",
  "details": "Detailed description of results",
  "metrics": {
    "successRate": percentage_number,
    "avgExecutionTime": average_ms,
    "totalTasks": number
  },
  "recommendations": ["suggestion 1", "suggestion 2"]
}`;

    const response = await routeRequest({
      modelPreference: getBestModelForTask("analysis"),
      prompt,
      systemPrompt: "You are an expert analyst. Summarize task execution results. Respond with valid JSON only.",
      temperature: 0.3,
    });

    if (response.success) {
      try {
        const report = JSON.parse(response.content);
        state.finalReport = report;
      } catch {
        state.finalReport = createFallbackReport(state, totalTime, successfulTasks, failedTasks);
      }
    }
  } catch (error) {
    state.finalReport = createFallbackReport(state, totalTime, successfulTasks, failedTasks);
    state.errors.push(`Report generation error: ${error instanceof Error ? error.message : String(error)}`);
  }

  state.logs.push(`[${new Date().toISOString()}] Report generated`);
  return state;
}

// Run the complete workflow
export async function runMastermind(
  command: string,
  userId: string,
  context?: Record<string, unknown>
): Promise<MastermindState> {
  let state = createInitialState(command, userId, context);
  
  try {
    // Execute workflow steps sequentially
    state = await analyzeNode(state);
    state = await planNode(state);
    state = await delegateNode(state);
    
    // Execute all tasks
    while (state.currentTaskIndex < (state.plan?.subtasks?.length || 0)) {
      state = await executeNode(state);
    }
    
    state = await reportNode(state);
    
    return state;
  } catch (error) {
    return {
      ...state,
      errors: [...state.errors, `Workflow error: ${error instanceof Error ? error.message : String(error)}`],
      finalReport: {
        summary: "Workflow execution failed",
        details: String(error),
        metrics: { successRate: 0, avgExecutionTime: 0, totalTasks: 0 },
        recommendations: ["Check system logs", "Verify agent availability"],
      },
    };
  }
}

// Helper functions
function detectTaskType(command: string): string {
  const lower = command.toLowerCase();
  if (/code|function|bug|error|debug/.test(lower)) return "coding";
  if (/security|vulnerability|threat|audit/.test(lower)) return "security";
  if (/analyze|report|data|metric/.test(lower)) return "analysis";
  if (/server|deploy|config|monitor/.test(lower)) return "operations";
  return "general";
}

function createFallbackPlan(state: MastermindState) {
  return {
    subtasks: [{
      id: "task-1",
      description: state.command,
      assignedAgent: state.analysis?.requiresAgents?.[0] || "general",
      dependencies: [],
      status: "pending" as const,
    }],
    dependencies: [],
    criticalPath: ["task-1"],
  };
}

function createFallbackReport(
  state: MastermindState,
  totalTime: number,
  successful: number,
  failed: number
) {
  const total = successful + failed;
  return {
    summary: `Executed ${state.command}`,
    details: `Completed ${successful}/${total} tasks in ${totalTime}ms`,
    metrics: {
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      avgExecutionTime: total > 0 ? Math.round(totalTime / total) : 0,
      totalTasks: total,
    },
    recommendations: failed > 0 ? ["Review failed tasks", "Consider retry mechanism"] : ["Process completed successfully"],
  };
}

async function executeAgentTask(task: Subtask, state: MastermindState): Promise<string> {
  switch (task.assignedAgent) {
    case "coder":
      return executeCoderTask(task.description, state);
    case "security":
      return executeSecurityTask(task.description, state);
    case "analyst":
      return executeAnalystTask(task.description, state);
    case "ops":
      return executeOpsTask(task.description, state);
    default:
      return executeGeneralTask(task.description, state);
  }
}

async function executeCoderTask(description: string, state: MastermindState): Promise<string> {
  const response = await routeRequest({
    modelPreference: getBestModelForTask("coding"),
    prompt: `Write code for: ${description}`,
    systemPrompt: "You are an expert programmer. Write clean, efficient, well-documented code.",
  });
  return response.success ? response.content : "Coding task failed";
}

async function executeSecurityTask(description: string, state: MastermindState): Promise<string> {
  const response = await routeRequest({
    modelPreference: getBestModelForTask("security"),
    prompt: `Security analysis for: ${description}`,
    systemPrompt: "You are a security expert. Analyze vulnerabilities and provide recommendations.",
  });
  return response.success ? response.content : "Security analysis failed";
}

async function executeAnalystTask(description: string, state: MastermindState): Promise<string> {
  const response = await routeRequest({
    modelPreference: getBestModelForTask("analysis"),
    prompt: `Analyze and report on: ${description}`,
    systemPrompt: "You are a data analyst. Provide insights and actionable recommendations.",
  });
  return response.success ? response.content : "Analysis failed";
}

async function executeOpsTask(description: string, state: MastermindState): Promise<string> {
  const response = await routeRequest({
    modelPreference: getBestModelForTask("general"),
    prompt: `Operations task: ${description}`,
    systemPrompt: "You are a DevOps engineer. Provide operational solutions and monitoring advice.",
  });
  return response.success ? response.content : "Operations task failed";
}

async function executeGeneralTask(description: string, state: MastermindState): Promise<string> {
  const response = await routeRequest({
    prompt: description,
  });
  return response.success ? response.content : "Task execution failed";
}
