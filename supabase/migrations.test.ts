import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

// Static lints over the SQL migrations. These catch the security mistakes
// that are easy to make and hard to spot in review:
//   - a public table without RLS enabled
//   - a security-definer function without a locked search_path
//   - a security-definer function without an explicit GRANT (so it's
//     only callable by the roles we intend)
// Real integration tests (RLS behaviour against a live Postgres) would
// run via `supabase start` + a test runner; that's out of Phase 2's scope.

const MIGRATIONS_DIR = join(__dirname, "migrations");

function loadAllMigrations(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

const sql = loadAllMigrations();

// Tables we expect to find created in `public.*`. Each must have RLS on.
const PUBLIC_TABLES = ["profiles", "canvases", "workflows", "shares"];

describe("supabase migrations", () => {
  it("creates every expected public table", () => {
    for (const t of PUBLIC_TABLES) {
      const re = new RegExp(`create table if not exists public\\.${t}\\b`, "i");
      expect(sql, `missing CREATE TABLE for public.${t}`).toMatch(re);
    }
  });

  it("enables RLS on every public table it creates", () => {
    for (const t of PUBLIC_TABLES) {
      const re = new RegExp(
        `alter table public\\.${t} enable row level security`,
        "i"
      );
      expect(sql, `RLS not enabled on public.${t}`).toMatch(re);
    }
  });

  it("locks search_path on every security-definer function", () => {
    // Find every `security definer` block and assert the next ~5 lines
    // contain a `set search_path`. Anything else is a privilege-escalation
    // risk: an attacker who can create objects in a schema earlier in the
    // search path can shadow the targeted table.
    const lines = sql.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/security definer/i.test(lines[i])) {
        const window = lines.slice(i, i + 6).join("\n");
        expect(
          window,
          `security-definer function near line ${i + 1} is missing 'set search_path'`
        ).toMatch(/set\s+search_path\s*=/i);
      }
    }
  });

  it("revokes default grants before granting on bump_remix_count", () => {
    // The bump function deliberately allows anonymous calls. We want an
    // explicit revoke-then-grant, not an implicit "grant to public".
    expect(sql).toMatch(/revoke all on function public\.bump_remix_count\(text\) from public/i);
    expect(sql).toMatch(
      /grant execute on function public\.bump_remix_count\(text\) to anon,\s*authenticated/i
    );
  });

  it("auto-creates a profile when a new auth user signs up", () => {
    // The handle_new_user trigger is what makes Phase 3 simpler — we don't
    // need client-side profile bootstrap code.
    expect(sql).toMatch(/create trigger on_auth_user_created/i);
    expect(sql).toMatch(/after insert on auth\.users/i);
  });

  it("cascades user deletes through every owned table", () => {
    // Without `on delete cascade`, deleting a user leaves orphaned rows
    // that fail FK checks and break re-signup.
    for (const t of ["profiles", "canvases", "workflows", "shares"]) {
      const tableRe = new RegExp(
        `create table if not exists public\\.${t}[\\s\\S]*?references auth\\.users\\(id\\) on delete cascade`,
        "i"
      );
      expect(sql, `${t} doesn't cascade on auth.users delete`).toMatch(tableRe);
    }
  });
});
