import {
  parseFirst,
  type CreateColumnDef,
  type CreateIndexStatement,
  type CreateTableStatement,
  type DataTypeDef,
  type DeleteStatement,
  type DropStatement,
  type Expr,
  type From,
  type InsertStatement,
  type Name,
  type QName,
  type SelectFromStatement,
  type Statement,
  type UpdateStatement,
  type ValuesStatement,
} from "pgsql-ast-parser";
import { bindSql } from "./params";
import type { ColTypeName, SqlParam, SqlValue } from "./types";

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
  rows: SqlValue[][];
};

export type ParsedSelect = {
  kind: "select";
  table: string;
  columns: string[] | "*";
  where: { col: string; value: SqlValue } | null;
  limit: number | null;
  offset: number;
  orderBy: { col: string; dir: "asc" | "desc" }[];
};

export type ParsedUpdate = {
  kind: "update";
  table: string;
  set: { col: string; value: SqlValue }[];
  where: { col: string; value: SqlValue };
};

export type ParsedDelete = {
  kind: "delete";
  table: string;
  where: { col: string; value: SqlValue };
};

export type ParsedDrop = {
  kind: "drop";
  name: string;
};

export type ParsedCreateIndex = {
  kind: "createIndex";
  table: string;
  column: string;
};

export type ParsedSql =
  | ParsedCreate
  | ParsedInsert
  | ParsedSelect
  | ParsedUpdate
  | ParsedDelete
  | ParsedDrop
  | ParsedCreateIndex;

const TYPE_ALIASES: Record<string, ColTypeName> = {
  bool: "bool",
  boolean: "bool",
  int: "int4",
  int2: "int4",
  int4: "int4",
  integer: "int4",
  smallint: "int4",
  serial: "int4",
  smallserial: "int4",
  int8: "int8",
  bigint: "int8",
  bigserial: "int8",
  text: "text",
  varchar: "text",
  char: "text",
  character: "text",
  "character varying": "text",
  bpchar: "text",
  name: "text",
  uuid: "uuid",
  timestamptz: "timestamptz",
  timestamp: "timestamptz",
  "timestamp with time zone": "timestamptz",
  "timestamp without time zone": "timestamptz",
  date: "timestamptz",
  float: "float8",
  float4: "float8",
  float8: "float8",
  double: "float8",
  "double precision": "float8",
  real: "float8",
  numeric: "float8",
  decimal: "float8",
  json: "json",
  jsonb: "json",
  bytea: "bytea",
  blob: "bytea",
  bytes: "bytea",
};

const NOW_KEYWORDS = new Set([
  "current_timestamp",
  "localtimestamp",
  "current_time",
  "localtime",
  "current_date",
]);

function subset(detail?: string): never {
  throw new Error(
    detail
      ? `statement is not in the v0 SQL subset: ${detail}`
      : "statement is not in the v0 SQL subset"
  );
}

function ident(name: string): string {
  return name.toLowerCase();
}

function tableName(q: QName): string {
  if (q.schema) {
    subset("schema-qualified names");
  }
  return ident(q.name);
}

function colType(dt: DataTypeDef): ColTypeName {
  if ("kind" in dt && dt.kind === "array") {
    throw new Error("unknown type array");
  }
  const name = dt.name.toLowerCase().replace(/\s+/g, " ");
  const typ = TYPE_ALIASES[name];
  if (!typ) {
    throw new Error(`unknown type ${dt.name}`);
  }
  return typ;
}

function nowIso(): string {
  return new Date().toISOString();
}

function intValue(n: number): SqlValue {
  if (!Number.isFinite(n)) {
    throw new Error(`cannot parse SQL value ${n}`);
  }
  if (!Number.isInteger(n)) {
    throw new Error(`cannot parse SQL value ${n}`);
  }
  if (n > Number.MAX_SAFE_INTEGER || n < Number.MIN_SAFE_INTEGER) {
    return BigInt(n);
  }
  return n;
}

function exprValue(expr: Expr): SqlValue {
  switch (expr.type) {
    case "boolean":
      return expr.value;
    case "string":
      return expr.value;
    case "integer":
      return intValue(expr.value);
    case "numeric":
      if (Number.isInteger(expr.value)) {
        return intValue(expr.value);
      }
      if (!Number.isFinite(expr.value)) {
        throw new Error(`cannot parse SQL value ${expr.value}`);
      }
      return expr.value;
    case "unary":
      if (expr.op === "+" || expr.op === "-") {
        const inner = exprValue(expr.operand);
        if (typeof inner === "boolean" || typeof inner === "string") {
          throw new Error(`cannot parse SQL value`);
        }
        if (expr.op === "+") {
          return inner;
        }
        return typeof inner === "bigint" ? -inner : -Number(inner);
      }
      subset("unary expression");
    case "cast":
      return exprValue(expr.operand);
    case "call": {
      const fn = ident(expr.function.name);
      if (fn === "now" && expr.args.length === 0) {
        return nowIso();
      }
      subset(`function ${fn}()`);
    }
    case "keyword":
      if (NOW_KEYWORDS.has(expr.keyword)) {
        return nowIso();
      }
      subset(`keyword ${expr.keyword}`);
    case "null":
      subset("NULL");
    case "default":
      subset("DEFAULT");
    case "ref":
      subset("column reference in a value");
    default:
      subset("expression");
  }
}

function eqFilter(expr: Expr | null | undefined): { col: string; value: SqlValue } | null {
  if (!expr) {
    return null;
  }
  if (expr.type !== "binary" || expr.op !== "=") {
    subset("WHERE must be column = literal");
  }
  const left = expr.left;
  const right = expr.right;
  if (left.type === "ref" && left.name !== "*") {
    return { col: ident(left.name), value: exprValue(right) };
  }
  if (right.type === "ref" && right.name !== "*") {
    return { col: ident(right.name), value: exprValue(left) };
  }
  subset("WHERE must be column = literal");
}

function requireEqFilter(expr: Expr | null | undefined): { col: string; value: SqlValue } {
  const where = eqFilter(expr);
  if (!where) {
    subset("WHERE column = literal is required");
  }
  return where;
}

function singleTable(from: From[] | null | undefined): string {
  if (!from || from.length !== 1) {
    subset("JOIN");
  }
  const src = from[0];
  if (src.type !== "table" || src.join) {
    subset("JOIN");
  }
  return tableName(src.name);
}

function mapCreate(stmt: CreateTableStatement): ParsedCreate {
  if (stmt.temporary || stmt.unlogged || stmt.inherits?.length) {
    subset("CREATE TABLE option");
  }
  const columns: ParsedCreate["columns"] = [];
  let pkAttr = -1;
  for (const col of stmt.columns) {
    if (col.kind !== "column") {
      subset("CREATE TABLE LIKE");
    }
    const def = col as CreateColumnDef;
    const constraints = def.constraints ?? [];
    for (const c of constraints) {
      if (
        c.type === "reference" ||
        c.type === "check" ||
        c.type === "unique" ||
        c.type === "add generated"
      ) {
        subset(`column constraint ${c.type}`);
      }
    }
    const isPk = constraints.some((c) => c.type === "primary key");
    const notNull =
      isPk || constraints.some((c) => c.type === "not null");
    if (isPk) {
      pkAttr = columns.length;
    }
    columns.push({
      name: ident(def.name.name),
      typ: colType(def.dataType),
      notNull,
    });
  }
  for (const c of stmt.constraints ?? []) {
    if (c.type === "primary key") {
      if (c.columns.length !== 1) {
        subset("composite PRIMARY KEY");
      }
      const pkName = ident(c.columns[0].name);
      pkAttr = columns.findIndex((col) => col.name === pkName);
      if (pkAttr < 0) {
        throw new Error(`PRIMARY KEY column ${pkName} is missing`);
      }
      columns[pkAttr].notNull = true;
      continue;
    }
    subset(`table constraint ${c.type}`);
  }
  if (pkAttr < 0) {
    throw new Error("CREATE TABLE needs a PRIMARY KEY");
  }
  if (columns.length === 0) {
    throw new Error("CREATE TABLE needs at least one column");
  }
  return { kind: "create", name: tableName(stmt.name), columns, pkAttr };
}

function mapInsert(stmt: InsertStatement): ParsedInsert {
  if (stmt.onConflict) {
    subset("ON CONFLICT");
  }
  const insert = stmt.insert;
  if (insert.type !== "values") {
    subset("INSERT ... SELECT");
  }
  const valuesStmt = insert as ValuesStatement;
  if (valuesStmt.values.length === 0) {
    subset("INSERT VALUES");
  }
  const rows = valuesStmt.values.map((row) => row.map(exprValue));
  const columns = stmt.columns
    ? stmt.columns.map((c: Name) => ident(c.name))
    : null;
  return {
    kind: "insert",
    table: tableName(stmt.into),
    columns,
    values: rows[0],
    rows,
  };
}

function intLit(expr: Expr | undefined | null, label: string): number {
  if (!expr) {
    subset(label);
  }
  if (expr.type === "integer") {
    return Number(expr.value);
  }
  if (expr.type === "numeric" && Number.isInteger(expr.value)) {
    return Number(expr.value);
  }
  subset(`${label} must be an integer`);
}

function mapSelect(stmt: SelectFromStatement): ParsedSelect {
  if (stmt.groupBy?.length || stmt.having || stmt.distinct || stmt.for || stmt.skip) {
    subset("SELECT clause");
  }
  const table = singleTable(stmt.from);
  const cols = stmt.columns ?? [];
  let columns: string[] | "*" = "*";
  if (cols.length === 1 && cols[0].expr.type === "ref" && cols[0].expr.name === "*") {
    columns = "*";
  } else {
    columns = cols.map((c) => {
      if (c.expr.type !== "ref" || c.expr.name === "*") {
        subset("SELECT expression");
      }
      return ident(c.expr.name);
    });
  }
  let limit: number | null = null;
  let offset = 0;
  if (stmt.limit) {
    const lim = stmt.limit;
    if ("limit" in lim || "offset" in lim) {
      if (lim.limit) {
        limit = intLit(lim.limit as Expr, "LIMIT");
      }
      if (lim.offset) {
        offset = intLit(lim.offset as Expr, "OFFSET");
      }
    }
  }
  const orderBy: { col: string; dir: "asc" | "desc" }[] = [];
  for (const ob of stmt.orderBy ?? []) {
    const by = ob.by;
    if (by.type !== "ref" || by.name === "*") {
      subset("ORDER BY expression");
    }
    const dir = (ob.order ?? "ASC").toLowerCase() === "desc" ? "desc" : "asc";
    orderBy.push({ col: ident(by.name), dir });
  }
  return {
    kind: "select",
    table,
    columns,
    where: eqFilter(stmt.where ?? null),
    limit,
    offset,
    orderBy,
  };
}

function mapUpdate(stmt: UpdateStatement): ParsedUpdate {
  if (stmt.from) {
    subset("UPDATE FROM");
  }
  return {
    kind: "update",
    table: tableName(stmt.table),
    set: stmt.sets.map((s) => ({
      col: ident(s.column.name),
      value: exprValue(s.value),
    })),
    where: requireEqFilter(stmt.where ?? null),
  };
}

function mapDelete(stmt: DeleteStatement): ParsedDelete {
  return {
    kind: "delete",
    table: tableName(stmt.from),
    where: requireEqFilter(stmt.where ?? null),
  };
}

function mapDrop(stmt: DropStatement): ParsedDrop {
  if (stmt.type !== "drop table") {
    subset(stmt.type);
  }
  if (stmt.names.length !== 1) {
    subset("DROP TABLE list");
  }
  return { kind: "drop", name: tableName(stmt.names[0]) };
}

function mapCreateIndex(stmt: CreateIndexStatement): ParsedCreateIndex {
  if (stmt.unique || stmt.where || stmt.using || stmt.concurrently) {
    subset("CREATE INDEX option");
  }
  if (stmt.expressions.length !== 1) {
    subset("multi-column index");
  }
  const expr = stmt.expressions[0].expression;
  if (expr.type !== "ref" || expr.name === "*") {
    subset("index expression");
  }
  return {
    kind: "createIndex",
    table: tableName(stmt.table),
    column: ident(expr.name),
  };
}

function mapStatement(stmt: Statement): ParsedSql {
  switch (stmt.type) {
    case "create table":
      return mapCreate(stmt);
    case "insert":
      return mapInsert(stmt);
    case "select":
      return mapSelect(stmt);
    case "update":
      return mapUpdate(stmt);
    case "delete":
      return mapDelete(stmt);
    case "drop table":
      return mapDrop(stmt);
    case "create index":
      return mapCreateIndex(stmt);
    case "union":
    case "union all":
    case "begin":
    case "start transaction":
    case "commit":
    case "rollback":
      subset(stmt.type);
    default:
      subset(stmt.type);
  }
}

export function parseSql(sql: string, params?: SqlParam[]): ParsedSql {
  const bound = params && params.length > 0 ? bindSql(sql, params) : sql;
  const text = bound.trim();
  if (!text) {
    subset();
  }
  let stmt: Statement;
  try {
    stmt = parseFirst(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/^syntax error/i.test(msg) || /unexpected/i.test(msg)) {
      subset();
    }
    throw err;
  }
  return mapStatement(stmt);
}

export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inStr = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (inLine) {
      if (ch === "\n") {
        inLine = false;
      }
      continue;
    }
    if (inBlock) {
      if (ch === "*" && next === "/") {
        i += 1;
        inBlock = false;
      }
      continue;
    }
    if (inStr) {
      cur += ch;
      if (ch === "'" && next === "'") {
        cur += sql[++i];
      } else if (ch === "'") {
        inStr = false;
      }
      continue;
    }
    if (ch === "-" && next === "-") {
      inLine = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlock = true;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inStr = true;
      cur += ch;
      continue;
    }
    if (ch === ";") {
      const t = cur.trim();
      if (t) {
        out.push(t);
      }
      cur = "";
      continue;
    }
    cur += ch;
  }
  const t = cur.trim();
  if (t) {
    out.push(t);
  }
  return out;
}
