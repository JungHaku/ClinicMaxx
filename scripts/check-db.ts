/**
 * `npm run db:check` — validates the Supabase connection strings in .env.local
 * and proves they actually connect.
 *
 * Prints diagnostics only: hostnames, ports and roles. Never the password.
 */
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import dns from "node:dns/promises";

const ROOT = process.cwd();

/* --------------------------------------------------------------- env load */

function loadEnv(file: string): Record<string, string> {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val) out[key] = val;
  }
  return out;
}

const env = { ...loadEnv(".env.local"), ...loadEnv(".env") };

/* ------------------------------------------------------------- reporting */

const OK = "  \x1b[32m✓\x1b[0m";
const BAD = "  \x1b[31m✗\x1b[0m";
const WARN = "  \x1b[33m!\x1b[0m";
let failures = 0;
let warnings = 0;

const ok = (m: string) => console.log(`${OK} ${m}`);
const bad = (m: string) => {
  failures++;
  console.log(`${BAD} ${m}`);
};
const warn = (m: string) => {
  warnings++;
  console.log(`${WARN} ${m}`);
};

/* -------------------------------------------------------------- analysis */

interface Parsed {
  url: URL;
  host: string;
  port: number;
  user: string;
  db: string;
  passwordLength: number;
  mode: "transaction" | "session" | "direct" | "unknown";
}

function parse(name: string, raw: string, wantPort: number): Parsed | null {
  if (raw.includes("[YOUR-PASSWORD]") || raw.includes("YOUR-PASSWORD")) {
    bad(`${name} still contains the [YOUR-PASSWORD] placeholder`);
    return null;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    bad(`${name} is not a valid URL. It should start with postgresql://`);
    return null;
  }

  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    bad(`${name} has protocol "${url.protocol}" — expected postgresql://`);
    return null;
  }

  const port = Number(url.port || 5432);
  const password = decodeURIComponent(url.password || "");
  if (!password) {
    bad(`${name} has no password in it`);
    return null;
  }

  // A raw @ or # in the password truncates the URL and usually shows up as a
  // nonsense hostname, so flag it here rather than letting DNS fail cryptically.
  if (!url.hostname.includes(".")) {
    bad(
      `${name} parsed the hostname as "${url.hostname}", which looks wrong — ` +
        `an unencoded @ or # in the password will do this. Encode it: @ = %40, # = %23`,
    );
    return null;
  }

  // An unencoded @ inside the password is genuinely ambiguous: WHATWG URL (and
  // therefore postgres.js) splits on the LAST @, while libpq and psql split on
  // the FIRST. The string then means different things to different tools.
  const authority = raw.slice(raw.indexOf("://") + 3, raw.lastIndexOf("@"));
  if (authority.includes("@")) {
    warn(
      `${name} has an unencoded @ in the password. Node reads it one way and psql ` +
        `another, so this works here but fails there. Replace it with %40.`,
    );
  }
  if (/[#?]/.test(authority)) {
    warn(`${name} has an unencoded # or ? in the password. Encode them: # = %23, ? = %3F`);
  }

  const mode: Parsed["mode"] = url.hostname.includes("pooler.supabase.com")
    ? port === 6543
      ? "transaction"
      : "session"
    : url.hostname.includes("supabase.co")
      ? "direct"
      : "unknown";

  ok(`${name}  host=${url.hostname}  port=${port}  role=${url.username}  db=${url.pathname.slice(1)}`);
  console.log(
    `      password: ${password.length} chars, ${
      /[@:/?#&[\]]/.test(password) ? "contains URL-special characters" : "no special characters"
    }`,
  );

  if (port !== wantPort) {
    warn(
      `${name} is on port ${port}; ${wantPort} is expected here ` +
        `(${wantPort === 6543 ? "transaction pooler, for app queries" : "session pooler, for DDL and bulk loads"})`,
    );
  }
  if (mode === "direct") {
    warn(
      `${name} uses the direct connection. It is IPv6-only on new projects — ` +
        `prefer the pooler host unless you have the IPv4 add-on.`,
    );
  }

  return {
    url,
    host: url.hostname,
    port,
    user: url.username,
    db: url.pathname.slice(1),
    passwordLength: password.length,
    mode,
  };
}

async function reachable(host: string, port: number): Promise<string | null> {
  try {
    await dns.lookup(host);
  } catch {
    return `DNS lookup failed for ${host}`;
  }
  return new Promise((resolve) => {
    const s = net.createConnection({ host, port, timeout: 8000 });
    s.on("connect", () => {
      s.destroy();
      resolve(null);
    });
    s.on("timeout", () => {
      s.destroy();
      resolve(`timed out connecting to ${host}:${port}`);
    });
    s.on("error", (e: NodeJS.ErrnoException) =>
      resolve(`cannot reach ${host}:${port} — ${e.code ?? e.message}`),
    );
  });
}

/* ------------------------------------------------------------------ main */

console.log("\n  Checking ClinicMaxx database configuration\n");

if (!fs.existsSync(path.join(ROOT, ".env.local"))) {
  bad(".env.local does not exist — run: cp .env.example .env.local");
}

const dbRaw = env.DATABASE_URL;
const migRaw = env.MIGRATION_URL;

if (!dbRaw) bad("DATABASE_URL is empty");
if (!migRaw) bad("MIGRATION_URL is empty");

const parsedDb = dbRaw ? parse("DATABASE_URL ", dbRaw, 6543) : null;
const parsedMig = migRaw ? parse("MIGRATION_URL", migRaw, 5432) : null;

if (parsedDb && parsedMig && parsedDb.host !== parsedMig.host) {
  warn("The two URLs point at different hosts — check you copied both from the same project.");
}

for (const [label, p] of [
  ["DATABASE_URL ", parsedDb],
  ["MIGRATION_URL", parsedMig],
] as const) {
  if (!p) continue;
  const problem = await reachable(p.host, p.port);
  if (problem) bad(`${label} ${problem}`);
  else ok(`${label} TCP connect to ${p.host}:${p.port} succeeded`);
}

/* Authentication — only if a driver is installed. */
let pgTested = false;
if (parsedMig && failures === 0) {
  try {
    const { default: postgres } = (await import("postgres")) as {
      default: (url: string, opts?: Record<string, unknown>) => never;
    };
    for (const [label, p, raw] of [
      ["MIGRATION_URL", parsedMig, migRaw],
      ["DATABASE_URL ", parsedDb, dbRaw],
    ] as const) {
      if (!p || !raw) continue;
      const sql = postgres(raw, {
        max: 1,
        idle_timeout: 2,
        connect_timeout: 10,
        // Transaction pooling cannot keep prepared statements around.
        prepare: p.mode !== "transaction",
      }) as unknown as {
        unsafe: (q: string) => Promise<Array<Record<string, unknown>>>;
        end: () => Promise<void>;
      };
      try {
        const rows = await sql.unsafe(
          "select current_user, current_database(), split_part(version(),' on ',1) as version",
        );
        const r = rows[0];
        ok(`${label} authenticated as ${r.current_user} on ${r.current_database} — ${r.version}`);
        pgTested = true;
      } catch (e) {
        bad(`${label} connected but authentication failed: ${(e as Error).message}`);
      } finally {
        await sql.end().catch(() => {});
      }
    }
  } catch {
    warn("The `postgres` driver is not installed yet, so credentials were not verified.");
    warn("Install it with: npm install postgres");
  }
}

/* --------------------------------------------------------------- summary */

console.log();
if (failures > 0) {
  console.log(`  \x1b[31m${failures} problem(s) to fix\x1b[0m${warnings ? `, ${warnings} warning(s)` : ""}\n`);
  process.exit(1);
}
console.log(
  `  \x1b[32mConfiguration looks good\x1b[0m${warnings ? ` (${warnings} warning(s) above)` : ""}` +
    `${pgTested ? " — credentials verified against the live database." : "."}\n`,
);
