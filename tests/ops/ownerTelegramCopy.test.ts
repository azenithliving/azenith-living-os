// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * What an alert looks like on the owner's phone.
 *
 * His screenshots from 2026-10-06: «🔓 ADMIN LOGIN WITH 2FA / User: … / Time:
 * 2026-10-06T10:12:37.142Z» — English labels, and a UTC instant that disagreed with his own clock by
 * three hours. He reads Arabic, counts in Arabic numerals, and the phone is his dashboard. This file
 * is the fence that keeps both facts true, and the guard that the English shape never comes back.
 */
const { telegramAlert, telegramTime } = await import("@/lib/telegram-copy");

describe("the instant is said the way his phone says it", () => {
  it("is Cairo time in his numerals", () => {
    const line = telegramTime(new Date("2026-10-06T10:12:37.142Z"));
    expect(line).toContain("١:١٢");
    expect(line.match(/[0-9A-Za-z]/g) ?? []).toEqual([]);
  });

  it("never prints the raw ISO string", () => {
    expect(telegramTime(new Date())).not.toMatch(/T[0-9]{2}:[0-9]{2}/);
  });

  it("says it cannot read a date rather than inventing one", () => {
    expect(telegramTime("ليس وقتًا")).toBe("وقت غير مقروء");
  });
});

describe("an alert is Arabic labels over his data", () => {
  const alert = telegramAlert(
    "🚨",
    "محاولات دخول فاشلة وراها بعض",
    [
      ["البريد", "azenithliving@gmail.com"],
      ["عدد المحاولات", 7],
      ["العنوان", "41.39.198.54"],
      ["الوقت", telegramTime(new Date("2026-10-06T10:12:37.142Z"))],
    ],
    "ممكن يكون حد بيجرّب يفتح الدار — راجع اللوحة."
  );

  it("counts in his numerals", () => {
    expect(alert).toContain("• عدد المحاولات: ٧");
  });

  it("keeps the values he might need to copy exactly as they are", () => {
    expect(alert).toContain("azenithliving@gmail.com");
    expect(alert).toContain("41.39.198.54");
  });

  it("carries no English label anywhere", () => {
    expect(alert).not.toMatch(/\b(User|Time|IP|Email|Attempts|Provider|Command|Result|Message):/);
  });

  it("escapes markup that came from a database value", () => {
    const risky = telegramAlert("⚠️", "تنبيه", [["التفاصيل", "<script>ظهر</script>"]]);
    expect(risky).toContain("&lt;script&gt;");
    expect(risky).not.toContain("<script>");
  });

  it("drops a field he has nothing to say about, instead of printing an empty line", () => {
    const one = telegramAlert("✅", "تمام", [["المستخدم", "a@b.c"], ["العنوان", undefined]]);
    expect(one).not.toContain("العنوان");
  });
});

/**
 * The transport, not the wording: a security notice must reach every admin chat he seated, and must
 * never claim it arrived when no chat was told.
 */
const channel = vi.hoisted(() => ({ enabled: true, botToken: "t", chatId: "c", landed: 2 }));

vi.mock("@/lib/telegram-config", () => ({
  getActiveTelegramConfig: async () => ({
    enabled: channel.enabled,
    botToken: channel.botToken,
    chatId: channel.chatId,
    allChats: [],
  }),
  broadcastTelegramMessage: async () => channel.landed,
}));

const { sendSecurityAlert } = await import("@/lib/telegram-notify");

beforeEach(() => {
  channel.enabled = true;
  channel.botToken = "t";
  channel.landed = 2;
});

describe("a security notice is honest about reaching him", () => {
  it("goes to every admin chat, not the first one", async () => {
    expect(await sendSecurityAlert("تنبيه")).toBe(true);
  });

  it("says false when no chat answered", async () => {
    channel.landed = 0;
    expect(await sendSecurityAlert("تنبيه")).toBe(false);
  });

  it("says false when there is no channel at all — silence is not a warning", async () => {
    channel.enabled = false;
    expect(await sendSecurityAlert("تنبيه")).toBe(false);
    channel.enabled = true;
    channel.botToken = "";
    expect(await sendSecurityAlert("تنبيه")).toBe(false);
  });
});

describe("the English shape stays retired", () => {
  const retired = [
    "ADMIN LOGIN",
    "INVALID SIGNATURE",
    "INVALID 2FA DISABLE",
    "DANGEROUS COMMAND",
    "2FA ENABLED",
    "2FA DISABLED",
    "PRIMARY ADMIN",
    "MULTIPLE FAILED",
    "Key Exhausted",
    "Backup Key Activated",
    "Key Monitor Error",
    "SOVEREIGN SECURITY EVENT",
  ];

  const files = [
    "lib/telegram-notify.ts",
    "lib/key-monitor.ts",
    "app/api/admin/2fa/verify/route.ts",
    "app/api/admin/verify-2fa/route.ts",
    "app/api/admin/2fa/disable/route.ts",
  ];

  for (const file of files) {
    it(`${file} builds its alerts through the copy module, not raw English`, () => {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("telegramAlert");
      for (const phrase of retired) expect(`${file}: ${source}`).not.toContain(phrase);
      expect(source).not.toMatch(/Time: \$\{new Date\(\)\.toISOString\(\)\}/);
    });
  }
});
