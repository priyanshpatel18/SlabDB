# SQL

v0 SQL is a small Postgres subset. The program never sees SQL text. The SDK parses it, packs pages, and calls the program.

## Statements

`CREATE TABLE`, `INSERT`, `SELECT`, `UPDATE`, `DELETE`, `DROP TABLE`, `CREATE INDEX`, `GRANT`, `REVOKE`.

A PRIMARY KEY is required. No JOIN, BEGIN, or COPY.

`SELECT` supports `WHERE col =`, `ORDER BY col`, `LIMIT n`, and `OFFSET n`. `SELECT` without `WHERE` scans live rows.

## Parameters

```sql
INSERT INTO notes (id, author, body) VALUES ($1, $2, $3)
```

Pass values as the second argument to `db.exec(sql, [id, name, body])`. Quote characters in names do not break the statement.

## Types

- bool
- int4
- int8
- text (max 4 KiB)
- timestamptz
- uuid
- float8
- json
- bytea

## Indexes

PK `WHERE` uses the on-chain index. `CREATE INDEX` then `WHERE col =` uses a secondary Index PDA. `CREATE INDEX` backfills existing rows. Other `WHERE` clauses scan pages in the store.

## Pages

Each page is 8,192 bytes. INSERT uploads the page to Irys and writes the receipt id on-chain. The SDK returns after the ER transaction. Gateway confirm runs in the background. A full page calls `prepare_page` for the next page. `UPDATE` and `DELETE` rewrite the page, then update the pointer and index. `DROP TABLE` frees the catalog slot. Oids are not reused.

Old SHA-256 page pointers cannot be fetched. The SDK throws `UnreadablePageError`. Call `db.resetTable(name)` or run `DROP TABLE`, then `CREATE` and `INSERT` again.

## Routing

- initialize, prepare, delegate, CREATE TABLE, GRANT, REVOKE: base
- INSERT, UPDATE, DELETE, SELECT after delegate: public ER

`Slab.connect({ wallet, ns })` does this routing for you.

## Shared catalog

Isolation is `[slab, owner, ns]`. The owner can run `GRANT <pubkey>` so many users share one schema. `REVOKE <pubkey>` removes that writer. `CREATE TABLE` and `DROP TABLE` stay with the owner. `SELECT` does not need a grant. Pages on Irys are public. See [Privacy](privacy.md).

GRANT creates a Grant PDA on base, paid by the slab fee vault. Do not `init` that account on the ER. `INSERT` on the ER reads the Grant PDA as a remaining account. `REVOKE` closes the PDA on base.
