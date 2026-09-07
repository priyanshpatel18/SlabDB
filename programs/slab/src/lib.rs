pub mod constants;
pub mod error;
pub mod state;

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

use solana_sha256_hasher::hash;
use constants::{
    CAT_SEED, COL_BOOL, COL_INT4, COL_INT8, COL_TEXT, COL_TIMESTAMPTZ, FEE_RESERVE_LAMPORTS,
    FEE_SEED, IDX_SEED, MAX_COLS, MAX_INDEX_KEYS, MAX_ROWS_PER_TABLE, MAX_TABLES, PAGE_SEED,
    SLAB_SEED,
};
use error::SlabError;
use state::{
    encode_name, name_eq, Attr, Catalog, Index, IndexEntry, PagePtr, Rel, SlabAccount,
};

declare_id!("58AARMgjnefMz59oCc4WpnqCmpuR92FfQtNk7mV2Sxet");

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ColType {
    Bool,
    Int4,
    Int8,
    Text,
    Timestamptz,
}

impl ColType {
    pub fn as_u8(self) -> u8 {
        match self {
            ColType::Bool => COL_BOOL,
            ColType::Int4 => COL_INT4,
            ColType::Int8 => COL_INT8,
            ColType::Text => COL_TEXT,
            ColType::Timestamptz => COL_TIMESTAMPTZ,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ColumnSpec {
    pub name: String,
    pub typ: ColType,
    pub not_null: bool,
}

/// Structured SQL. The proxy parses Postgres text. The program never sees JOIN.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum SqlStmt {
    CreateTable {
        name: String,
        columns: Vec<ColumnSpec>,
        pk_attr: u8,
    },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PkSlot {
    pub key: [u8; 32],
    pub key_len: u8,
    pub slot: u16,
}

#[event]
pub struct SelectHit {
    pub rel_oid: u32,
    pub page_no: u32,
    pub slot: u16,
    pub txid: [u8; 43],
    pub hash: [u8; 32],
}

#[ephemeral]
#[program]
pub mod slab {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, ns: [u8; 32]) -> Result<()> {
        let slab = &mut ctx.accounts.slab;
        slab.authority = ctx.accounts.authority.key();
        slab.ns = ns;
        slab.catalog_root = [0u8; 32];
        slab.schema_version = 0;
        slab.bump = ctx.bumps.slab;
        slab.flags = 0;

        let mut catalog = ctx.accounts.catalog.load_init()?;
        catalog.n_rels = 0;
        catalog.bump = ctx.bumps.catalog;
        drop(catalog);

        let vault_bump = [ctx.bumps.fee_vault];
        invoke_signed(
            &system_instruction::create_account(
                ctx.accounts.authority.key,
                ctx.accounts.fee_vault.key,
                FEE_RESERVE_LAMPORTS,
                0,
                &anchor_lang::solana_program::system_program::ID,
            ),
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.fee_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[&[FEE_SEED, ctx.accounts.authority.key.as_ref(), ns.as_ref(), vault_bump.as_ref()]],
        )?;
        Ok(())
    }

    pub fn exec_sql(
        ctx: Context<ExecSql>,
        rel_oid: u32,
        pk_attr: u8,
        stmt: SqlStmt,
    ) -> Result<()> {
        match stmt {
            SqlStmt::CreateTable {
                name,
                columns,
                pk_attr: stmt_pk,
            } => {
                require!(pk_attr == stmt_pk, SlabError::InvalidPrimaryKey);
                create_table(ctx, rel_oid, &name, &columns, pk_attr)
            }
        }
    }

    pub fn exec_insert(
        ctx: Context<ExecInsert>,
        rel_oid: u32,
        page_no: u32,
        pk_attr: u8,
        rel_name: String,
        txid: [u8; 43],
        hash: [u8; 32],
        entries: Vec<PkSlot>,
    ) -> Result<()> {
        insert_page(ctx, rel_oid, page_no, pk_attr, &rel_name, txid, hash, &entries)
    }

    pub fn exec_select(
        ctx: Context<ExecSelect>,
        rel_oid: u32,
        pk_attr: u8,
        pk: [u8; 32],
        pk_len: u8,
    ) -> Result<()> {
        select_pk(ctx, rel_oid, pk_attr, &pk, pk_len)
    }

    pub fn delegate(
        ctx: Context<DelegateSlab>,
        ns: [u8; 32],
        rel_oid: u32,
        page_no: u32,
        pk_attr: u8,
    ) -> Result<()> {
        let authority = ctx.accounts.payer.key();
        let validator = ctx.remaining_accounts.first().map(|acc| acc.key());
        let cfg = || DelegateConfig {
            validator,
            ..Default::default()
        };
        ctx.accounts.delegate_slab(
            &ctx.accounts.payer,
            &[SLAB_SEED, authority.as_ref(), ns.as_ref()],
            cfg(),
        )?;
        let slab_key = ctx.accounts.slab.key();
        ctx.accounts.delegate_catalog(
            &ctx.accounts.payer,
            &[CAT_SEED, slab_key.as_ref()],
            cfg(),
        )?;
        // Index and PagePtr must exist on L1 first. A delegated fee vault is
        // DLP-owned, so System create_account cannot run on the ER.
        let rel_bytes = rel_oid.to_le_bytes();
        let page_bytes = page_no.to_le_bytes();
        let pk_bytes = [pk_attr];
        ctx.accounts.delegate_index(
            &ctx.accounts.payer,
            &[IDX_SEED, slab_key.as_ref(), rel_bytes.as_ref(), pk_bytes.as_ref()],
            cfg(),
        )?;
        ctx.accounts.delegate_page_ptr(
            &ctx.accounts.payer,
            &[
                PAGE_SEED,
                slab_key.as_ref(),
                rel_bytes.as_ref(),
                page_bytes.as_ref(),
            ],
            cfg(),
        )?;
        Ok(())
    }

    pub fn commit(ctx: Context<CommitSlab>) -> Result<()> {
        stamp_catalog_root(&mut ctx.accounts.slab, &ctx.accounts.catalog)?;
        ctx.accounts.slab.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[
            ctx.accounts.slab.to_account_info(),
            ctx.accounts.catalog.to_account_info(),
        ])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn undelegate(ctx: Context<CommitSlab>) -> Result<()> {
        stamp_catalog_root(&mut ctx.accounts.slab, &ctx.accounts.catalog)?;
        ctx.accounts.slab.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[
            ctx.accounts.slab.to_account_info(),
            ctx.accounts.catalog.to_account_info(),
        ])
        .build_and_invoke()?;
        Ok(())
    }
}

fn create_table(
    ctx: Context<ExecSql>,
    rel_oid: u32,
    name: &str,
    columns: &[ColumnSpec],
    pk_attr: u8,
) -> Result<()> {
    require!(
        !columns.is_empty() && columns.len() <= MAX_COLS,
        SlabError::ProgramLimitExceeded
    );
    require!(
        (pk_attr as usize) < columns.len(),
        SlabError::InvalidPrimaryKey
    );

    let mut catalog = ctx.accounts.catalog.load_mut()?;
    require!(
        (catalog.n_rels as usize) < MAX_TABLES,
        SlabError::ProgramLimitExceeded
    );
    require!(
        rel_oid == (catalog.n_rels as u32) + 1,
        SlabError::InvalidRelOid
    );

    for i in 0..(catalog.n_rels as usize) {
        require!(
            !name_eq(&catalog.rels[i].name, name),
            SlabError::RelationExists
        );
    }

    let mut rel = Rel::default();
    rel.oid = rel_oid;
    rel.name = encode_name(name)?;
    rel.n_attrs = columns.len() as u8;
    rel.pk_attr = pk_attr;
    rel.n_pages = 0;
    rel.n_tuples = 0;

    for (i, col) in columns.iter().enumerate() {
        rel.attrs[i] = Attr {
            name: encode_name(&col.name)?,
            typ: col.typ.as_u8(),
            not_null: u8::from(col.not_null),
        };
    }

    let slab_key = ctx.accounts.slab.key();
    let rel_bytes = rel_oid.to_le_bytes();
    let pk_bytes = [pk_attr];
    let idx_bump = [ctx.bumps.index];
    create_pda_paid_by_vault(
        ctx.accounts.fee_vault.to_account_info(),
        ctx.bumps.fee_vault,
        &ctx.accounts.authority.key(),
        &ctx.accounts.slab.ns,
        ctx.accounts.index.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        Index::SIZE,
        &[
            IDX_SEED,
            slab_key.as_ref(),
            rel_bytes.as_ref(),
            pk_bytes.as_ref(),
            idx_bump.as_ref(),
        ],
    )?;
    {
        let mut data = ctx.accounts.index.try_borrow_mut_data()?;
        require!(data.len() == Index::SIZE, SlabError::ProgramLimitExceeded);
        data[..8].copy_from_slice(&Index::DISCRIMINATOR);
        data[8..].fill(0);
        let index: &mut Index = bytemuck::from_bytes_mut(&mut data[8..]);
        index.n_keys = 0;
        index.bump = ctx.bumps.index;
        index.pk_attr = pk_attr;
        index.rel_oid = rel_oid;
    }

    let rel_idx = catalog.n_rels as usize;
    catalog.rels[rel_idx] = rel;
    catalog.n_rels += 1;
    ctx.accounts.slab.schema_version += 1;
    Ok(())
}

/// L1 header commits to the catalog bytes last written on the ER.
fn stamp_catalog_root(
    slab: &mut Account<SlabAccount>,
    catalog: &AccountLoader<Catalog>,
) -> Result<()> {
    let root = {
        let info = catalog.to_account_info();
        let data = info.data.borrow();
        hash(&data).to_bytes()
    };
    slab.catalog_root = root;
    Ok(())
}

/// Pay rent from the system-owned fee vault. Call this on L1 before delegate.
fn create_pda_paid_by_vault<'info>(
    vault_ai: AccountInfo<'info>,
    vault_bump: u8,
    authority: &Pubkey,
    ns: &[u8; 32],
    new_ai: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
    space: usize,
    new_seeds: &[&[u8]],
) -> Result<()> {
    require!(
        new_ai.lamports() == 0 && new_ai.data_is_empty(),
        SlabError::InvalidPage
    );
    let rent = Rent::get()?.minimum_balance(space);
    require!(vault_ai.lamports() >= rent, SlabError::ProgramLimitExceeded);
    let bump = [vault_bump];
    let vault_seeds: [&[u8]; 4] = [FEE_SEED, authority.as_ref(), ns.as_ref(), &bump];
    invoke_signed(
        &system_instruction::create_account(
            vault_ai.key,
            new_ai.key,
            rent,
            space as u64,
            &crate::ID,
        ),
        &[vault_ai, new_ai, system_program],
        &[&vault_seeds, new_seeds],
    )?;
    Ok(())
}

fn rel_index(catalog: &Catalog, rel_oid: u32) -> Result<usize> {
    for i in 0..(catalog.n_rels as usize) {
        if catalog.rels[i].oid == rel_oid {
            return Ok(i);
        }
    }
    err!(SlabError::RelationNotFound)
}

fn key_eq(entry: &IndexEntry, key: &[u8; 32], key_len: u8) -> bool {
    entry.key_len == key_len && entry.key[..key_len as usize] == key[..key_len as usize]
}

fn insert_page(
    ctx: Context<ExecInsert>,
    rel_oid: u32,
    page_no: u32,
    pk_attr: u8,
    rel_name: &str,
    txid: [u8; 43],
    hash: [u8; 32],
    entries: &[PkSlot],
) -> Result<()> {
    require!(!entries.is_empty(), SlabError::ProgramLimitExceeded);
    require!(txid.iter().any(|b| *b != 0), SlabError::InvalidPointer);
    require!(hash.iter().any(|b| *b != 0), SlabError::InvalidPointer);

    let mut catalog = ctx.accounts.catalog.load_mut()?;
    let rel_i = rel_index(&catalog, rel_oid)?;
    require!(
        name_eq(&catalog.rels[rel_i].name, rel_name),
        SlabError::RelationNotFound
    );
    require!(
        catalog.rels[rel_i].pk_attr == pk_attr,
        SlabError::InvalidPrimaryKey
    );
    require!(
        catalog.rels[rel_i].n_pages == page_no,
        SlabError::InvalidPage
    );
    let new_tuples = catalog.rels[rel_i]
        .n_tuples
        .saturating_add(entries.len() as u32);
    require!(
        new_tuples <= MAX_ROWS_PER_TABLE && new_tuples as usize <= MAX_INDEX_KEYS,
        SlabError::ProgramLimitExceeded
    );

    let mut index = ctx.accounts.index.load_mut()?;
    require!(
        index.rel_oid == rel_oid && index.pk_attr == pk_attr,
        SlabError::InvalidPrimaryKey
    );
    require!(
        (index.n_keys as usize) + entries.len() <= MAX_INDEX_KEYS,
        SlabError::ProgramLimitExceeded
    );

    for entry in entries {
        require!(
            entry.key_len > 0 && (entry.key_len as usize) <= 32,
            SlabError::InvalidIdentifier
        );
        for i in 0..(index.n_keys as usize) {
            require!(
                !key_eq(&index.keys[i], &entry.key, entry.key_len),
                SlabError::DuplicateKey
            );
        }
        let slot = index.n_keys as usize;
        index.keys[slot] = IndexEntry {
            key: entry.key,
            page_no,
            slot: entry.slot,
            key_len: entry.key_len,
            _pad: 0,
        };
        index.n_keys += 1;
    }
    drop(index);

    let slab_key = ctx.accounts.slab.key();
    let rel_bytes = rel_oid.to_le_bytes();
    let page_bytes = page_no.to_le_bytes();
    let page_bump = [ctx.bumps.page_ptr];
    create_pda_paid_by_vault(
        ctx.accounts.fee_vault.to_account_info(),
        ctx.bumps.fee_vault,
        &ctx.accounts.authority.key(),
        &ctx.accounts.slab.ns,
        ctx.accounts.page_ptr.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        8 + PagePtr::INIT_SPACE,
        &[
            PAGE_SEED,
            slab_key.as_ref(),
            rel_bytes.as_ref(),
            page_bytes.as_ref(),
            page_bump.as_ref(),
        ],
    )?;
    let page = PagePtr {
        rel_oid,
        page_no,
        txid,
        hash,
        n_tuples: entries.len() as u16,
        flags: 0,
        bump: ctx.bumps.page_ptr,
        created_slot: Clock::get()?.slot,
    };
    {
        let mut data = ctx.accounts.page_ptr.try_borrow_mut_data()?;
        let mut dst: &mut [u8] = &mut data;
        page.try_serialize(&mut dst)?;
    }

    catalog.rels[rel_i].n_pages += 1;
    catalog.rels[rel_i].n_tuples = new_tuples;
    Ok(())
}

fn select_pk(
    ctx: Context<ExecSelect>,
    rel_oid: u32,
    pk_attr: u8,
    pk: &[u8; 32],
    pk_len: u8,
) -> Result<()> {
    require!(pk_len > 0 && (pk_len as usize) <= 32, SlabError::InvalidIdentifier);
    let catalog = ctx.accounts.catalog.load()?;
    let rel_i = rel_index(&catalog, rel_oid)?;
    require!(
        catalog.rels[rel_i].pk_attr == pk_attr,
        SlabError::InvalidPrimaryKey
    );
    drop(catalog);

    let index = ctx.accounts.index.load()?;
    require!(
        index.rel_oid == rel_oid && index.pk_attr == pk_attr,
        SlabError::InvalidPrimaryKey
    );
    let mut hit: Option<(u32, u16)> = None;
    for i in 0..(index.n_keys as usize) {
        if key_eq(&index.keys[i], pk, pk_len) {
            hit = Some((index.keys[i].page_no, index.keys[i].slot));
            break;
        }
    }
    let (page_no, slot) = hit.ok_or(error!(SlabError::RowNotFound))?;
    require!(
        ctx.accounts.page_ptr.rel_oid == rel_oid && ctx.accounts.page_ptr.page_no == page_no,
        SlabError::InvalidPage
    );

    emit!(SelectHit {
        rel_oid,
        page_no,
        slot,
        txid: ctx.accounts.page_ptr.txid,
        hash: ctx.accounts.page_ptr.hash,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(ns: [u8; 32])]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + SlabAccount::INIT_SPACE,
        seeds = [SLAB_SEED, authority.key().as_ref(), ns.as_ref()],
        bump
    )]
    pub slab: Account<'info, SlabAccount>,
    #[account(
        init,
        payer = authority,
        space = Catalog::SIZE,
        seeds = [CAT_SEED, slab.key().as_ref()],
        bump
    )]
    pub catalog: AccountLoader<'info, Catalog>,
    /// CHECK: system-owned lamport vault; created in initialize.
    #[account(
        mut,
        seeds = [FEE_SEED, authority.key().as_ref(), ns.as_ref()],
        bump
    )]
    pub fee_vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(rel_oid: u32, pk_attr: u8)]
pub struct ExecSql<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [SLAB_SEED, slab.authority.as_ref(), slab.ns.as_ref()],
        bump = slab.bump,
        has_one = authority @ SlabError::Unauthorized
    )]
    pub slab: Account<'info, SlabAccount>,
    #[account(
        mut,
        seeds = [CAT_SEED, slab.key().as_ref()],
        bump
    )]
    pub catalog: AccountLoader<'info, Catalog>,
    /// CHECK: delegated system vault; owner is DLP on ER.
    #[account(
        mut,
        seeds = [FEE_SEED, authority.key().as_ref(), slab.ns.as_ref()],
        bump
    )]
    pub fee_vault: UncheckedAccount<'info>,
    /// CHECK: PDA created in-handler; rent is paid by the delegated fee vault.
    #[account(
        mut,
        seeds = [
            IDX_SEED,
            slab.key().as_ref(),
            &rel_oid.to_le_bytes(),
            &[pk_attr]
        ],
        bump
    )]
    pub index: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(rel_oid: u32, page_no: u32, pk_attr: u8)]
pub struct ExecInsert<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [SLAB_SEED, slab.authority.as_ref(), slab.ns.as_ref()],
        bump = slab.bump,
        has_one = authority @ SlabError::Unauthorized
    )]
    pub slab: Account<'info, SlabAccount>,
    #[account(
        mut,
        seeds = [CAT_SEED, slab.key().as_ref()],
        bump
    )]
    pub catalog: AccountLoader<'info, Catalog>,
    /// CHECK: delegated system vault; owner is DLP on ER.
    #[account(
        mut,
        seeds = [FEE_SEED, authority.key().as_ref(), slab.ns.as_ref()],
        bump
    )]
    pub fee_vault: UncheckedAccount<'info>,
    /// CHECK: PDA created in-handler; rent is paid by the delegated fee vault.
    #[account(
        mut,
        seeds = [
            PAGE_SEED,
            slab.key().as_ref(),
            &rel_oid.to_le_bytes(),
            &page_no.to_le_bytes()
        ],
        bump
    )]
    pub page_ptr: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [
            IDX_SEED,
            slab.key().as_ref(),
            &rel_oid.to_le_bytes(),
            &[pk_attr]
        ],
        bump
    )]
    pub index: AccountLoader<'info, Index>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(rel_oid: u32, pk_attr: u8)]
pub struct ExecSelect<'info> {
    pub authority: Signer<'info>,
    #[account(
        seeds = [SLAB_SEED, slab.authority.as_ref(), slab.ns.as_ref()],
        bump = slab.bump,
        has_one = authority @ SlabError::Unauthorized
    )]
    pub slab: Account<'info, SlabAccount>,
    #[account(
        seeds = [CAT_SEED, slab.key().as_ref()],
        bump
    )]
    pub catalog: AccountLoader<'info, Catalog>,
    #[account(
        seeds = [
            IDX_SEED,
            slab.key().as_ref(),
            &rel_oid.to_le_bytes(),
            &[pk_attr]
        ],
        bump
    )]
    pub index: AccountLoader<'info, Index>,
    #[account(
        seeds = [
            PAGE_SEED,
            slab.key().as_ref(),
            &page_ptr.rel_oid.to_le_bytes(),
            &page_ptr.page_no.to_le_bytes()
        ],
        bump = page_ptr.bump
    )]
    pub page_ptr: Account<'info, PagePtr>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateSlab<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: PDA verified by the delegate CPI via seeds.
    #[account(mut, del)]
    pub slab: UncheckedAccount<'info>,
    /// CHECK: PDA verified by the delegate CPI via seeds.
    #[account(mut, del)]
    pub catalog: UncheckedAccount<'info>,
    /// CHECK: PDA verified by the delegate CPI via seeds. Create on L1 first.
    #[account(mut, del)]
    pub index: UncheckedAccount<'info>,
    /// CHECK: PDA verified by the delegate CPI via seeds. Create on L1 first.
    #[account(mut, del)]
    pub page_ptr: UncheckedAccount<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitSlab<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [SLAB_SEED, slab.authority.as_ref(), slab.ns.as_ref()],
        bump = slab.bump,
        constraint = slab.authority == payer.key() @ SlabError::Unauthorized
    )]
    pub slab: Account<'info, SlabAccount>,
    #[account(
        mut,
        seeds = [CAT_SEED, slab.key().as_ref()],
        bump
    )]
    pub catalog: AccountLoader<'info, Catalog>,
}
