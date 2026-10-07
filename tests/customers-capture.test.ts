import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The link that was never built: the consultant asks for a phone number, gets one,
 * and the store kept it nowhere a human could find. These tests decide what the
 * capture must do — attach the conversation to a profile and record the contact once —
 * and what it must never do: invent a customer, duplicate a contact, or break the
 * reply the customer is waiting for.
 */
const world = vi.hoisted(() => {
  const state = {
    log: [] as string[],
    users: [] as Record<string, unknown>[],
    conversions: [] as Record<string, unknown>[],
    fail: null as string | null,
  };
  const client = () => ({
    from(table: string) {
      const store = () => (table === "users" ? state.users : table === "lead_conversions" ? state.conversions : []);
      const api: Record<string, unknown> = {
        select() { return api; },
        eq(column: string, value: string) {
          state.log.push(`select ${table} ${column}=${value}`);
          api._column = column;
          api._value = value;
          return api;
        },
        async single() {
          if (state.fail) return { data: null, error: { message: state.fail } };
          const col = String(api._column);
          const val = String(api._value);
          return { data: store().find((r) => String(r[col]) === val) ?? null, error: null };
        },
        maybeSingle() { return api.single(); },
        async insert(values: Record<string, unknown>) {
          state.log.push(`insert ${table}`);
          if (state.fail) return { error: { message: state.fail } };
          store().push({ id: `${table}-${store().length + 1}`, ...values });
          return { error: null };
        },
        update(values: Record<string, unknown>) {
          state.log.push(`update ${table}`);
          api._patch = values;
          return {
            async eq(column: string, value: string) {
              const row = store().find((r) => String(r[column]) === value);
              if (row) Object.assign(row, api._patch);
              return { error: state.fail ? { message: state.fail } : null };
            },
          };
        },
      };
      return api;
    },
  });
  return { state, client };
});

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => world.client() as never }));

const SESSION = "web-42";

describe("the conversation contact capture", () => {
  beforeEach(() => {
    world.state.log.length = 0;
    world.state.users = [];
    world.state.conversions = [];
    world.state.fail = null;
  });

  it("does nothing when the visitor left no way to reach them", async () => {
    const { captureConversationContact } = await import("@/lib/customers/capture");
    const out = await captureConversationContact({ sessionId: SESSION, text: "عايز شوف موديلات الكنب" });
    expect(out.recorded).toBe(false);
    expect(out.reason).toBe("no-contact");
    expect(world.state.log.filter((l) => l.startsWith("insert") || l.startsWith("update"))).toEqual([]);
  });

  it("attaches the conversation to a profile and records the number once", async () => {
    const { captureConversationContact } = await import("@/lib/customers/capture");
    const out = await captureConversationContact({
      sessionId: SESSION, text: "أنا علي، رقمي 01005554444 لو سمحت", name: "علي",
    });
    expect(out).toMatchObject({ recorded: true, phone: "1005554444", reason: "created" });
    expect(world.state.users).toHaveLength(1);
    expect(world.state.users[0]).toMatchObject({ session_id: SESSION, phone: "1005554444", full_name: "علي" });
    expect(world.state.conversions).toHaveLength(1);
    expect(world.state.conversions[0]).toMatchObject({ session_id: SESSION, contactMethod: "phone", status: "pending" });
  });

  it("is safe to run twice on the same conversation", async () => {
    const { captureConversationContact } = await import("@/lib/customers/capture");
    const text = "رقمي 01005554444";
    await captureConversationContact({ sessionId: SESSION, text });
    const again = await captureConversationContact({ sessionId: SESSION, text: `${text} وشكرا` });
    expect(again.recorded).toBe(true);
    expect(world.state.users).toHaveLength(1);
    expect(world.state.conversions).toHaveLength(1);
  });

  it("fills a missing number on an existing profile without overwriting what is there", async () => {
    world.state.users.push({ id: "u1", session_id: SESSION, full_name: "هلا", phone: null, tier: "gold" });
    const { captureConversationContact } = await import("@/lib/customers/capture");
    await captureConversationContact({ sessionId: SESSION, text: "01112223344" });
    expect(world.state.users[0]).toMatchObject({ phone: "1112223344", tier: "gold", full_name: "هلا" });
  });

  it("reads an email as a contact too, marked as such", async () => {
    const { captureConversationContact } = await import("@/lib/customers/capture");
    const out = await captureConversationContact({ sessionId: SESSION, text: "ابعتلي على ali@azenith.example" });
    expect(out).toMatchObject({ recorded: true, email: "ali@azenith.example" });
    expect(world.state.conversions[0].contactMethod).toBe("email");
  });

  it("never breaks the customer's reply when the ledger refuses", async () => {
    world.state.fail = "permission denied";
    const { captureConversationContact } = await import("@/lib/customers/capture");
    const out = await captureConversationContact({ sessionId: SESSION, text: "01005554444" });
    expect(out.recorded).toBe(false);
    expect(out.reason).toBe("failed");
    expect(out.detail).toContain("permission denied");
  });

  it("records the area he named, on the profile his conversation owns", async () => {
    const { captureConversationContact } = await import("@/lib/customers/capture");
    const out = await captureConversationContact({
      sessionId: SESSION,
      text: "رقمي 01005554444",
      ownWords: ["أنا بجهز شقة ١٨٠ متر في التجمع", "رقمي 01005554444"],
    });
    expect(out.area).toBe("التجمع");
    // Reported from the row, not from the intention.
    expect(out.areaStored).toBe("التجمع");
    expect(world.state.users[0]).toMatchObject({ area: "التجمع" });
  });

  it("takes no area from the advisor's own coverage answer", async () => {
    const { captureConversationContact } = await import("@/lib/customers/capture");
    const { coverageSentence, areaFromWords } = await import("@/lib/regions");
    const out = await captureConversationContact({
      sessionId: SESSION,
      text: "رقمي 01005554444",
      ownWords: ["عايز ركنة مودرن للصة", "رقمي 01005554444"],
    });
    expect(out.area).toBeNull();
    expect(world.state.users[0].area).toBeNull();
    // The reason the door may only pass his lines: the store's own answer really does name areas.
    expect(areaFromWords([coverageSentence()])).toBe("التجمع");
  });

  it("never rewrites the area he already gave", async () => {
    world.state.users.push({ id: "u1", session_id: SESSION, full_name: null, phone: "1005554444", area: "الشيخ زايد" });
    const { captureConversationContact } = await import("@/lib/customers/capture");
    const out = await captureConversationContact({
      sessionId: SESSION,
      text: "01005554444",
      ownWords: ["لو ممكن نتكلم عن شقة التجمع"],
    });
    expect(out.area).toBe("التجمع");
    expect(out.areaStored).toBe("الشيخ زايد");
    expect(world.state.users[0].area).toBe("الشيخ زايد");
  });
});
