// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The public key never reads the record.
 *
 * Measured 2026-10-15, the day the store's own privacy audit ran: 69 of 155 tables handed rows to a
 * stranger holding `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the key the browser already ships — because a
 * hundred policies written `to public using (true)` were the only reason the store's own doors
 * answered. `public.execute_sql(text)` was executable by that same key, and proved to run any
 * statement as the schema owner.
 *
 * These guards pin the two halves of the fix so a later refactor cannot quietly put the door back:
 * the server's doors carry the server's credential, and the lock exists as a migration the store can
 * replay on any copy of its database.
 */

const PUBLIC_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

describe("the credential a door carries", () => {
  it("names no public key inside an HTTP door", () => {
    const doors = sources("app").filter((p) => !p.includes("__tests__"));
    const offenders = doors.filter((p) => readFileSync(p, "utf8").includes(PUBLIC_KEY));
    expect(offenders, "a door reading the record with the visitor's key is the hole again").toEqual([]);
  });

  it("hands the record to the server's own client, not the browser's", () => {
    const serverClient = readFileSync("lib/supabase-server.ts", "utf8");
    expect(serverClient).not.toContain(PUBLIC_KEY);
    expect(serverClient).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("routes table work away from the session client while keeping the session for signing in", () => {
    const session = readFileSync("utils/supabase/server.ts", "utf8");
    expect(session).toContain("getSupabaseAdminClient");
    expect(session).toMatch(/TABLE_WORK\s*=\s*new Set\(\[[^\]]*"from"/);
    expect(session).toContain("createServerClient");
  });

  it("lists the files that are allowed to hold the public key at all", () => {
    // Six, each with a reason: two browser factories (the dead panels and the realtime listener),
    // one dead file no door imports, the session factory whose table calls are answered by the
    // server, the session refresher that only ever talks to the auth endpoint, and the old data layer
    // whose own server client already carries the service credential and whose anon twin is named by
    // no importer (measured: `supabaseAnon` appears in that file only). A seventh name is a decision,
    // not a drift.
    const allowed = [
      "lib/dal/unified-supabase.ts",
      "lib/supabase-client.ts",
      "lib/supabase.ts",
      "utils/supabase/client.ts",
      "utils/supabase/middleware.ts",
      "utils/supabase/server.ts",
    ].sort();
    const found = [...sources("lib"), ...sources("utils"), ...sources("components")]
      .filter((p) => readFileSync(p, "utf8").includes(PUBLIC_KEY))
      .map((p) => p.replace(/\\/g, "/"))
      .sort();
    expect(found, JSON.stringify(found)).toEqual(allowed);
  });
});

describe("the record answers to the store, so an open write is the store writing on a stranger's word", () => {
  // Two doors write to the picture bank and spend model credit, and neither is called by any surface in
  // the repository (measured 2026-10-15: their names appear only in their own files and the rate-limit
  // list). While they read through the visitor's key their writes were politely refused by the policies;
  // with the store's own credential behind them, an unguarded press would be honoured.
  for (const door of ["app/api/curated-pages/route.ts", "app/api/enhance-image/route.ts"]) {
    it(`${door} stands behind the owner's gate`, () => {
      const source = readFileSync(door, "utf8");
      expect(source).toContain("requireAdminApi");
      expect(source).toContain("if (unauthorized) return unauthorized;");
    });
  }
});

describe("the lock on the database itself", () => {
  const path = "supabase/migrations/20261015_a_lock_the_public_gate.sql";

  it("exists, so any copy of the store's database can be sealed the same way", () => {
    expect(existsSync(path), "the seal has to be a migration, not a one-off command").toBe(true);
  });

  it("takes the record, the counters and the stored functions from both public roles", () => {
    // The file's own prose names `service_role` to explain why it is not named in a statement, so the
    // checks below read the statements, not the comments.
    const statements = readFileSync(path, "utf8").replace(/^\s*--.*$/gm, "");
    for (const kind of ["tables", "sequences", "functions"]) {
      expect(statements, `no revoke for ${kind}`).toContain(`revoke all on all ${kind} in schema public from anon, authenticated;`);
      expect(statements, `no default-privilege revoke for ${kind}`).toContain(
        `alter default privileges in schema public revoke all on ${kind} from anon, authenticated;`,
      );
    }
  });

  it("never names the server's own credential, or every door would die with the hole", () => {
    const statements = readFileSync(path, "utf8").replace(/^\s*--.*$/gm, "");
    expect(statements).not.toMatch(/from[^\n]*service_role/);
    expect(statements).not.toMatch(/to[^\n]*service_role/);
  });

  it("switches row level security on wherever there was none", () => {
    expect(readFileSync(path, "utf8")).toContain("c.relrowsecurity = false");
  });
});
