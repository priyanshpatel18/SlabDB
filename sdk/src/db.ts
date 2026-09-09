// @ts-nocheck
import { Program } from "@anchor-lang/core";
import {
  DELEGATION_PROGRAM_ID,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import type { Slab } from "./idl";
import { decodeCatalog, type RelInfo } from "./catalog";
import { decodeIrysTxid } from "./ids";
import {
  appendTuple,
  colTypeToAnchor,
  encodePk,
  encodeTuple,
  packPage,
  rewriteSlot,
  sha256,
  timestamptzMillis,
  tombstoneSlot,
  tupleFitsWithColumns,
  unpackPhysical,
  unpackSlot,
  withLiveFlag,
} from "./page";
import { writeU32LE } from "./bytes";
import { createTableSql, dropTableSql, isLegacyLocalPageId, UnreadablePageError } from "./recovery";
import { parseSql } from "./sql";
import { formatProgramError } from "./tx-error";
import type { PageStore } from "./store";
import type { Column, Row, SqlParam, SqlValue } from "./types";

export type Remaining = {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;
};

export type SlabDbOpts = {
  program: Program<Slab>;
  programEr?: Program<Slab>;
  wallet: PublicKey;
  /** Catalog owner used in PDA seeds. Default is `wallet`. */
  owner?: PublicKey;
  ns: number[];
  store: PageStore;
  remainingAccounts?: Remaining[];
  autoDelegate?: boolean;
};

function u32le(n: number): Buffer {
  const buf = Buffer.alloc(4);
  writeU32LE(buf, n, 0);
  return buf;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DELEGATE_CU = 400_000;
const delegateCuIx = () =>
  ComputeBudgetProgram.setComputeUnitLimit({ units: DELEGATE_CU });

async function waitOwner(
  connection: { getAccountInfo: (key: PublicKey) => Promise<{ owner: PublicKey } | null> },
  pubkey: PublicKey,
  owner: PublicKey,
  timeoutMs = 1200
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const info = await connection.getAccountInfo(pubkey);
    if (info && info.owner.equals(owner)) {
      return;
    }
    await sleep(40);
  }
}

function valuesEqual(a: SqlValue, b: SqlValue): boolean {
  if (a instanceof Uint8Array || b instanceof Uint8Array) {
    const aa = a instanceof Uint8Array ? a : null;
    const bb = b instanceof Uint8Array ? b : null;
    if (!aa || !bb || aa.length !== bb.length) {
      return false;
    }
    return Buffer.from(aa).equals(Buffer.from(bb));
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  try {
    return timestamptzMillis(a) === timestamptzMillis(b);
  } catch {
    if (typeof a === "bigint" || typeof b === "bigint") {
      return BigInt(a as bigint | number) === BigInt(b as bigint | number);
    }
    return a === b;
  }
}

function compareSql(a: SqlValue, b: SqlValue): number {
  if (a instanceof Uint8Array || b instanceof Uint8Array) {
    const aa = Buffer.from(a instanceof Uint8Array ? a : []);
    const bb = Buffer.from(b instanceof Uint8Array ? b : []);
    return Buffer.compare(aa, bb);
  }
  if (typeof a === "number" && typeof b === "number") {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  if (typeof a === "bigint" || typeof b === "bigint") {
    const aa = BigInt(a as bigint | number);
    const bb = BigInt(b as bigint | number);
    return aa === bb ? 0 : aa < bb ? -1 : 1;
  }
  try {
    const aa = timestamptzMillis(a);
    const bb = timestamptzMillis(b);
    return aa === bb ? 0 : aa < bb ? -1 : 1;
  } catch {
    const aa = String(typeof a === "object" ? JSON.stringify(a) : a);
    const bb = String(typeof b === "object" ? JSON.stringify(b) : b);
    return aa < bb ? -1 : aa > bb ? 1 : 0;
  }
}

export class SlabDb {
  readonly program: Program<Slab>;
  readonly programEr?: Program<Slab>;
  readonly wallet: PublicKey;
  readonly owner: PublicKey;
  readonly ns: number[];
  readonly store: PageStore;
  readonly remainingAccounts: Remaining[];
  readonly autoDelegate: boolean;
  readonly slabPda: PublicKey;
  readonly catalogPda: PublicKey;
  readonly feeVaultPda: PublicKey;
  private sawDelegated = false;
  private catalogSnap: ReturnType<typeof decodeCatalog> | null = null;

  constructor(opts: SlabDbOpts) {
    this.program = opts.program;
    this.programEr = opts.programEr;
    this.wallet = opts.wallet;
    this.owner = opts.owner ?? opts.wallet;
    this.ns = opts.ns;
    this.store = opts.store;
    this.remainingAccounts = opts.remainingAccounts ?? [];
    this.autoDelegate = opts.autoDelegate === true;
    [this.slabPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("slab"), this.owner.toBuffer(), Buffer.from(this.ns)],
      this.program.programId
    );
    [this.catalogPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("cat"), this.slabPda.toBuffer()],
      this.program.programId
    );
    [this.feeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fee"), this.owner.toBuffer(), Buffer.from(this.ns)],
      this.program.programId
    );
  }

  grantPda(grantee: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("grant"), this.slabPda.toBuffer(), grantee.toBuffer()],
      this.program.programId
    )[0];
  }

  private writerRemaining(): Remaining[] {
    const extra = [...this.remainingAccounts];
    if (!this.wallet.equals(this.owner)) {
      extra.push({
        pubkey: this.grantPda(this.wallet),
        isSigner: false,
        isWritable: false,
      });
    }
    return extra;
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
    if (this.sawDelegated) {
      return true;
    }
    const info = await this.program.provider.connection.getAccountInfo(
      this.slabPda
    );
    const yes = !!info && info.owner.equals(DELEGATION_PROGRAM_ID);
    if (yes) {
      this.sawDelegated = true;
    }
    return yes;
  }

  private async reader(): Promise<Program<Slab>> {
    if (this.programEr && (await this.isDelegated())) {
      return this.programEr;
    }
    return this.program;
  }

  private async rpcOpts(): Promise<
    { skipPreflight: true; commitment: "processed" } | { commitment: "confirmed" }
  > {
    if (await this.isDelegated()) {
      return { skipPreflight: true, commitment: "processed" };
    }
    return { commitment: "confirmed" };
  }

  private invalidateCatalog(): void {
    this.catalogSnap = null;
  }

  private async maybeAutoDelegate(table: string): Promise<void> {
    if (!this.autoDelegate || (await this.isDelegated())) {
      return;
    }
    const rel = await this.relByName(table);
    await this.delegate(rel.oid, 0, rel.pkAttr);
    const start = Date.now();
    while (Date.now() - start < 4000) {
      if (await this.isDelegated()) {
        return;
      }
      await sleep(80);
    }
    throw new Error("Slab is not owned by the delegation program yet");
  }

  private async fetchPage(rel: RelInfo, id: string): Promise<Buffer> {
    try {
      return await this.store.get(id);
    } catch (err) {
      if (err instanceof UnreadablePageError) {
        throw new UnreadablePageError({
          pageId: err.pageId,
          table: rel.name,
          createSql: createTableSql(rel),
          cause: err,
        });
      }
      if (isLegacyLocalPageId(id)) {
        throw new UnreadablePageError({
          pageId: id,
          table: rel.name,
          createSql: createTableSql(rel),
          cause: err,
        });
      }
      throw err;
    }
  }

  async exec(sql: string, params?: SqlParam[]): Promise<Row[]> {
    try {
      return await this.execInner(sql, params);
    } catch (err) {
      if (err instanceof UnreadablePageError) {
        throw err;
      }
      throw new Error(formatProgramError(err));
    }
  }

  private async execInner(sql: string, params?: SqlParam[]): Promise<Row[]> {
    const ast = parseSql(sql, params);
    if (ast.kind === "create") {
      await this.createTable(ast.name, ast.columns, ast.pkAttr);
      await this.maybeAutoDelegate(ast.name);
      return [];
    }
    if (ast.kind === "createIndex") {
      await this.createIndex(ast.table, ast.column);
      return [];
    }
    if (ast.kind === "insert") {
      await this.insert(ast.table, ast.columns, ast.rows ?? [ast.values]);
      return [];
    }
    if (ast.kind === "update") {
      await this.update(ast.table, ast.set, ast.where);
      return [];
    }
    if (ast.kind === "delete") {
      await this.delete(ast.table, ast.where);
      return [];
    }
    if (ast.kind === "drop") {
      await this.dropTable(ast.name);
      return [];
    }
    if (ast.kind === "grant") {
      await this.grant(new PublicKey(ast.grantee));
      return [];
    }
    if (ast.kind === "revoke") {
      await this.revoke(new PublicKey(ast.grantee));
      return [];
    }
    return this.select(ast.table, ast.columns, ast.where, {
      limit: ast.limit,
      offset: ast.offset,
      orderBy: ast.orderBy,
    });
  }

  async exists(): Promise<boolean> {
    const info = await this.program.provider.connection.getAccountInfo(
      this.slabPda
    );
    return !!info;
  }

  async catalog(): Promise<ReturnType<typeof decodeCatalog>> {
    return this.loadCatalog();
  }

  async initialize(): Promise<void> {
    const info = await this.program.provider.connection.getAccountInfo(
      this.slabPda
    );
    if (info) {
      return;
    }
    if (!this.wallet.equals(this.owner)) {
      throw new Error(
        "catalog does not exist. The owner must initialize and CREATE TABLE first."
      );
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

  async grant(grantee: PublicKey): Promise<void> {
    if (!this.wallet.equals(this.owner)) {
      throw new Error("only the catalog owner can GRANT");
    }
    try {
      await this.program.methods
        .grantWriter()
        .accounts({
          authority: this.wallet,
          grantee,
          slab: this.slabPda,
          feeVault: this.feeVaultPda,
          grant: this.grantPda(grantee),
        })
        .rpc();
      if (await this.isDelegated()) {
        await sleep(2000);
      }
    } catch (err) {
      throw new Error(formatProgramError(err));
    }
  }

  async revoke(grantee: PublicKey): Promise<void> {
    if (!this.wallet.equals(this.owner)) {
      throw new Error("only the catalog owner can revoke GRANT");
    }
    try {
      await this.program.methods
        .revokeWriter()
        .accounts({
          authority: this.wallet,
          grantee,
          slab: this.slabPda,
          feeVault: this.feeVaultPda,
          grant: this.grantPda(grantee),
        })
        .rpc();
      if (await this.isDelegated()) {
        await sleep(2000);
      }
    } catch (err) {
      throw new Error(formatProgramError(err));
    }
  }

  async resetTable(name: string): Promise<{ dropSql: string; createSql: string }> {
    const rel = await this.relByName(name);
    const createSql = createTableSql(rel);
    const dropSql = dropTableSql(name);
    await this.dropTable(name);
    const ast = parseSql(createSql);
    if (ast.kind !== "create") {
      throw new Error("failed to rebuild CREATE TABLE");
    }
    await this.createTable(ast.name, ast.columns, ast.pkAttr);
    await this.maybeAutoDelegate(ast.name);
    return { dropSql, createSql };
  }

  private async loadCatalog(): Promise<ReturnType<typeof decodeCatalog>> {
    if (this.catalogSnap) {
      return this.catalogSnap;
    }
    const reader = await this.reader();
    const info = await reader.provider.connection.getAccountInfo(this.catalogPda);
    if (!info) {
      throw new Error("catalog does not exist");
    }
    this.catalogSnap = decodeCatalog(Buffer.from(info.data));
    return this.catalogSnap;
  }

  private async loadRels(): Promise<RelInfo[]> {
    return (await this.loadCatalog()).rels;
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
      .remainingAccounts(this.writerRemaining())
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
      .preInstructions([delegateCuIx()])
      .rpc();
    await waitOwner(this.program.provider.connection, index, DELEGATION_PROGRAM_ID);
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
      .preInstructions([delegateCuIx()])
      .rpc();
    await waitOwner(this.program.provider.connection, pagePtr, DELEGATION_PROGRAM_ID);
  }

  async createTable(
    name: string,
    columns: Column[],
    pkAttr: number
  ): Promise<void> {
    await this.initialize();
    const catalog = await this.loadCatalog();
    const existing = catalog.rels.find((r) => r.name === name);
    if (existing) {
      throw new Error(`relation ${name} already exists`);
    }
    const relOid = catalog.nextOid;
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
    this.invalidateCatalog();
  }

  async insert(
    table: string,
    columnNames: string[] | null,
    rows: SqlValue[][]
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    const rel = await this.relByName(table);
    const names = columnNames ?? rel.columns.map((c) => c.name);
    const pkCol = rel.columns[rel.pkAttr];
    const items: { row: Row; tuple: Buffer; pk: ReturnType<typeof encodePk> }[] =
      [];
    for (const values of rows) {
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
      items.push({
        row,
        tuple: encodeTuple(rel.columns, row),
        pk: encodePk(row[pkCol.name], pkCol.typ),
      });
    }

    const writer = await this.reader();
    let pageNo = rel.nPages === 0 ? 0 : rel.nPages - 1;
    let pageBuf: Buffer | null = null;
    if (rel.nPages > 0) {
      const ptr = await writer.account.pagePtr.fetch(
        this.pagePda(rel.oid, pageNo)
      );
      const id = decodeIrysTxid(ptr.txid);
      pageBuf = await this.fetchPage(rel, id);
      const hash = sha256(pageBuf);
      if (Buffer.from(hash).compare(Buffer.from(ptr.hash)) !== 0) {
        throw new Error("page hash does not match PagePtr");
      }
    }

    type Pending = { row: Row; pk: ReturnType<typeof encodePk>; slot: number };
    let pending: Pending[] = [];
    let prepared = pageBuf !== null;

    const ensurePage = async (): Promise<void> => {
      if (prepared) {
        return;
      }
      await this.preparePage(rel.oid, pageNo);
      await this.maybeDelegatePage(rel.oid, pageNo);
      prepared = true;
    };

    const commitPage = async (): Promise<void> => {
      if (!pageBuf || pending.length === 0) {
        return;
      }
      const packed = pageBuf;
      const entries = pending;
      const commitNo = pageNo;
      const uploaded = await this.store.put(packed);
      await writer.methods
        .execInsert(
          rel.oid,
          commitNo,
          rel.pkAttr,
          rel.name,
          uploaded.txid,
          uploaded.hash,
          entries.map((e) => ({
            key: e.pk.key,
            keyLen: e.pk.keyLen,
            slot: e.slot,
          }))
        )
        .accounts({
          authority: this.wallet,
          slab: this.slabPda,
          catalog: this.catalogPda,
          pagePtr: this.pagePda(rel.oid, commitNo),
          index: this.indexPda(rel.oid, rel.pkAttr),
        })
        .remainingAccounts(this.writerRemaining())
        .rpc(await this.rpcOpts());
      for (const e of entries) {
        await this.putSecondary(rel, e.row, commitNo, e.slot);
      }
    };

    const startNextPage = async (): Promise<void> => {
      pageNo += 1;
      pageBuf = null;
      pending = [];
      prepared = false;
    };

    for (const item of items) {
      if (pageBuf && !tupleFitsWithColumns(pageBuf, rel.columns, item.tuple)) {
        await commitPage();
        await startNextPage();
      }
      if (!pageBuf) {
        await ensurePage();
        pageBuf = packPage(rel.oid, pageNo, [withLiveFlag(item.tuple)]);
        pending = [{ row: item.row, pk: item.pk, slot: 0 }];
        continue;
      }
      const slot = unpackPhysical(pageBuf, rel.columns).length;
      pageBuf = appendTuple(pageBuf, rel.columns, item.tuple);
      pending.push({ row: item.row, pk: item.pk, slot });
    }
    await commitPage();
    this.invalidateCatalog();
  }

  private indexedAttrs(rel: RelInfo): number[] {
    const out: number[] = [];
    for (let a = 0; a < rel.columns.length; a++) {
      if (a !== rel.pkAttr && (rel.idxMask & (1 << a)) !== 0) {
        out.push(a);
      }
    }
    return out;
  }

  private async putSecondary(
    rel: RelInfo,
    row: Row,
    pageNo: number,
    slot: number
  ): Promise<void> {
    const writer = await this.reader();
    for (const attr of this.indexedAttrs(rel)) {
      const col = rel.columns[attr];
      const key = encodePk(row[col.name], col.typ);
      await writer.methods
        .execIndexPut(rel.oid, attr, pageNo, [
          { key: key.key, keyLen: key.keyLen, slot },
        ])
        .accounts({
          authority: this.wallet,
          slab: this.slabPda,
          catalog: this.catalogPda,
          index: this.indexPda(rel.oid, attr),
        })
        .remainingAccounts(this.writerRemaining())
        .rpc(await this.rpcOpts());
    }
  }

  private async delSecondary(rel: RelInfo, row: Row): Promise<void> {
    const writer = await this.reader();
    for (const attr of this.indexedAttrs(rel)) {
      const col = rel.columns[attr];
      const key = encodePk(row[col.name], col.typ);
      await writer.methods
        .execIndexDel(rel.oid, attr, [
          { key: key.key, keyLen: key.keyLen, slot: 0 },
        ])
        .accounts({
          authority: this.wallet,
          slab: this.slabPda,
          catalog: this.catalogPda,
          index: this.indexPda(rel.oid, attr),
        })
        .remainingAccounts(this.writerRemaining())
        .rpc(await this.rpcOpts());
    }
  }

  private async syncSecondary(
    rel: RelInfo,
    oldRow: Row,
    newRow: Row,
    pageNo: number,
    slot: number,
    slotChanged: boolean
  ): Promise<void> {
    const writer = await this.reader();
    for (const attr of this.indexedAttrs(rel)) {
      const col = rel.columns[attr];
      const oldKey = encodePk(oldRow[col.name], col.typ);
      const newKey = encodePk(newRow[col.name], col.typ);
      const keyChanged =
        oldKey.keyLen !== newKey.keyLen ||
        oldKey.key.some((b, i) => b !== newKey.key[i]);
      if (!keyChanged && !slotChanged) {
        continue;
      }
      await writer.methods
        .execIndexDel(rel.oid, attr, [
          { key: oldKey.key, keyLen: oldKey.keyLen, slot: 0 },
        ])
        .accounts({
          authority: this.wallet,
          slab: this.slabPda,
          catalog: this.catalogPda,
          index: this.indexPda(rel.oid, attr),
        })
        .remainingAccounts(this.writerRemaining())
        .rpc(await this.rpcOpts());
      await writer.methods
        .execIndexPut(rel.oid, attr, pageNo, [
          { key: newKey.key, keyLen: newKey.keyLen, slot },
        ])
        .accounts({
          authority: this.wallet,
          slab: this.slabPda,
          catalog: this.catalogPda,
          index: this.indexPda(rel.oid, attr),
        })
        .remainingAccounts(this.writerRemaining())
        .rpc(await this.rpcOpts());
    }
  }

  async select(
    table: string,
    columns: string[] | "*",
    where: { col: string; value: SqlValue } | null,
    opts: {
      limit?: number | null;
      offset?: number;
      orderBy?: { col: string; dir: "asc" | "desc" }[];
    } = {}
  ): Promise<Row[]> {
    const rel = await this.relByName(table);
    const reader = await this.reader();
    let rows: Row[] = [];
    const whereAttr = where
      ? rel.columns.findIndex((c) => c.name === where.col)
      : -1;
    const indexed =
      whereAttr >= 0 &&
      ((rel.idxMask & (1 << whereAttr)) !== 0 || whereAttr === rel.pkAttr);

    if (where && indexed) {
      const col = rel.columns[whereAttr];
      const pk = encodePk(where.value, col.typ);
      const idx = await reader.account.index.fetch(
        this.indexPda(rel.oid, whereAttr)
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
      const ptr = await reader.account.pagePtr.fetch(
        this.pagePda(rel.oid, hit.pageNo)
      );
      const page = await this.fetchPage(rel, decodeIrysTxid(ptr.txid));
      if (Buffer.from(sha256(page)).compare(Buffer.from(ptr.hash)) !== 0) {
        throw new Error("page hash does not match PagePtr");
      }
      const hitRow = unpackSlot(page, rel.columns, hit.slot);
      rows = hitRow ? [hitRow] : [];
    } else {
      for (let pageNo = 0; pageNo < rel.nPages; pageNo++) {
        const ptr = await reader.account.pagePtr.fetch(
          this.pagePda(rel.oid, pageNo)
        );
        const page = await this.fetchPage(rel, decodeIrysTxid(ptr.txid));
        if (Buffer.from(sha256(page)).compare(Buffer.from(ptr.hash)) !== 0) {
          throw new Error("page hash does not match PagePtr");
        }
        rows.push(
          ...unpackPhysical(page, rel.columns)
            .filter((r) => !r.dead)
            .map((r) => r.row)
        );
      }
      if (where) {
        rows = rows.filter((row) => valuesEqual(row[where.col], where.value));
      }
    }

    for (let i = opts.orderBy?.length ?? 0; i-- > 0; ) {
      const ob = opts.orderBy![i];
      rows.sort((a, b) => {
        const cmp = compareSql(a[ob.col], b[ob.col]);
        return ob.dir === "desc" ? -cmp : cmp;
      });
    }
    const offset = opts.offset ?? 0;
    if (offset > 0) {
      rows = rows.slice(offset);
    }
    if (opts.limit != null) {
      rows = rows.slice(0, opts.limit);
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

  async createIndex(table: string, column: string): Promise<void> {
    const rel = await this.relByName(table);
    const attr = rel.columns.findIndex((c) => c.name === column);
    if (attr < 0) {
      throw new Error(`column ${column} does not exist`);
    }
    if (attr === rel.pkAttr) {
      return;
    }
    await this.prepareIndex(rel.oid, attr);
    await this.maybeDelegateIndex(rel.oid, attr);
    const writer = await this.reader();
    await writer.methods
      .execCreateIndex(rel.oid, attr, rel.name)
      .accounts({
        authority: this.wallet,
        slab: this.slabPda,
        catalog: this.catalogPda,
        index: this.indexPda(rel.oid, attr),
      })
      .rpc(await this.rpcOpts());
    this.invalidateCatalog();
    const indexed = await this.relByName(table);
    const byPage = new Map<
      number,
      { key: number[]; keyLen: number; slot: number }[]
    >();
    for (let pageNo = 0; pageNo < indexed.nPages; pageNo++) {
      const reader = await this.reader();
      const ptr = await reader.account.pagePtr.fetch(
        this.pagePda(indexed.oid, pageNo)
      );
      const page = await this.fetchPage(indexed, decodeIrysTxid(ptr.txid));
      const physical = unpackPhysical(page, indexed.columns);
      for (let slot = 0; slot < physical.length; slot++) {
        if (physical[slot].dead) {
          continue;
        }
        const key = encodePk(
          physical[slot].row[indexed.columns[attr].name],
          indexed.columns[attr].typ
        );
        const list = byPage.get(pageNo) ?? [];
        list.push({ key: key.key, keyLen: key.keyLen, slot });
        byPage.set(pageNo, list);
      }
    }
    const writer2 = await this.reader();
    for (const [pageNo, list] of byPage) {
      const chunkSize = 16;
      for (let i = 0; i < list.length; i += chunkSize) {
        const chunk = list.slice(i, i + chunkSize);
        await writer2.methods
          .execIndexPut(indexed.oid, attr, pageNo, chunk)
          .accounts({
            authority: this.wallet,
            slab: this.slabPda,
            catalog: this.catalogPda,
            index: this.indexPda(indexed.oid, attr),
          })
          .remainingAccounts(this.writerRemaining())
          .rpc(await this.rpcOpts());
      }
    }
  }

  async update(
    table: string,
    set: { col: string; value: SqlValue }[],
    where: { col: string; value: SqlValue }
  ): Promise<void> {
    const rel = await this.relByName(table);
    const pkCol = rel.columns[rel.pkAttr];
    if (where.col !== pkCol.name) {
      throw new Error("UPDATE WHERE must use the primary key");
    }
    const found = await this.select(table, "*", where);
    if (found.length === 0) {
      throw new Error("row not found");
    }
    const next: Row = { ...found[0] };
    for (const s of set) {
      next[s.col] = s.value;
    }
    const hit = await this.lookupPk(rel, where.value);
    if (!hit) {
      throw new Error("row not found");
    }
    const reader = await this.reader();
    const ptr = await reader.account.pagePtr.fetch(
      this.pagePda(rel.oid, hit.pageNo)
    );
    const oldPage = await this.fetchPage(rel, decodeIrysTxid(ptr.txid));
    const tuple = encodeTuple(rel.columns, next);
    const rewritten = rewriteSlot(oldPage, rel.columns, hit.slot, tuple);
    const uploaded = await this.store.put(rewritten.page);
    const oldPk = encodePk(found[0][pkCol.name], pkCol.typ);
    const newPk = encodePk(next[pkCol.name], pkCol.typ);
    const pkChanged =
      oldPk.keyLen !== newPk.keyLen ||
      oldPk.key.some((b, i) => b !== newPk.key[i]);
    const slotChanged = rewritten.slot !== hit.slot;
    await reader.methods
      .execMutate(
        rel.oid,
        hit.pageNo,
        rel.pkAttr,
        rel.name,
        uploaded.txid,
        uploaded.hash,
        unpackPhysical(rewritten.page, rel.columns).length,
        rel.nTuples,
        pkChanged || slotChanged
          ? [{ key: oldPk.key, keyLen: oldPk.keyLen, slot: hit.slot }]
          : [],
        pkChanged || slotChanged
          ? [{ key: newPk.key, keyLen: newPk.keyLen, slot: rewritten.slot }]
          : []
      )
      .accounts({
        authority: this.wallet,
        slab: this.slabPda,
        catalog: this.catalogPda,
        pagePtr: this.pagePda(rel.oid, hit.pageNo),
        index: this.indexPda(rel.oid, rel.pkAttr),
      })
      .remainingAccounts(this.writerRemaining())
      .rpc(await this.rpcOpts());
    await this.syncSecondary(
      rel,
      found[0],
      next,
      hit.pageNo,
      rewritten.slot,
      slotChanged
    );
    this.invalidateCatalog();
  }

  async delete(
    table: string,
    where: { col: string; value: SqlValue }
  ): Promise<void> {
    const rel = await this.relByName(table);
    const pkCol = rel.columns[rel.pkAttr];
    if (where.col !== pkCol.name) {
      throw new Error("DELETE WHERE must use the primary key");
    }
    const hit = await this.lookupPk(rel, where.value);
    if (!hit) {
      return;
    }
    const reader = await this.reader();
    const ptr = await reader.account.pagePtr.fetch(
      this.pagePda(rel.oid, hit.pageNo)
    );
    const oldPage = await this.fetchPage(rel, decodeIrysTxid(ptr.txid));
    const oldRow = unpackSlot(oldPage, rel.columns, hit.slot);
    const packed = tombstoneSlot(oldPage, rel.columns, hit.slot);
    const uploaded = await this.store.put(packed);
    const pk = encodePk(where.value, pkCol.typ);
    await reader.methods
      .execMutate(
        rel.oid,
        hit.pageNo,
        rel.pkAttr,
        rel.name,
        uploaded.txid,
        uploaded.hash,
        unpackPhysical(packed, rel.columns).length,
        Math.max(0, rel.nTuples - 1),
        [{ key: pk.key, keyLen: pk.keyLen, slot: hit.slot }],
        []
      )
      .accounts({
        authority: this.wallet,
        slab: this.slabPda,
        catalog: this.catalogPda,
        pagePtr: this.pagePda(rel.oid, hit.pageNo),
        index: this.indexPda(rel.oid, rel.pkAttr),
      })
      .remainingAccounts(this.writerRemaining())
      .rpc(await this.rpcOpts());
    if (oldRow) {
      await this.delSecondary(rel, oldRow);
    }
    this.invalidateCatalog();
  }

  async dropTable(name: string): Promise<void> {
    const rel = await this.relByName(name);
    const writer = await this.reader();
    await writer.methods
      .execDrop(rel.oid, rel.name)
      .accounts({
        authority: this.wallet,
        slab: this.slabPda,
        catalog: this.catalogPda,
      })
      .rpc(await this.rpcOpts());
    this.invalidateCatalog();
  }

  async reallocCatalog(): Promise<void> {
    await this.program.methods
      .reallocCatalog()
      .accounts({
        authority: this.wallet,
        slab: this.slabPda,
        catalog: this.catalogPda,
      })
      .rpc();
    this.invalidateCatalog();
  }

  async delegate(relOid: number, pageNo: number, pkAttr: number): Promise<void> {
    await this.program.methods
      .delegate(this.ns, relOid, pageNo, pkAttr)
      .accounts({
        payer: this.wallet,
        slab: this.slabPda,
        catalog: this.catalogPda,
        index: this.indexPda(relOid, pkAttr),
        pagePtr: this.pagePda(relOid, pageNo),
      })
      .remainingAccounts(this.remainingAccounts)
      .preInstructions([delegateCuIx()])
      .rpc();
  }

  extraCommitAccounts(rel: RelInfo): Remaining[] {
    const extra: Remaining[] = [
      {
        pubkey: this.indexPda(rel.oid, rel.pkAttr),
        isSigner: false,
        isWritable: true,
      },
    ];
    for (let p = 0; p < rel.nPages; p++) {
      extra.push({
        pubkey: this.pagePda(rel.oid, p),
        isSigner: false,
        isWritable: true,
      });
    }
    for (const attr of this.indexedAttrs(rel)) {
      extra.push({
        pubkey: this.indexPda(rel.oid, attr),
        isSigner: false,
        isWritable: true,
      });
    }
    return extra;
  }

  async commit(extra: Remaining[] = []): Promise<string> {
    const er = this.programEr;
    if (!er) {
      throw new Error("commit needs programEr");
    }
    return er.methods
      .commit()
      .accounts({
        payer: this.wallet,
        slab: this.slabPda,
        catalog: this.catalogPda,
        magicProgram: MAGIC_PROGRAM_ID,
        magicContext: MAGIC_CONTEXT_ID,
      })
      .remainingAccounts(extra)
      .rpc({ skipPreflight: true });
  }

  async undelegate(extra: Remaining[] = []): Promise<string> {
    const er = this.programEr;
    if (!er) {
      throw new Error("undelegate needs programEr");
    }
    const sig = await er.methods
      .undelegate()
      .accounts({
        payer: this.wallet,
        slab: this.slabPda,
        catalog: this.catalogPda,
        magicProgram: MAGIC_PROGRAM_ID,
        magicContext: MAGIC_CONTEXT_ID,
      })
      .remainingAccounts(extra)
      .rpc({ skipPreflight: true });
    this.sawDelegated = false;
    this.invalidateCatalog();
    return sig;
  }

  private async lookupPk(
    rel: RelInfo,
    value: SqlValue
  ): Promise<{ pageNo: number; slot: number } | null> {
    const reader = await this.reader();
    const pkCol = rel.columns[rel.pkAttr];
    const pk = encodePk(value, pkCol.typ);
    const idx = await reader.account.index.fetch(
      this.indexPda(rel.oid, rel.pkAttr)
    );
    for (let i = 0; i < Number(idx.nKeys); i++) {
      const e = idx.keys[i];
      const keyLen = Number(e.keyLen);
      const key = Array.from(e.key as number[]).slice(0, keyLen);
      if (keyLen === pk.keyLen && key.every((b, j) => b === pk.key[j])) {
        return { pageNo: Number(e.pageNo), slot: Number(e.slot) };
      }
    }
    return null;
  }
}
