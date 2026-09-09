import type { SqlParam } from "./types";

function quoteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function formatParam(value: SqlParam): string {
  if (value === null || value === undefined) {
    throw new Error("NULL parameters are not in the v0 SQL subset");
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("parameter is not a finite number");
    }
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Uint8Array) {
    const hex = Buffer.from(value).toString("hex");
    return quoteString(`\\x${hex}`);
  }
  if (typeof value === "object") {
    return quoteString(JSON.stringify(value));
  }
  return quoteString(String(value));
}

/** Replace `$1`, `$2`, … with SQL literals. Skip quoted strings and comments. */
export function bindSql(sql: string, params: SqlParam[] = []): string {
  if (params.length === 0) {
    return sql;
  }
  let out = "";
  let i = 0;
  let inStr = false;
  let inLine = false;
  let inBlock = false;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (inLine) {
      out += ch;
      if (ch === "\n") {
        inLine = false;
      }
      i += 1;
      continue;
    }
    if (inBlock) {
      out += ch;
      if (ch === "*" && next === "/") {
        out += next;
        i += 2;
        inBlock = false;
        continue;
      }
      i += 1;
      continue;
    }
    if (inStr) {
      out += ch;
      if (ch === "'" && next === "'") {
        out += next;
        i += 2;
        continue;
      }
      if (ch === "'") {
        inStr = false;
      }
      i += 1;
      continue;
    }
    if (ch === "-" && next === "-") {
      inLine = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlock = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inStr = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "$" && next && next >= "1" && next <= "9") {
      let j = i + 1;
      while (j < sql.length && sql[j] >= "0" && sql[j] <= "9") {
        j += 1;
      }
      const idx = Number(sql.slice(i + 1, j));
      if (idx < 1 || idx > params.length) {
        throw new Error(`SQL parameter $${idx} is missing`);
      }
      out += formatParam(params[idx - 1]);
      i = j;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}
