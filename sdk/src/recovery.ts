import type { RelInfo } from "./catalog";
import type { Column } from "./types";

/** SHA-256 hex page ids from the old in-tab store. Irys GET cannot fetch them. */
export const LEGACY_LOCAL_PAGE_RE = /^[0-9a-f]{64}$/;

export function isLegacyLocalPageId(id: string): boolean {
  return LEGACY_LOCAL_PAGE_RE.test(id);
}

function quoteIdent(name: string): string {
  if (/^[a-z_][a-z0-9_]*$/.test(name)) {
    return name;
  }
  if (!name || /["\\\s]/.test(name)) {
    throw new Error("Invalid identifier");
  }
  return `"${name}"`;
}

export function dropTableSql(name: string): string {
  return `DROP TABLE ${quoteIdent(name)}`;
}

function sqlType(typ: Column["typ"]): string {
  return typ;
}

export function createTableSql(rel: RelInfo): string {
  const cols = rel.columns.map((c, i) => {
    const pk = i === rel.pkAttr ? " PRIMARY KEY" : "";
    const nn = c.notNull && i !== rel.pkAttr ? " NOT NULL" : "";
    return `${c.name} ${sqlType(c.typ)}${pk}${nn}`;
  });
  return `CREATE TABLE ${quoteIdent(rel.name)} (${cols.join(", ")})`;
}

export class UnreadablePageError extends Error {
  readonly pageId: string;
  readonly table: string | null;
  readonly dropSql: string | null;
  readonly createSql: string | null;

  constructor(opts: {
    pageId: string;
    table?: string | null;
    createSql?: string | null;
    cause?: unknown;
  }) {
    const id8 = opts.pageId.slice(0, 8);
    const table = opts.table ?? null;
    const dropSql = table ? dropTableSql(table) : null;
    const hint = dropSql
      ? `Page ${id8} is a local SHA-256 pointer and cannot be fetched. Run ${dropSql}; then CREATE TABLE and INSERT again.`
      : `Page ${id8} is a local SHA-256 pointer and cannot be fetched. Run DROP TABLE, then INSERT again.`;
    super(hint);
    this.name = "UnreadablePageError";
    this.pageId = opts.pageId;
    this.table = table;
    this.dropSql = dropSql;
    this.createSql = opts.createSql ?? null;
    if (opts.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
}

export function recoveryFromError(err: unknown): UnreadablePageError | null {
  if (err instanceof UnreadablePageError) {
    return err;
  }
  return null;
}
