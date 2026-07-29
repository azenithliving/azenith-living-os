export type ApprovalRiskLevel = "info" | "normal" | "critical" | "forbidden";

export function normalizeApprovalRiskLevel(risk: string | null | undefined): ApprovalRiskLevel {
  switch ((risk || "normal").toLowerCase()) {
    case "low":
    case "info":
      return "info";
    case "medium":
    case "normal":
      return "normal";
    case "high":
    case "critical":
      return "critical";
    case "destructive":
    case "forbidden":
      return "forbidden";
    default:
      return "normal";
  }
}
