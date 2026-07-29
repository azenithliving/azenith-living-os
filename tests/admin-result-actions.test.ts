import { describe, expect, it } from "vitest";
import { buildResultActions } from "@/lib/admin-result-actions";

describe("admin result actions", () => {
  it("turns created section results into owner navigation actions", () => {
    const actions = buildResultActions({
      sectionId: "section-123",
      previewUrl: "/preview/section/section-123",
    });

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "افتح المعاينة", href: "/preview/section/section-123" }),
        expect.objectContaining({ label: "افتح القسم", href: "/preview/section/section-123" }),
      ])
    );
  });

  it("finds useful links inside nested execution payloads", () => {
    const actions = buildResultActions({
      result: {
        data: {
          prUrl: "https://github.com/acme/site/pull/7",
        },
      },
    });

    expect(actions).toContainEqual({
      label: "افتح طلب المراجعة",
      href: "https://github.com/acme/site/pull/7",
      kind: "external",
    });
  });
});
