import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { expect } from "chai";
import { Slab } from "../target/types/slab";
import { MemoryPageStore, SlabDb, decodeCatalog, parseSql } from "../sdk/src";
import { nsFrom } from "./helpers";

if (process.env.RUN_ER_TESTS === "1" || process.env.RUN_CRANK_TESTS === "1") {
  describe.skip("slab client", () => {
    it("skipped when RUN_ER_TESTS=1", () => {});
  });
} else {
  describe("slab client", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.slab as Program<Slab>;
    const ns = nsFrom(`sql-${Date.now().toString(36)}`);
    const store = new MemoryPageStore();
    const db = new SlabDb({
      program,
      wallet: provider.wallet.publicKey,
      ns,
      store,
    });

    it("parses v0 SQL and rejects JOIN", () => {
      const create = parseSql(
        "CREATE TABLE notes (id int8 PRIMARY KEY, author text NOT NULL, body text)"
      );
      expect(create.kind).to.equal("create");
      const upd = parseSql("UPDATE notes SET body = 'x' WHERE id = 1");
      expect(upd.kind).to.equal("update");
      const del = parseSql("DELETE FROM notes WHERE id = 1");
      expect(del.kind).to.equal("delete");
      const drop = parseSql("DROP TABLE notes");
      expect(drop.kind).to.equal("drop");
      const idx = parseSql("CREATE INDEX ON notes (author)");
      expect(idx.kind).to.equal("createIndex");
      const ins = parseSql(
        "INSERT INTO users (username, email, createdat) VALUES ('priyansh_ptl18', 'priyansh@thaler.finance', '2026-09-09T08:12:00Z')"
      );
      expect(ins.kind).to.equal("insert");
      if (ins.kind === "insert") {
        expect(ins.values[2]).to.equal("2026-09-09T08:12:00Z");
        expect(ins.rows).to.have.length(1);
      }
      const multi = parseSql(
        "INSERT INTO notes (id, author, body) VALUES (1, 'ada', 'a'), (2, 'bob', 'b')"
      );
      expect(multi.kind).to.equal("insert");
      if (multi.kind === "insert") {
        expect(multi.rows).to.have.length(2);
      }
      const varchar = parseSql(
        "CREATE TABLE users (id integer PRIMARY KEY, name varchar(64) NOT NULL)"
      );
      expect(varchar.kind).to.equal("create");
      if (varchar.kind === "create") {
        expect(varchar.columns[1].typ).to.equal("text");
      }
      expect(() => parseSql("SELECT * FROM a JOIN b ON a.id = b.id")).to.throw(
        /v0 SQL subset/
      );
      expect(() => parseSql("BEGIN")).to.throw(/v0 SQL subset/);
      expect(() => parseSql("COPY t FROM STDIN")).to.throw(/v0 SQL subset/);
    });

    it("CREATE TABLE + INSERT row + SELECT returns the row", async () => {
      await db.exec(
        "CREATE TABLE notes (id int8 PRIMARY KEY, author text NOT NULL, body text NOT NULL)"
      );
      await db.exec(
        "INSERT INTO notes (id, author, body) VALUES (1, 'ada', 'first note')"
      );
      const rows = await db.exec("SELECT * FROM notes WHERE id = 1");
      expect(rows).to.have.length(1);
      expect(rows[0].author).to.equal("ada");
      expect(rows[0].body).to.equal("first note");
      expect(BigInt(rows[0].id as bigint | number)).to.equal(1n);
    });

    it("appends a second row on the same page", async () => {
      await db.exec(
        "INSERT INTO notes (id, author, body) VALUES (2, 'bob', 'second note')"
      );
      const rows = await db.exec("SELECT * FROM notes");
      expect(rows).to.have.length(2);
      const bob = await db.exec("SELECT * FROM notes WHERE author = 'bob'");
      expect(bob).to.have.length(1);
      expect(bob[0].body).to.equal("second note");
    });

    it("CREATE TABLE a second relation", async () => {
      await db.exec(
        "CREATE TABLE flags (ok bool PRIMARY KEY, n int4 NOT NULL, ts timestamptz NOT NULL)"
      );
      await db.exec("INSERT INTO flags (ok, n, ts) VALUES (true, 7, 1700000000)");
      const rows = await db.exec("SELECT * FROM flags WHERE ok = true");
      expect(rows).to.have.length(1);
      expect(rows[0].ok).to.equal(true);
      expect(rows[0].n).to.equal(7);
    });

    it("SELECT missing PK returns no rows", async () => {
      const rows = await db.exec("SELECT * FROM notes WHERE id = 99");
      expect(rows).to.have.length(0);
    });

    it("spills a full page to page 1", async () => {
      await db.exec(
        "CREATE TABLE chunks (id int8 PRIMARY KEY, body text NOT NULL)"
      );
      const body = "x".repeat(1024);
      for (let i = 1; i <= 8; i++) {
        await db.exec(
          `INSERT INTO chunks (id, body) VALUES (${i}, '${body}')`
        );
      }
      const catalog = await program.account.catalog.fetch(db.catalogPda);
      let nPages = -1;
      for (let i = 0; i < Number(catalog.nRels); i++) {
        const name = Buffer.from(Array.from(catalog.rels[i].name as number[]))
          .toString("utf8")
          .replace(/\0+$/, "");
        if (name === "chunks") {
          nPages = Number(catalog.rels[i].nPages);
        }
      }
      expect(nPages).to.equal(2);
      const row = await db.exec("SELECT * FROM chunks WHERE id = 8");
      expect(row).to.have.length(1);
      expect(row[0].body).to.equal(body);
    });

    it("UPDATE SET then SELECT", async () => {
      await db.exec("UPDATE notes SET body = 'edited note' WHERE id = 1");
      const rows = await db.exec("SELECT * FROM notes WHERE id = 1");
      expect(rows).to.have.length(1);
      expect(rows[0].body).to.equal("edited note");
      expect(rows[0].author).to.equal("ada");
    });

    it("DELETE then missing PK returns no rows", async () => {
      await db.exec("DELETE FROM notes WHERE id = 2");
      const gone = await db.exec("SELECT * FROM notes WHERE id = 2");
      expect(gone).to.have.length(0);
      const still = await db.exec("SELECT * FROM notes WHERE id = 1");
      expect(still).to.have.length(1);
    });

    it("CREATE INDEX then WHERE uses the secondary index", async () => {
      await db.exec(
        "CREATE TABLE tags (id int8 PRIMARY KEY, author text NOT NULL)"
      );
      await db.exec("CREATE INDEX ON tags (author)");
      await db.exec("INSERT INTO tags (id, author) VALUES (1, 'ada')");
      await db.exec("INSERT INTO tags (id, author) VALUES (2, 'cam')");
      const rows = await db.exec("SELECT * FROM tags WHERE author = 'ada'");
      expect(rows).to.have.length(1);
      expect(BigInt(rows[0].id as bigint | number)).to.equal(1n);
    });

    it("DROP TABLE does not reuse oids", async () => {
      const beforeInfo = await program.provider.connection.getAccountInfo(
        db.catalogPda
      );
      if (!beforeInfo) {
        throw new Error("catalog missing");
      }
      const before = decodeCatalog(Buffer.from(beforeInfo.data));
      const flags = before.rels.find((r) => r.name === "flags");
      if (!flags) {
        throw new Error("flags table missing");
      }
      const droppedOid = flags.oid;
      await db.exec("DROP TABLE flags");
      const midInfo = await program.provider.connection.getAccountInfo(
        db.catalogPda
      );
      if (!midInfo) {
        throw new Error("catalog missing after DROP");
      }
      const mid = decodeCatalog(Buffer.from(midInfo.data));
      expect(mid.nextOid).to.equal(before.nextOid);
      expect(mid.rels.find((r) => r.name === "flags")).to.equal(undefined);
      await db.exec(
        "CREATE TABLE flags (ok bool PRIMARY KEY, n int4 NOT NULL, ts timestamptz NOT NULL)"
      );
      const afterInfo = await program.provider.connection.getAccountInfo(
        db.catalogPda
      );
      if (!afterInfo) {
        throw new Error("catalog missing after CREATE");
      }
      const after = decodeCatalog(Buffer.from(afterInfo.data));
      const created = after.rels.find((r) => r.name === "flags");
      if (!created) {
        throw new Error("flags was not created");
      }
      expect(created.oid).to.equal(before.nextOid);
      expect(created.oid).to.not.equal(droppedOid);
    });

    it("realloc_catalog grows capacity to 32", async () => {
      await db.reallocCatalog();
      const info = await program.provider.connection.getAccountInfo(
        db.catalogPda
      );
      if (!info) {
        throw new Error("catalog missing after realloc");
      }
      const catalog = decodeCatalog(Buffer.from(info.data));
      expect(catalog.capacity).to.equal(32);
      await db.exec(
        "CREATE TABLE extra (id int8 PRIMARY KEY, note text NOT NULL)"
      );
      const afterInfo = await program.provider.connection.getAccountInfo(
        db.catalogPda
      );
      if (!afterInfo) {
        throw new Error("catalog missing after extra CREATE");
      }
      const after = decodeCatalog(Buffer.from(afterInfo.data));
      expect(after.rels.find((r) => r.name === "extra")).to.not.equal(undefined);
    });
  });
}
