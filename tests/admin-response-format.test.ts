import { describe, it, expect } from "vitest";
import { formatCommandResultForUser } from "@/lib/admin-response-format";

describe("admin-response-format", () => {
  it("formats list_keys in Arabic", () => {
    const text = formatCommandResultForUser(
      {
        success: true,
        message: "Found 3 key(s)",
        data: {
          total: 3,
          keys: [
            { provider: "groq", status: "active" },
            { provider: "groq", status: "active" },
            { provider: "openrouter", status: "active" },
          ],
        },
      },
      "list_keys"
    );
    expect(text).toContain("3");
    expect(text).toContain("groq");
  });
});
