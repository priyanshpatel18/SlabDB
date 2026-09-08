import { parseSql, splitStatements } from "./sql";
import type { Column, Row, SqlValue } from "./sql-types";

export type Rel = {
  oid: number;
  name: string;
  pkAttr: number;
  columns: Column[];
  rows: Row[];
};

export type ExecResult = {
  rows: Row[];
  message: string;
};

function valuesEqual(a: SqlValue, b: SqlValue): boolean {
  if (typeof a === "bigint" || typeof b === "bigint") {
    return BigInt(a as bigint | number) === BigInt(b as bigint | number);
  }
  return a === b;
}

export class MemoryCatalog {
  nextOid = 1;
  rels: Rel[] = [];

  execMany(sql: string): ExecResult {
    const stmts = splitStatements(sql);
    if (stmts.length === 0) {
      throw new Error("SQL is empty");
    }
    let last: ExecResult = { rows: [], message: "ok" };
    for (const stmt of stmts) {
      last = this.exec(stmt);
    }
    return last;
  }

  exec(sql: string): ExecResult {
    const ast = parseSql(sql);
    if (ast.kind === "create") {
      if (this.rels.some((r) => r.name === ast.name)) {
        throw new Error(`relation ${ast.name} already exists`);
      }
      this.rels.push({
        oid: this.nextOid++,
        name: ast.name,
        pkAttr: ast.pkAttr,
        columns: ast.columns,
        rows: [],
      });
      return { rows: [], message: `CREATE TABLE ${ast.name} (oid ${this.nextOid - 1})` };
    }
    if (ast.kind === "drop") {
      const i = this.rels.findIndex((r) => r.name === ast.name);
      if (i < 0) {
        throw new Error(`relation ${ast.name} does not exist`);
      }
      this.rels.splice(i, 1);
      return { rows: [], message: `DROP TABLE ${ast.name}` };
    }
    if (ast.kind === "createIndex") {
      const rel = this.must(ast.table);
      return { rows: [], message: `INDEX on ${rel.name}(${ast.column}) (local preview)` };
    }
    if (ast.kind === "insert") {
      const rel = this.must(ast.table);
      const names = ast.columns ?? rel.columns.map((c) => c.name);
      const row: Row = {};
      names.forEach((n, i) => {
        row[n] = ast.values[i];
      });
      rel.rows.push(row);
      return { rows: [], message: `INSERT 1 into ${rel.name}` };
    }
    if (ast.kind === "update") {
      const rel = this.must(ast.table);
      let n = 0;
      for (const row of rel.rows) {
        if (valuesEqual(row[ast.where.col], ast.where.value)) {
          for (const s of ast.set) {
            row[s.col] = s.value;
          }
          n += 1;
        }
      }
      return { rows: [], message: `UPDATE ${n}` };
    }
    if (ast.kind === "delete") {
      const rel = this.must(ast.table);
      const before = rel.rows.length;
      rel.rows = rel.rows.filter(
        (row) => !valuesEqual(row[ast.where.col], ast.where.value)
      );
      return { rows: [], message: `DELETE ${before - rel.rows.length}` };
    }
    const rel = this.must(ast.table);
    let rows = rel.rows;
    if (ast.where) {
      rows = rows.filter((row) =>
        valuesEqual(row[ast.where!.col], ast.where!.value)
      );
    }
    if (ast.columns !== "*") {
      rows = rows.map((row) => {
        const out: Row = {};
        for (const col of ast.columns as string[]) {
          out[col] = row[col];
        }
        return out;
      });
    }
    return { rows, message: `${rows.length} row${rows.length === 1 ? "" : "s"}` };
  }

  private must(name: string): Rel {
    const rel = this.rels.find((r) => r.name === name);
    if (!rel) {
      throw new Error(`relation ${name} does not exist`);
    }
    return rel;
  }
}
