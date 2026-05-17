import { describe, it, expect } from "vitest";
import {
  normalizeTotpToken,
  normalizeBase32Secret,
  verifyTotpToken,
  generateTotpToken,
  collectUniqueTotpSecrets,
} from "@/lib/totp-verify";

describe("totp-verify", () => {
  const secret = "J4YCU22VN5AGMSJRM5MFASKJEEVHC5CQFE7V24JXKE4WWWTNHBYA";

  it("normalizes token input", () => {
    expect(normalizeTotpToken(" 613 260 ")).toBe("613260");
    expect(normalizeTotpToken("abc12")).toBe("12");
  });

  it("normalizes base32 secrets", () => {
    expect(normalizeBase32Secret("j4yc u22v")).toBe("J4YCU22V");
  });

  it("verifies a freshly generated token", () => {
    const token = generateTotpToken(secret);
    expect(token).toHaveLength(6);
    expect(verifyTotpToken(secret, token)).toBe(true);
  });

  it("deduplicates secret candidates", () => {
    const list = collectUniqueTotpSecrets(secret, secret, ` ${secret} `);
    expect(list).toHaveLength(1);
  });
});
