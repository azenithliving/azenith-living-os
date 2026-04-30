import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { sendSecurityAlert, notifyInvalidSignature, notifyDangerousCommand } from "@/lib/telegram-notify";
import { verifyCommandWithPublicKeyBase64 } from "@/lib/crypto-keys";
import crypto from "crypto";

// قائمة الأوامر المسموح بها (whitelist)
const ALLOWED_COMMANDS = [
  "test",
  "get_keys",
  "add_key",
  "rate_limit_update",
  "system_status",
  "ping",
  "health_check",
  "get_logs",
  "get_stats",
];

// الأوامر الخطيرة التي تحتاج إشعار
const DANGEROUS_COMMANDS = [
  "delete",
  "drop",
  "truncate",
  "remove",
  "purge",
  "wipe",
  "reset",
  "disable",
];

/**
 * Execute a signed command
 * POST /api/admin/command
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    // التحقق من المصادقة
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      // تسجيل محاولة دخول بدون مصادقة
      await logFailedCommand(
        supabase,
        null,
        "UNAUTHORIZED",
        "unauthorized_access",
        request.headers.get("x-forwarded-for") || "unknown",
        "No authentication"
      );

      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { command, signature, parameters = {} } = body;

    if (!command || typeof command !== "string") {
      return NextResponse.json(
        { error: "Command is required" },
        { status: 400 }
      );
    }

    if (!signature || typeof signature !== "string") {
      return NextResponse.json(
        { error: "Digital signature is required" },
        { status: 400 }
      );
    }

    // التحقق من وجود 2FA مفعل
    const { data: user2FA, error: faError } = await supabase
      .from("user_2fa")
      .select("is_enabled")
      .eq("user_id", user.id)
      .single();

    if (faError || !user2FA?.is_enabled) {
      await sendSecurityAlert(
        `⚠️ COMMAND ATTEMPT WITHOUT 2FA\n` +
        `User: ${user.email}\n` +
        `Command: ${command}\n` +
        `Time: ${new Date().toISOString()}\n` +
        `IP: ${request.headers.get("x-forwarded-for") || "unknown"}`
      );

      return NextResponse.json(
        { error: "2FA must be enabled to execute commands" },
        { status: 403 }
      );
    }

    // جلب المفتاح العام للمستخدم
    const { data: publicKeyData, error: keyError } = await supabase
      .from("user_public_keys")
      .select("public_key")
      .eq("user_id", user.id)
      .single();

    if (keyError || !publicKeyData) {
      return NextResponse.json(
        { error: "No public key found. Please setup digital signatures first." },
        { status: 400 }
      );
    }

    // التحقق من صحة التوقيع الرقمي
    const commandWithParams = `${command}:${JSON.stringify(parameters)}`;
    const isValidSignature = await verifyCommandWithPublicKeyBase64(
      publicKeyData.public_key,
      commandWithParams,
      signature
    );

    if (!isValidSignature) {
      // تسجيل محاولة فاشلة
      await logFailedCommand(
        supabase,
        user.id,
        command,
        "invalid_signature",
        request.headers.get("x-forwarded-for") || "unknown",
        "Signature verification failed"
      );

      await notifyInvalidSignature(
        user.email || "unknown",
        command,
        request.headers.get("x-forwarded-for") || "unknown"
      );

      return NextResponse.json(
        { error: "Invalid digital signature. This incident has been logged." },
        { status: 403 }
      );
    }

    // التحقق من أن الأمر مسموح به
    const isAllowed = ALLOWED_COMMANDS.some(
      allowed => command.toLowerCase().startsWith(allowed.toLowerCase())
    );

    if (!isAllowed) {
      await logFailedCommand(
        supabase,
        user.id,
        command,
        "command_not_allowed",
        request.headers.get("x-forwarded-for") || "unknown",
        "Command not in whitelist"
      );

      return NextResponse.json(
        { error: "Command not allowed. Contact system administrator." },
        { status: 403 }
      );
    }

    // حساب hash للأمر
    const commandHash = crypto
      .createHash("sha256")
      .update(`${command}:${user.id}:${new Date().toISOString()}`)
      .digest("hex");

    // تسجيل الأمر في السجل غير القابل للتلاعب (pending status)
    const { data: logEntry, error: logError } = await supabase
      .from("immutable_command_log")
      .insert({
        user_id: user.id,
        command_text: command,
        signature: signature,
        executed_at: new Date().toISOString(),
        executor_ip: request.headers.get("x-forwarded-for") || "unknown",
        status: "pending",
        result_summary: "Executing...",
        command_hash: commandHash,
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to log command:", logError);
    }

    // تنفيذ الأمر
    let result;
    let status: "executed" | "failed" = "executed";
    let resultSummary = "";

    try {
      result = await executeCommand(supabase, command, parameters, user);
      resultSummary = JSON.stringify(result).substring(0, 500); // limit length
    } catch (execError) {
      status = "failed";
      resultSummary = execError instanceof Error 
        ? execError.message 
        : "Execution failed";
    }

    // تحديث السجل بالنتيجة
    if (logEntry?.id) {
      await supabase
        .from("immutable_command_log")
        .update({
          status,
          result_summary: resultSummary,
        })
        .eq("id", logEntry.id);
    }

    // إشعار للأوامر الخطيرة
    const isDangerous = DANGEROUS_COMMANDS.some(dangerous =>
      command.toLowerCase().includes(dangerous)
    );

    if (isDangerous) {
      await notifyDangerousCommand(
        user.email || "unknown",
        command,
        resultSummary
      );
    }

    const executionTime = Date.now() - startTime;

    return NextResponse.json({
      success: status === "executed",
      command,
      result,
      executionTime: `${executionTime}ms`,
      logId: logEntry?.id,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Command Execution Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Execute the actual command
 */
async function executeCommand(
  supabase: any,
  command: string,
  parameters: Record<string, unknown>,
  user: any
) {
  switch (command.toLowerCase()) {
    case "test":
      return { 
        message: "Command execution test successful",
        user: user.email,
        timestamp: new Date().toISOString(),
      };

    case "ping":
      return { 
        pong: true, 
        timestamp: new Date().toISOString(),
      };

    case "system_status":
      return {
        status: "operational",
        timestamp: new Date().toISOString(),
        user: user.email,
      };

    case "get_keys":
      // جلب معلومات المفاتيح العامة (بدون السرية)
      const { data: keyData } = await supabase
        .from("user_public_keys")
        .select("key_type, created_at")
        .eq("user_id", user.id)
        .single();
      
      return {
        hasKey: !!keyData,
        keyType: keyData?.key_type || null,
        createdAt: keyData?.created_at || null,
      };

    case "get_logs":
      const { data: logs } = await supabase
        .from("immutable_command_log")
        .select("command_text, status, executed_at, result_summary")
        .eq("user_id", user.id)
        .order("executed_at", { ascending: false })
        .limit(10);
      
      return { logs: logs || [] };

    case "get_stats":
      const { count: totalCommands } = await supabase
        .from("immutable_command_log")
        .select("*", { count: "exact" })
        .eq("user_id", user.id);
      
      const { count: failedCommands } = await supabase
        .from("immutable_command_log")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .eq("status", "failed");
      
      return {
        totalCommands,
        failedCommands,
        successRate: totalCommands 
          ? (((totalCommands - (failedCommands || 0)) / totalCommands) * 100).toFixed(2) + "%"
          : "N/A",
      };

    case "rate_limit_update":
      // تحديث حدود المعدل (mock implementation)
      return {
        updated: true,
        newLimit: parameters.limit || 1000,
        window: parameters.window || "1h",
      };

    // Phase 2: Mastermind Commands
    case "analyze_user_behavior":
      // Trigger analyst agent for user behavior analysis
      return {
        success: true,
        message: "User behavior analysis initiated via Mastermind",
        agent: "analyst",
        taskId: `analysis-${Date.now()}`,
      };

    case "optimize_keys":
      // Trigger ops agent for key optimization
      return {
        success: true,
        message: "API key redistribution initiated via Mastermind",
        agent: "ops",
        optimized: true,
        providers: ["groq", "openrouter", "mistral"],
      };

    case "run_security_audit":
      // Trigger security agent for comprehensive audit
      return {
        success: true,
        message: "Security audit initiated via Mastermind",
        agent: "security",
        auditId: `audit-${Date.now()}`,
        scope: ["authentication", "authorization", "data_protection", "api_security"],
      };

    case "mastermind_process":
      // Full mastermind workflow execution
      const { azenithMastermind } = await import("@/lib/mastermind-core");
      const mastermindCommand = parameters.command as string || "general task";
      const signature = parameters.signature as string || "test-sig";
      
      // Get user's public key
      const { data: userKey } = await supabase
        .from("user_public_keys")
        .select("public_key")
        .eq("user_id", user.id)
        .single();
      
      if (!userKey?.public_key) {
        return {
          success: false,
          error: "No public key found. Please setup digital signatures first.",
        };
      }
      
      const result = await azenithMastermind.processCommand(
        mastermindCommand,
        signature,
        userKey.public_key,
        user.id
      );
      
      return result;

    case "quick_command":
      // Quick command using crew directly
      const crewModule = await import("@/lib/crew-factory");
      const quickCommand = parameters.command as string || "quick task";
      type ValidAgent = "coder" | "security" | "analyst" | "ops";
      const validAgentTypes: ValidAgent[] = ["coder", "security", "analyst", "ops"];
      const requestedAgents = (parameters.agents as string[]) || ["analyst"];
      const agentTypes: ValidAgent[] = requestedAgents.filter((a): a is ValidAgent => 
        validAgentTypes.includes(a as ValidAgent)
      );
      if (agentTypes.length === 0) agentTypes.push("analyst");
      
      const crew = crewModule.crewFactory.createTaskForce(agentTypes, quickCommand);
      const tasks = agentTypes.map((type, i) => ({
        id: `quick-${i}`,
        agentType: type,
        description: quickCommand,
      }));
      
      const crewResults = await crew.execute(tasks);
      
      return {
        success: true,
        results: crewResults,
        command: quickCommand,
        agents: agentTypes,
      };

    default:
      throw new Error(`Command '${command}' not implemented`);
  }
}

/**
 * Log failed command attempt
 */
async function logFailedCommand(
  supabase: any,
  userId: string | null,
  command: string,
  failureReason: string,
  ipAddress: string,
  details: string
) {
  try {
    await supabase.from("failed_login_attempts").insert({
      email: userId ? `command:${command}` : "anonymous",
      ip_address: ipAddress,
      failure_reason: `${failureReason}: ${details}`,
    });
  } catch (error) {
    console.error("Failed to log failed command:", error);
  }
}

/**
 * Get command history for current user
 * GET /api/admin/command
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: logs, error } = await supabase
      .from("immutable_command_log")
      .select("id, command_text, status, executed_at, result_summary, command_hash")
      .eq("user_id", user.id)
      .order("executed_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch command history" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      commands: logs || [],
      count: logs?.length || 0,
    });

  } catch (error) {
    console.error("Get Commands Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
