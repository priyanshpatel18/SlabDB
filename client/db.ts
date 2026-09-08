import { Program } from "@anchor-lang/core";
import { DELEGATION_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import { PublicKey } from "@solana/web3.js";
import type { Slab } from "../target/types/slab";
import { decodeIrysTxid } from "./ids";
import {
  appendTuple,
  colTypeFromU8,
  colTypeToAnchor,
  encodePk,
  encodeTuple,
  packPage,
  sha256,
  tupleFitsWithColumns,
  unpackPage,
} from "./page";
import { parseSql } from "./sql";
import type { PageStore } from "./store";
import type { Column, Row, SqlValue } from "./types";

export type Remaining = {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;
};

export type SlabDbOpts = {
  program: Program<Slab>;
  programEr?: Program<Slab>;
  wallet: PublicKey;
  ns: number[];
  store: PageStore;
  remainingAccounts?: Remaining[];
};

type RelInfo = {
  oid: number;
  name: string;
  pkAttr: number;
  nPages: number;
  nTuples: number;
  columns: Column[];
};

function u32le(n: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n);
  return buf;
}

function cstr(bytes: number[] | Uint8Array): string {
  return Buffer.from(Array.from(bytes)).toString("utf8").replace(/\0+$/, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function valuesEqual(a: SqlValue, b: SqlValue): boolean {
  if (typeof a === "bigint" || typeof b === "bigint") {
    return BigInt(a as bigint | number) === BigInt(b as bigint | number);
  }
  return a === b;
}

export class SlabDb {
  readonly program: Program<Slab>;
  readonly programEr?: Program<Slab>;
  readonly wallet: PublicKey;
  readonly ns: number[];
  readonly store: PageStore;
  readonly remainingAccounts: Remaining[];
  readonly slabPda: PublicKey;
  readonly catalogPda: PublicKey;
  readonly feeVaultPda: PublicKey;

  constructor(opts: SlabDbOpts) {
    this.program = opts.program;
    this.programEr = opts.programEr;
    this.wallet = opts.wallet;
    this.ns = opts.ns;
    this.store = opts.store;
    this.remainingAccounts = opts.remainingAccounts ?? [];
    [this.slabPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("slab"), this.wallet.toBuffer(), Buffer.from(this.ns)],
      this.program.programId
    );
    [this.catalogPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("cat"), this.slabPda.toBuffer()],
      this.program.programId
    );
    [this.feeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fee"), this.wallet.toBuffer(), Buffer.from(this.ns)],
      this.program.programId
    );
  }

  indexPda(relOid: number, pkAttr: number): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("idx"),
        this.slabPda.toBuffer(),
        u32le(relOid),
        Buffer.from([pkAttr]),
      ],
      this.program.programId
    )[0];
  }

  pagePda(relOid: number, pageNo: number): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("page"),
        this.slabPda.toBuffer(),
        u32le(relOid),
        u32le(pageNo),
      ],
      this.program.programId
    )[0];
  }

  async isDelegated(): Promise<boolean> {
    const info = await this.program.provider.connection.getAccountInfo(
      this.slabPda
    );
    return !!info && info.owner.equals(DELEGATION_PROGRAM_ID);
  }

  private async reader(): Promise<Program<Slab>> {
    if (this.programEr && (await this.isDelegated())) {
      return this.programEr;
    }
    return this.program;
  }

  private async rpcOpts(): Promise<{ skipPreflight: true } | Record<string, never>> {
    return (await this.isDelegated()) ? { skipPreflight: true } : {};
  }

  async exec(sql: string): Promise<Row[]> {
    const ast = parseSql(sql);
    if (ast.kind === "create") {
      await this.createTable(ast.name, ast.columns, ast.pkAttr);
      return [];
    }
    if (ast.kind === "insert") {
      await this.insert(ast.table, ast.columns, ast.values);
      return [];
    }
    return this.select(ast.table, ast.columns, ast.where);
  }

  async initialize(): Promise<void> {
    const info = await this.program.provider.connection.getAccountInfo(
      this.slabPda
    );
    if (info) {
      return;
    }
    await this.program.methods
      .initialize(this.ns)
      .accounts({
        authority: this.wallet,
        slab: this.slabPda,
        catalog: this.catalogPda,
        feeVault: this.feeVaultPda,
      })
      .rpc();
  }

  private async loadRels(): Promise<RelInfo[]> {
    const catalog = await (await this.reader()).account.catalog.fetch(this.catalogPda);
    const n = Number(catalog.nRels);
    const rels: RelInfo[] = [];
    for (let i = 0; i < n; i++) {
      const rel = catalog.rels[i];
      const nAttrs = Number(rel.nAttrs);
      const columns: Column[] = [];
      for (let a = 0; a < nAttrs; a++) {
        columns.push({
          name: cstr(rel.attrs[a].name),
          typ: colTypeFromU8(Number(rel.attrs[a].typ)),
          notNull: Number(rel.attrs[a].notNull) !== 0,
        });
      }
      rels.push({
        oid: Number(rel.oid),
        name: cstr(rel.name),
        pkAttr: Number(rel.pkAttr),
        nPages: Number(rel.nPages),
        nTuples: Number(rel.nTuples),
        columns,
      });
    }
    return rels;
  }

  private async relByName(name: string): Promise<RelInfo> {
    const rels = await this.loadRels();
    const rel = rels.find((r) => r.name === name);
    if (!rel) {
      throw new Error(`relation ${name} does not exist`);
    }
    return rel;
  }

  private async prepareIndex(relOid: number, pkAttr: number): Promise<void> {
    const index = this.indexPda(relOid, pkAttr);
    const info = await this.program.provider.connection.getAccountInfo(index);
    if (info) {
      return;
    }
    await this.program.methods
      .prepareIndex(relOid, pkAttr)
      .accounts({
        authority: this.wallet,
        slab: this.slabPda,
        feeVault: this.feeVaultPda,
        index,
      })
      .rpc();
  }

  private async preparePage(relOid: number, pageNo: number): Promise<void> {
    const pagePtr = this.pagePda(relOid, pageNo);
    const info = await this.program.provider.connection.getAccountInfo(pagePtr);
    if (info) {
      return;
    }
    await this.program.methods
      .preparePage(relOid, pageNo)
      .accounts({
        authority: this.wallet,
        slab: this.slabPda,
        feeVault: this.feeVaultPda,
        pagePtr,
      })
      .rpc();
  }

  private async maybeDelegateIndex(relOid: number, pkAttr: number): Promise<void> {
    if (!(await this.isDelegated())) {
      return;
    }
    const index = this.indexPda(relOid, pkAttr);
    const info = await this.program.provider.connection.getAccountInfo(index);
    if (info && info.owner.equals(DELEGATION_PROGRAM_ID)) {
      return;
    }
    await this.program.methods
      .delegateIndex(relOid, pkAttr)
      .accounts({
        payer: this.wallet,
        slab: this.slabPda,
        index,
      })
      .remainingAccounts(this.remainingAccounts)
      .rpc();
    await sleep(3000);
  }

  private async maybeDelegatePage(relOid: number, pageNo: number): Promise<void> {
    if (!(await this.isDelegated())) {
      return;
    }
    const pagePtr = this.pagePda(relOid, pageNo);
    const info = await this.program.provider.connection.getAccountInfo(pagePtr);
    if (info && info.owner.equals(DELEGATION_PROGRAM_ID)) {
      return;
    }
    await this.program.methods
      .delegatePage(relOid, pageNo)
      .accounts({
        payer: this.wallet,
        slab: this.slabPda,
        pagePtr,
      })
      .remainingAccounts(this.remainingAccounts)
      .rpc();
    await sleep(3000);
  }

  async createTable(
    name: string,
    columns: Column[],
    pkAttr: number
  ): Promise<void> {
    await this.initialize();
    const existing = (await this.loadRels()).find((r) => r.name === name);
    if (existing) {
      throw new Error(`relation ${name} already exists`);
    }
    const relOid = (await this.loadRels()).length + 1;
    await this.prepareIndex(relOid, pkAttr);
    await this.preparePage(relOid, 0);
    await this.maybeDelegateIndex(relOid, pkAttr);
    await this.maybeDelegatePage(relOid, 0);
    const stmt = {
      createTable: {
        name,
        columns: columns.map((c) => ({
          name: c.name,
          typ: colTypeToAnchor(c.typ),
          notNull: c.notNull || c === columns[pkAttr],
        })),
        pkAttr,
      },
    };
    const reader = await this.reader();
    await reader.methods
      .execSql(relOid, pkAttr, stmt)
      .accounts({
        authority: this.wallet,
        slab: this.slabPda,
        catalog: this.catalogPda,
        index: this.indexPda(relOid, pkAttr),
      })
      .rpc(await this.rpcOpts());
  }

  async insert(
    table: string,
    columnNames: string[] | null,
    values: SqlValue[]
  ): Promise<void> {
    const rel = await this.relByName(table);
    const names = columnNames ?? rel.columns.map((c) => c.name);
    if (names.length !== values.length) {
      throw new Error("INSERT column count does not match VALUES");
    }
    const row: Row = {};
    for (let i = 0; i < names.length; i++) {
      row[names[i]] = values[i];
    }
    for (const col of rel.columns) {
      if (row[col.name] === undefined) {
        throw new Error(`INSERT missing column ${col.name}`);
      }
    }
    const pkCol = rel.columns[rel.pkAttr];
    const pk = encodePk(row[pkCol.name], pkCol.typ);
    const tuple = encodeTuple(rel.columns, row);
    const reader = await this.reader();

    let pageNo = rel.nPages === 0 ? 0 : rel.nPages - 1;
    let pageBuf: Buffer | null = null;
    if (rel.nPages > 0) {
      const ptr = await reader.account.pagePtr.fetch(
        this.pagePda(rel.oid, pageNo)
      );
      const id = decodeIrysTxid(ptr.txid);
      pageBuf = await this.store.get(id);
      const hash = sha256(pageBuf);
      if (Buffer.from(hash).compare(Buffer.from(ptr.hash)) !== 0) {
        throw new Error("page hash does not match PagePtr");
      }
      if (!tupleFitsWithColumns(pageBuf, rel.columns, tuple)) {
        pageNo = rel.nPages;
        pageBuf = null;
      }
    }

    await this.preparePage(rel.oid, pageNo);
    await this.maybeDelegatePage(rel.oid, pageNo);
    const writer = await this.reader();

    const packed =
      pageBuf === null
        ? packPage(rel.oid, pageNo, [tuple])
        : appendTuple(pageBuf, rel.columns, tuple);
    const uploaded = await this.store.put(packed);
    const slot =
      pageBuf === null ? 0 : unpackPage(pageBuf, rel.columns).length;

    await writer.methods
      .execInsert(rel.oid, pageNo, rel.pkAttr, rel.name, uploaded.txid, uploaded.hash, [
        { key: pk.key, keyLen: pk.keyLen, slot },
      ])
      .accounts({
        authority: this.wallet,
        slab: this.slabPda,
        catalog: this.catalogPda,
        pagePtr: this.pagePda(rel.oid, pageNo),
        index: this.indexPda(rel.oid, rel.pkAttr),
      })
      .rpc(await this.rpcOpts());
  }

  async select(
    table: string,
    columns: string[] | "*",
    where: { col: string; value: SqlValue } | null
  ): Promise<Row[]> {
    const rel = await this.relByName(table);
    const pkCol = rel.columns[rel.pkAttr];
    const reader = await this.reader();
    let rows: Row[] = [];

    if (where && where.col === pkCol.name) {
      const pk = encodePk(where.value, pkCol.typ);
      const idx = await reader.account.index.fetch(
        this.indexPda(rel.oid, rel.pkAttr)
      );
      let hit: { pageNo: number; slot: number } | null = null;
      for (let i = 0; i < Number(idx.nKeys); i++) {
        const e = idx.keys[i];
        const keyLen = Number(e.keyLen);
        const key = Array.from(e.key as number[]).slice(0, keyLen);
        if (
          keyLen === pk.keyLen &&
          key.every((b, j) => b === pk.key[j])
        ) {
          hit = { pageNo: Number(e.pageNo), slot: Number(e.slot) };
          break;
        }
      }
      if (!hit) {
        return [];
      }
      await reader.methods
        .execSelect(rel.oid, rel.pkAttr, pk.key, pk.keyLen)
        .accounts({
          authority: this.wallet,
          slab: this.slabPda,
          catalog: this.catalogPda,
          index: this.indexPda(rel.oid, rel.pkAttr),
          pagePtr: this.pagePda(rel.oid, hit.pageNo),
        })
        .rpc(await this.rpcOpts());
      const ptr = await reader.account.pagePtr.fetch(
        this.pagePda(rel.oid, hit.pageNo)
      );
      const page = await this.store.get(decodeIrysTxid(ptr.txid));
      if (Buffer.from(sha256(page)).compare(Buffer.from(ptr.hash)) !== 0) {
        throw new Error("page hash does not match PagePtr");
      }
      const decoded = unpackPage(page, rel.columns);
      rows = [decoded[hit.slot]];
    } else {
      for (let pageNo = 0; pageNo < rel.nPages; pageNo++) {
        const ptr = await reader.account.pagePtr.fetch(
          this.pagePda(rel.oid, pageNo)
        );
        const page = await this.store.get(decodeIrysTxid(ptr.txid));
        if (Buffer.from(sha256(page)).compare(Buffer.from(ptr.hash)) !== 0) {
          throw new Error("page hash does not match PagePtr");
        }
        rows.push(...unpackPage(page, rel.columns));
      }
      if (where) {
        rows = rows.filter((row) => valuesEqual(row[where.col], where.value));
      }
    }

    if (columns === "*") {
      return rows;
    }
    return rows.map((row) => {
      const out: Row = {};
      for (const col of columns) {
        out[col] = row[col];
      }
      return out;
    });
  }
}
