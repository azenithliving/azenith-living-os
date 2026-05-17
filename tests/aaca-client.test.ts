import { describe, it, expect, afterEach } from "vitest";
import {
  shouldDelegateToAaca,
  parseAacaIntent,
  getAacaBaseUrl,
  isCloudAgentMode,
  checkAacaHealth,
} from "@/lib/aaca-client";

describe("aaca-client", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("delegates on /aaca and /وكلاء prefix", () => {
    expect(shouldDelegateToAaca("/aaca فحص أمن الموقع")).toBe(true);
    expect(shouldDelegateToAaca("/وكلاء حلل المبيعات")).toBe(true);
    expect(shouldDelegateToAaca("مرحبا")).toBe(false);
  });

  it("infers task type from Arabic intent", () => {
    const intent = parseAacaIntent("/aaca فحص أمن قاعدة البيانات");
    expect(intent.taskType).toBe("SECURITY_SCAN");
    expect(intent.text).toContain("فحص");
  });

  it("uses AACA_SERVICE_URL when set", () => {
    process.env.AACA_SERVICE_URL = "https://aaca.example.com";
    expect(getAacaBaseUrl()).toBe("https://aaca.example.com");
  });

  it("cloud mode by default (no local AACA required)", () => {
    delete process.env.AACA_CLOUD_MODE;
    delete process.env.AACA_REQUIRE_LOCAL_SERVER;
    expect(isCloudAgentMode()).toBe(true);
  });

  it("health is READY in cloud mode", async () => {
    delete process.env.AACA_SERVICE_URL;
    delete process.env.AACA_REQUIRE_LOCAL_SERVER;
    const health = await checkAacaHealth();
    expect(health.status).toBe("READY");
    expect(health.mode).toBe("cloud");
  });
});
