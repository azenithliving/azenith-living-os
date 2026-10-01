// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SYNC_EVENT_TYPES } from "@/lib/ops/syncTypes";
import {
  ALERT_ACK_TYPE,
  ALERT_EVENT_TYPES,
  alertLabel,
  alertSourceLabel,
  isAlertEventType,
} from "@/lib/ops/alerts";

/**
 * The red strip is the one surface that interrupts the owner, so its wording is
 * guarded: a missing label would render an empty red bar, and a raw event type or
 * agent key would arrive scrambled on his phone.
 */
describe("the emergency reading rule", () => {
  it("has an Arabic sentence for every trouble the ledger can hold", () => {
    for (const type of ALERT_EVENT_TYPES) {
      const label = alertLabel(type);
      expect(label, `${type} has no sentence`).toBeTruthy();
      expect(label, `${type} leaks Latin into his alert`).not.toMatch(/[A-Za-z]/);
    }
  });

  it("stays silent on a type it does not know", () => {
    expect(alertLabel("totally_unknown_type")).toBe("");
    expect(isAlertEventType("totally_unknown_type")).toBe(false);
    expect(isAlertEventType("identity_violation")).toBe(true);
  });

  it("names the speaker as a person, whatever spelling the ledger stored", () => {
    expect(alertSourceLabel("OPS-LEAD")).toBe("مدير تشغيل المحتوى");
    expect(alertSourceLabel("qayyim-core")).toBe("مدير تشغيل المحتوى");
    expect(alertSourceLabel("vanguard")).toBe("مدير المبيعات");
    expect(alertSourceLabel("some_other_machine")).toBe("");
  });

  it("records an acknowledgement as an event, not as a second state", () => {
    expect(ALERT_ACK_TYPE).toBe("owner_alert_acknowledged");
    expect(isAlertEventType(ALERT_ACK_TYPE)).toBe(false);
  });
});

/**
 * Measured live on the published site: raising an anomaly through the swarm's own
 * door answered 400, because the door validated against a hand-copied list that was
 * missing three kinds the ledger already defines — one of them the very anomaly the
 * red strip reads. The strip could therefore only ever light up by accident.
 */
describe("the door and the ledger agree on what may be written", () => {
  it("keeps one list, read by both sides", () => {
    expect(new Set(SYNC_EVENT_TYPES).size).toBe(SYNC_EVENT_TYPES.length);
    const door = readFileSync("app/api/admin/ops/route.ts", "utf8");
    expect(door).toContain("z.enum(SYNC_EVENT_TYPES)");
    expect(door, "a hand-copied event list came back").not.toContain("'draft_rolled_back', 'audit_completed'");
  });

  it("can publish every alert the strip reads, except the machine bus's own", () => {
    const publishable = new Set<string>(SYNC_EVENT_TYPES);
    const unreachable = ALERT_EVENT_TYPES.filter((t) => !t.includes(":") && !publishable.has(t));
    expect(unreachable, `no door can raise: ${unreachable.join(", ")}`).toEqual([]);
  });

  it("still accepts the three kinds the copied list refused", () => {
    for (const t of ["anomaly_detected", "market_update", "self_audit_completed"]) {
      expect(SYNC_EVENT_TYPES).toContain(t);
    }
  });
});
