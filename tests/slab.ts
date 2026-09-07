import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { expect } from "chai";
import { Slab } from "../target/types/slab";

function nsFrom(label: string): number[] {
  const buf = Buffer.alloc(32);
  Buffer.from(label).copy(buf);
  return Array.from(buf);
}

describe("slab", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.slab as Program<Slab>;
  const ns = nsFrom("notes-demo");

  const [slabPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("slab"),
      provider.wallet.publicKey.toBuffer(),
      Buffer.from(ns),
    ],
    program.programId
  );
  const [catalogPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("cat"), slabPda.toBuffer()],
    program.programId
  );

  it("initialize + CREATE TABLE notes", async () => {
    await program.methods
      .initialize(ns)
      .accounts({
        authority: provider.wallet.publicKey,
        slab: slabPda,
        catalog: catalogPda,
      })
      .rpc();

    await program.methods
      .execSql({
        createTable: {
          name: "notes",
          columns: [
            { name: "id", typ: { int8: {} }, notNull: true },
            { name: "author", typ: { text: {} }, notNull: true },
            { name: "body", typ: { text: {} }, notNull: true },
          ],
          pkAttr: 0,
        },
      })
      .accounts({
        authority: provider.wallet.publicKey,
        slab: slabPda,
        catalog: catalogPda,
      })
      .rpc();

    const slab = await program.account.slabAccount.fetch(slabPda);
    const catalog = await program.account.catalog.fetch(catalogPda);
    expect(slab.schemaVersion).to.equal(1);
    expect(catalog.nRels).to.equal(1);
    expect(catalog.rels[0].nAttrs).to.equal(3);
    expect(catalog.rels[0].pkAttr).to.equal(0);
  });
});
