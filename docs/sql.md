# SQL

v0 SQL is a small Postgres subset. The program never sees SQL text. The SDK parses it, packs pages, and calls the program.

## Statements

`CREATE TABLE`, `INSERT`, `SELECT`, `UPDATE`, `DELETE`, `DROP TABLE`, `CREATE INDEX`.

A PRIMARY KEY is required. No JOIN, BEGIN, or COPY.

## Types

- bool
- int4
- int8
- text (max 1 KiB)
- timestamptz

## Indexes

PK `WHERE` uses the on-chain index. `CREATE INDEX` then `WHERE col =` uses a secondary Index PDA. Other `WHERE` clauses scan pages in the store. `CREATE INDEX` does not backfill old rows.

## Pages

Each page is 8,192 bytes. INSERT uploads the page to Irys and writes the receipt id on-chain. A full page calls `prepare_page` for the next page. `UPDATE` and `DELETE` rewrite the page, then update the pointer and index. `DROP TABLE` frees the catalog slot. Oids are not reused.

## Routing

- initialize, prepare, delegate: base
- INSERT, UPDATE, DELETE, SELECT after delegate: public ER
