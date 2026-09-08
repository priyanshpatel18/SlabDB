import type { ColTypeName, SqlValue } from "./types";

export type ParsedCreate = {
  kind: "create";
  name: string;
  columns: { name: string; typ: ColTypeName; notNull: boolean }[];
  pkAttr: number;
};

export type ParsedInsert = {
  kind: "insert";
  table: string;
  columns: string[] | null;
  values: SqlValue[];
};

export type ParsedSelect = {
  kind: "select";
  table: string;
  columns: string[] | "*";
  where: { col: string; value: SqlValue } | null;
};

export type ParsedSql = ParsedCreate | ParsedInsert | ParsedSelect;

const TYPE_ALIASES: Record<string, ColTypeName> = {
  bool: "bool",
  boolean: "bool",
  int4: "int4",
  int: "int4",
  integer: "int4",
  int8: "int8",
  bigint: "int8",
  text: "text",
  timestamptz: "timestamptz",
  timestamp: "timestamptz",
};

function strip(sql: string): string {
  return sql.trim().replace(/;+\s*$/, "").trim();
}

function parseValue(raw: string): SqlValue {
  const t = raw.trim();
  if (/^true$/i.test(t)) {
    return true;
  }
  if (/^false$/i.test(t)) {
    return false;
  }
  if (t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).replace(/''/g, "'");
  }
  if (/^-?\d+$/.test(t)) {
    const n = BigInt(t);
    if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(Number.MIN_SAFE_INTEGER)) {
      return n;
    }
    return Number(n);
  }
  throw new Error(`cannot parse SQL value ${raw}`);
}

function splitArgs(list: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inStr = false;
  for (let i = 0; i < list.length; i++) {
    const ch = list[i];
    if (inStr) {
      cur += ch;
      if (ch === "'" && list[i + 1] === "'") {
        cur += list[++i];
      } else if (ch === "'") {
        inStr = false;
      }
      continue;
    }
    if (ch === "'") {
      inStr = true;
      cur += ch;
      continue;
    }
    if (ch === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) {
    out.push(cur.trim());
  }
  return out;
}

function parseCreate(sql: string): ParsedCreate {
  const m = /^CREATE\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*$/is.exec(sql);
  if (!m) {
    throw new Error("CREATE TABLE syntax is not in the v0 subset");
  }
  const name = m[1].toLowerCase();
  const parts = splitArgs(m[2]);
  const columns: ParsedCreate["columns"] = [];
  let pkAttr = -1;
  for (const part of parts) {
    const pkTable = /^PRIMARY\s+KEY\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*$/i.exec(part);
    if (pkTable) {
      const pkName = pkTable[1].toLowerCase();
      pkAttr = columns.findIndex((c) => c.name === pkName);
      if (pkAttr < 0) {
        throw new Error(`PRIMARY KEY column ${pkName} is missing`);
      }
      columns[pkAttr].notNull = true;
      continue;
    }
    const col = /^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z0-9]+)\s*(.*)$/i.exec(part.trim());
    if (!col) {
      throw new Error(`cannot parse column ${part}`);
    }
    const typ = TYPE_ALIASES[col[2].toLowerCase()];
    if (!typ) {
      throw new Error(`unknown type ${col[2]}`);
    }
    const rest = col[3].toUpperCase();
    const isPk = /\bPRIMARY\s+KEY\b/.test(rest);
    const notNull = isPk || /\bNOT\s+NULL\b/.test(rest);
    if (isPk) {
      pkAttr = columns.length;
    }
    columns.push({ name: col[1].toLowerCase(), typ, notNull });
  }
  if (pkAttr < 0) {
    throw new Error("CREATE TABLE needs a PRIMARY KEY");
  }
  if (columns.length === 0) {
    throw new Error("CREATE TABLE needs at least one column");
  }
  return { kind: "create", name, columns, pkAttr };
}

function parseInsert(sql: string): ParsedInsert {
  const m =
    /^INSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?\s*VALUES\s*\((.*)\)\s*$/is.exec(
      sql
    );
  if (!m) {
    throw new Error("INSERT syntax is not in the v0 subset");
  }
  const columns = m[2]
    ? splitArgs(m[2]).map((c) => c.toLowerCase())
    : null;
  const values = splitArgs(m[3]).map(parseValue);
  return { kind: "insert", table: m[1].toLowerCase(), columns, values };
}

function parseSelect(sql: string): ParsedSelect {
  const m =
    /^SELECT\s+(\*|[A-Za-z0-9_,\s]+)\s+FROM\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:WHERE\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+))?\s*$/is.exec(
      sql
    );
  if (!m) {
    throw new Error("SELECT syntax is not in the v0 subset");
  }
  const colRaw = m[1].trim();
  const columns: string[] | "*" =
    colRaw === "*"
      ? "*"
      : colRaw.split(",").map((c) => c.trim().toLowerCase());
  const where = m[3]
    ? { col: m[3].toLowerCase(), value: parseValue(m[4]) }
    : null;
  return { kind: "select", table: m[2].toLowerCase(), columns, where };
}

export function parseSql(sql: string): ParsedSql {
  const s = strip(sql);
  if (/\bJOIN\b/i.test(s) || /\bUNION\b/i.test(s) || /^\s*(UPDATE|DELETE|BEGIN|COPY)\b/i.test(s)) {
    throw new Error("statement is not in the v0 SQL subset");
  }
  if (/^CREATE\s+TABLE\b/i.test(s)) {
    return parseCreate(s);
  }
  if (/^INSERT\s+INTO\b/i.test(s)) {
    return parseInsert(s);
  }
  if (/^SELECT\b/i.test(s)) {
    return parseSelect(s);
  }
  throw new Error("statement is not in the v0 SQL subset");
}
