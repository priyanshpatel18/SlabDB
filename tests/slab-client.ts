import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { expect } from "chai";
import { Slab } from "../target/types/slab";
import { MemoryPageStore, SlabDb, parseSql } from "../client";
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
      expect(() => parseSql("SELECT * FROM a JOIN b ON a.id = b.id")).to.throw(
        /v0 SQL subset/
      );
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
  });
}
