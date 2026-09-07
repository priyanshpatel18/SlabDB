pub mod constants;
pub mod error;
pub mod state;

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

use constants::{
    CAT_SEED, COL_BOOL, COL_INT4, COL_INT8, COL_TEXT, COL_TIMESTAMPTZ, IDX_SEED, MAX_COLS,
    MAX_INDEX_KEYS, MAX_ROWS_PER_TABLE, MAX_TABLES, PAGE_SEED, SLAB_SEED,
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

    pub fn delegate(ctx: Context<DelegateSlab>, ns: [u8; 32]) -> Result<()> {
        let authority = ctx.accounts.payer.key();
        let validator = ctx.remaining_accounts.first().map(|acc| acc.key());
        ctx.accounts.delegate_slab(
            &ctx.accounts.payer,
            &[SLAB_SEED, authority.as_ref(), ns.as_ref()],
            DelegateConfig {
                validator,
                ..Default::default()
            },
        )?;
        let slab_key = ctx.accounts.slab.key();
        ctx.accounts.delegate_catalog(
            &ctx.accounts.payer,
            &[CAT_SEED, slab_key.as_ref()],
            DelegateConfig {
                validator,
                ..Default::default()
            },
        )?;
        Ok(())
    }

    pub fn commit(ctx: Context<CommitSlab>) -> Result<()> {
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

    let mut index = ctx.accounts.index.load_init()?;
    index.n_keys = 0;
    index.bump = ctx.bumps.index;
    index.pk_attr = pk_attr;
    index.rel_oid = rel_oid;

    let rel_idx = catalog.n_rels as usize;
    catalog.rels[rel_idx] = rel;
    catalog.n_rels += 1;
    ctx.accounts.slab.schema_version += 1;
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

    let page = &mut ctx.accounts.page_ptr;
    page.rel_oid = rel_oid;
    page.page_no = page_no;
    page.txid = txid;
    page.hash = hash;
    page.n_tuples = entries.len() as u16;
    page.flags = 0;
    page.bump = ctx.bumps.page_ptr;
    page.created_slot = Clock::get()?.slot;

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
    #[account(
        init,
        payer = authority,
        space = Index::SIZE,
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
    #[account(
        init,
        payer = authority,
        space = 8 + PagePtr::INIT_SPACE,
        seeds = [
            PAGE_SEED,
            slab.key().as_ref(),
            &rel_oid.to_le_bytes(),
            &page_no.to_le_bytes()
        ],
        bump
    )]
    pub page_ptr: Account<'info, PagePtr>,
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
