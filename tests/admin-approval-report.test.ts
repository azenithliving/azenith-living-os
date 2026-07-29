import { describe, expect, it } from "vitest";
import {
  buildAdminApprovalReport,
  formatApprovalReportForChat,
} from "@/lib/admin-approval-report";

describe("admin approval report", () => {
  it("translates evolve into a clear owner-facing decision report", () => {
    const report = buildAdminApprovalReport(
      { kind: "command", command: "evolve", commandLine: "evolve", confidence: 1 },
      "افحص الموقع وقولي اتعلمت ايه"
    );

    expect(report.actionLabel).toBe("مراجعة وتطوير آمن للموقع");
    expect(report.whereToSeeResult).toContain("محادثة المساعد");
    expect(report.whatWillHappen.join(" ")).not.toContain("evolve");

    const chat = formatApprovalReportForChat(report);
    expect(chat).toContain("أين ستظهر النتيجة؟");
    expect(chat).toContain("المخاطر/الحدود");
    expect(chat).toContain("ضمانات الأمان");
  });
});
