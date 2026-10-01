// @vitest-environment node
import { describe, expect, it } from "vitest";

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
