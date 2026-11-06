// @vitest-environment node
import { describe, expect, it } from "vitest";

import { findDestructive, splitStatements } from "@/lib/build/migration-sql";

/**
 * Phase three applies schema to the owner's live record, and his brake says no table and no row is
 * ever dropped. The applier's only defence is a text guard that runs BEFORE anything connects — so it
 * has to survive the shapes that actually appear in this repo's migrations: dollar-quoted bodies,
 * `--` comment lines, and a `drop` hidden inside a policy-creation block.
 */
describe("the migration splitter", () => {
  it("splits on the --SPLIT-- marker and on statement-ending semicolons", () => {
    const sql = ["create table if not exists a (id int);", "create index b on a (id);"].join("\n");
    expect(splitStatements(sql)).toEqual([
      "create table if not exists a (id int);",
      "create index b on a (id);",
    ]);
  });

  it("keeps a dollar-quoted body as ONE statement", () => {
    // Splitting on "; " inside $$ is what broke the first applier: a DO block became three fragments,
    // and each fragment on its own is invalid SQL.
    const sql = [
      "--SPLIT--",
      "do $$",
      "begin",
      "  if not exists (select 1 from pg_policies where tablename='a') then",
      "    execute 'alter table a enable row level security';",
      "  end if;",
      "end",
      "$$;",
    ].join("\n");
    const parts = splitStatements(sql);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toContain("$$");
    expect(parts[0]).toContain("end if;");
  });

  it("drops comment-only lines before deciding what a statement is", () => {
    const sql = "-- a note\n--SPLIT--\n-- another note\ncreate table if not exists c (id int);";
    expect(splitStatements(sql)).toEqual(["create table if not exists c (id int);"]);
  });
});

describe("the destructive guard", () => {
  it("passes a create-and-index migration", () => {
    const statements = splitStatements(
      "create table if not exists t (id int);\ncreate index i on t (id);\nalter table t enable row level security;",
    );
    expect(statements).toHaveLength(3);
    expect(findDestructive(statements)).toEqual([]);
  });

  it("catches dropping a table, a column, or a policy", () => {
    const statements = [
      "drop table public.customer_memory;",
      "alter table t drop column secret;",
      "drop policy \"let all in\" on t;",
    ];
    const bad = findDestructive(statements);
    expect(bad).toHaveLength(3);
    expect(bad.map((b) => b.word)).toEqual(["drop", "drop", "drop"]);
  });

  it("catches deletion hiding inside a dollar-quoted body", () => {
    const statements = splitStatements([
      "do $$",
      "begin",
      "  execute 'delete from public.user_2fa where user_id = $1';",
      "end",
      "$$;",
    ].join("\n"));
    expect(statements).toHaveLength(1);
    expect(findDestructive(statements).map((b) => b.word)).toEqual(["delete"]);
  });

  it("does not mistake a foreign key cascade for a deletion order", () => {
    // `on delete cascade` is a declaration about a future row the owner deletes through the app,
    // not a delete this migration performs.
    expect(
      findDestructive(["create table t (user_id uuid references auth.users (id) on delete cascade);"]),
    ).toEqual([]);
  });
});
