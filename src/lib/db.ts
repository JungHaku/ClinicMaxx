import type { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { seed } from "./seed";
import { SCHEMA } from "./schema";

// `node:sqlite` is newer than Turbopack's list of externalisable builtins, so a
// plain `import` compiles to a bare `require()` and blows up in the ESM server
// bundle. Reaching for the builtin through `process` happens at runtime and the
// bundler never sees it.
const { DatabaseSync: SQLite } = process.getBuiltinModule("node:sqlite");

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.CLINICMAXX_DB ?? path.join(DATA_DIR, "clinicmaxx.db");

type Row = Record<string, unknown>;

// Next.js hot-reloads modules in dev; keep one connection on globalThis so we
// don't leak file handles or re-run the schema on every edit.
const g = globalThis as unknown as { __clinicmaxx_db?: DatabaseSync };

function open(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const fresh = !fs.existsSync(DB_PATH);
  const db = new SQLite(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);

  const seeded = db.prepare("SELECT COUNT(*) AS n FROM clinic").get() as { n: number };
  if (fresh || seeded.n === 0) seed(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!g.__clinicmaxx_db) g.__clinicmaxx_db = open();
  return g.__clinicmaxx_db;
}

// node:sqlite hands back objects with a null prototype. React refuses to send
// those to Client Components, so every row is copied into a plain object once,
// here, rather than at each call site.
const plain = <T,>(row: unknown): T => ({ ...(row as object) }) as T;

/** Run a SELECT and get every row back, typed. */
export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  const rows = getDb()
    .prepare(sql)
    .all(...(params as never[]));
  return rows.map((r) => plain<T>(r));
}

/** Run a SELECT and get the first row (or undefined). */
export function one<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  const row = getDb()
    .prepare(sql)
    .get(...(params as never[]));
  return row === undefined ? undefined : plain<T>(row);
}

/** Run an INSERT/UPDATE/DELETE. Returns the new rowid for inserts. */
export function run(sql: string, ...params: unknown[]): number {
  const res = getDb()
    .prepare(sql)
    .run(...(params as never[]));
  return Number(res.lastInsertRowid);
}

/** Wrap a unit of work in a transaction. */
export function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function audit(action: string, entity: string, entityId?: number, detail = "") {
  run(
    "INSERT INTO audit_log (at, actor, action, entity, entity_id, detail) VALUES (?,?,?,?,?,?)",
    new Date().toISOString().slice(0, 19),
    "Front desk",
    action,
    entity,
    entityId ?? null,
    detail,
  );
}
