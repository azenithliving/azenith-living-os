// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * `user_2fa` is keyed by `user_id`: that column is unique and carries a foreign
 * key into auth.users, and there is no `email` column at all (asking for it
 * answers 42703). Every route that gates the admin login used to write `email`
 * anyway, so the write meant to keep the enrolled key in sync died quietly and
 * the gate fell back to whatever else it could find — and an operator pressing
 * the reset button was told it worked.
 *
 * An upsert with no conflict target is the same failure in a different costume:
 * PostgREST resolves the PRIMARY KEY (`id`), which is not in the payload, so the
 * statement is an insert and a second enrolment collides on `user_id`.
 */
const ROUTES = [
  "app/api/admin/verify-2fa/route.ts",
  "app/api/admin/gate/reset-2fa/route.ts",
  "app/api/admin/2fa/setup/route.ts",
];

/** Every chain that starts at `user_2fa`, up to the semicolon that closes it. */
function user2faChains(src: string): string[] {
  const out: string[] = [];
  const re = /from\(\s*["']user_2fa["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const rest = src.slice(m.index);
    const end = rest.indexOf(";");
    out.push(end === -1 ? rest : rest.slice(0, end));
  }
  return out;
}

describe.each(ROUTES)("%s", (file) => {
  const src = readFileSync(resolve(process.cwd(), file), "utf8");
  const chains = user2faChains(src);

  it("touches the table at all, so this guard is not vacuous", () => {
    expect(chains.length).toBeGreaterThan(0);
  });

  it("never names a column the table does not have", () => {
    const offenders = chains.filter((c) => /\bemail\b/.test(c));
    expect(offenders, offenders.join("\n---\n")).toEqual([]);
  });

  it("states the conflict target on every upsert", () => {
    const upserts = chains.filter((c) => /\.\s*upsert\s*\(/.test(c));
    for (const up of upserts) {
      expect(up).toContain(`onConflict: "user_id"`);
    }
    expect(upserts.length).toBeGreaterThan(0);
  });
});

/**
 * The second factor is only worth having if the key that decides it stays behind
 * the first one. A route outside `app/api/admin` runs before anyone is in: the
 * ones that used to live there answered with the enrolled key to a
 * password-only caller, and another one verified any code computed against any
 * key the caller supplied. The authenticated twins exist; these do not.
 */
describe("nothing before the gate touches the second factor", () => {
  function routes(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return routes(full);
      return entry === "route.ts" ? [full] : [];
    });
  }

  const apiRoot = resolve(process.cwd(), "app/api");
  const preLogin = routes(apiRoot).filter(
    (f) => !f.startsWith(join(apiRoot, "admin"))
  );

  it("has a pre-login surface to guard", () => {
    expect(preLogin.length).toBeGreaterThan(0);
  });

  it("leaves the enrolled key out of it", () => {
    const offenders = preLogin.filter((f) =>
      /user_2fa|speakeasy\.totp\.verify/.test(readFileSync(f, "utf8"))
    );
    expect(offenders, offenders.join(", ")).toEqual([]);
  });
});
