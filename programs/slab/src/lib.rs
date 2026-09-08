pub mod constants;
pub mod error;
pub mod state;

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::{program::invoke, program::invoke_signed, system_instruction};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;
use magicblock_magic_program_api::args::ScheduleTaskArgs;
use magicblock_magic_program_api::instruction::MagicBlockInstruction;

use solana_sha256_hasher::hash;
use constants::{
    CAT_SEED, COL_BOOL, COL_INT4, COL_INT8, COL_TEXT, COL_TIMESTAMPTZ, FEE_RESERVE_LAMPORTS,
    FEE_SEED, IDX_SEED, MAGIC_INTENT_LAMPORTS, MAX_COLS, MAX_INDEX_KEYS, MAX_ROWS_PER_TABLE,
    MAX_TABLES, PAGE_SEED, SLAB_SEED, TXID_LEN, TXID_MIN_LEN,
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

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ScheduleCommitArgs {
    pub task_id: i64,
    pub execution_interval_millis: i64,
    pub iterations: i64,
}

#[event]
pub struct SelectHit {
    pub rel_oid: u32,
    pub page_no: u32,
    pub slot: u16,
    pub txid: [u8; TXID_LEN],
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
        invoke(
            &system_instruction::transfer(
                ctx.accounts.authority.key,
                &ctx.accounts.slab.key(),
                MAGIC_INTENT_LAMPORTS,
            ),
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.slab.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        Ok(())
    }

    /// Create an empty Index PDA on L1. Slab may already be DLP-owned.
    pub fn prepare_index(ctx: Context<PrepareIndex>, rel_oid: u32, pk_attr: u8) -> Result<()> {
        let (ns, _) = load_slab_ignore_owner(
            &ctx.accounts.slab.to_account_info(),
            ctx.accounts.authority.key,
        )?;
        let vault_bump = require_fee_vault(
            &ctx.accounts.fee_vault.to_account_info(),
            ctx.accounts.authority.key,
            &ns,
        )?;
        let slab_key = ctx.accounts.slab.key();
        let rel_bytes = rel_oid.to_le_bytes();
        let pk_bytes = [pk_attr];
        let idx_bump = [ctx.bumps.index];
        create_pda_paid_by_vault(
            ctx.accounts.fee_vault.to_account_info(),
            vault_bump,
            ctx.accounts.authority.key,
            &ns,
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
        Ok(())
    }

    /// Create an empty PagePtr PDA on L1. Call again for page_no 1, 2, …
    /// Slab may already be DLP-owned.
    pub fn prepare_page(ctx: Context<PreparePage>, rel_oid: u32, page_no: u32) -> Result<()> {
        let (ns, _) = load_slab_ignore_owner(
            &ctx.accounts.slab.to_account_info(),
            ctx.accounts.authority.key,
        )?;
        let vault_bump = require_fee_vault(
            &ctx.accounts.fee_vault.to_account_info(),
            ctx.accounts.authority.key,
            &ns,
        )?;
        let slab_key = ctx.accounts.slab.key();
        let rel_bytes = rel_oid.to_le_bytes();
        let page_bytes = page_no.to_le_bytes();
        let page_bump = [ctx.bumps.page_ptr];
        create_pda_paid_by_vault(
            ctx.accounts.fee_vault.to_account_info(),
            vault_bump,
            ctx.accounts.authority.key,
            &ns,
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
        Ok(())
    }

    /// First table helper: Index + page 0. Extra pages use `prepare_page` only.
    pub fn prepare_rel(
        ctx: Context<PrepareRel>,
        rel_oid: u32,
        page_no: u32,
        pk_attr: u8,
    ) -> Result<()> {
        let slab_key = ctx.accounts.slab.key();
        let rel_bytes = rel_oid.to_le_bytes();
        let page_bytes = page_no.to_le_bytes();
        let pk_bytes = [pk_attr];
        let idx_bump = [ctx.bumps.index];
        let page_bump = [ctx.bumps.page_ptr];
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
        txid: [u8; TXID_LEN],
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

    /// Delegate one Index after `prepare_index`. Does not touch Slab or Catalog.
    pub fn delegate_index(
        ctx: Context<DelegateIndex>,
        rel_oid: u32,
        pk_attr: u8,
    ) -> Result<()> {
        load_slab_ignore_owner(&ctx.accounts.slab.to_account_info(), ctx.accounts.payer.key)?;
        let validator = ctx.remaining_accounts.first().map(|acc| acc.key());
        let slab_key = ctx.accounts.slab.key();
        let rel_bytes = rel_oid.to_le_bytes();
        let pk_bytes = [pk_attr];
        ctx.accounts.delegate_index(
            &ctx.accounts.payer,
            &[IDX_SEED, slab_key.as_ref(), rel_bytes.as_ref(), pk_bytes.as_ref()],
            DelegateConfig {
                validator,
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// Delegate one PagePtr after `prepare_page`. Does not touch Slab or Catalog.
    pub fn delegate_page(
        ctx: Context<DelegatePage>,
        rel_oid: u32,
        page_no: u32,
    ) -> Result<()> {
        load_slab_ignore_owner(&ctx.accounts.slab.to_account_info(), ctx.accounts.payer.key)?;
        let validator = ctx.remaining_accounts.first().map(|acc| acc.key());
        let slab_key = ctx.accounts.slab.key();
        let rel_bytes = rel_oid.to_le_bytes();
        let page_bytes = page_no.to_le_bytes();
        ctx.accounts.delegate_page_ptr(
            &ctx.accounts.payer,
            &[
                PAGE_SEED,
                slab_key.as_ref(),
                rel_bytes.as_ref(),
                page_bytes.as_ref(),
            ],
            DelegateConfig {
                validator,
                ..Default::default()
            },
        )?;
        Ok(())
    }

    pub fn commit<'a>(ctx: Context<'a, CommitSlab<'a>>) -> Result<()> {
        stamp_catalog_root(&mut ctx.accounts.slab, &ctx.accounts.catalog)?;
        ctx.accounts.slab.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&commit_list(
            ctx.accounts.slab.to_account_info(),
            ctx.accounts.catalog.to_account_info(),
            ctx.remaining_accounts,
        ))
        .build_and_invoke()?;
        Ok(())
    }

    /// Stamp catalog_root, then MagicIntent-commit with the delegated Slab as payer.
    /// No user signer — Magic invokes this crank. Wallet payers fail InvalidWritableAccount.
    pub fn crank_commit<'a>(ctx: Context<'a, CrankCommit<'a>>) -> Result<()> {
        let bump = ctx.accounts.slab.bump;
        let authority = ctx.accounts.slab.authority;
        let ns = ctx.accounts.slab.ns;
        stamp_catalog_root(&mut ctx.accounts.slab, &ctx.accounts.catalog)?;
        ctx.accounts.slab.exit(&crate::ID)?;

        let delegation_record_data = ctx.accounts.delegation_record.try_borrow_data()?;
        require!(
            delegation_record_data.len() >= 40,
            SlabError::InvalidDelegationRecord
        );
        let validator = Pubkey::try_from(&delegation_record_data[8..40])
            .map_err(|_| error!(SlabError::InvalidDelegationRecord))?;
        drop(delegation_record_data);
        let (expected_fee_vault, _) = Pubkey::find_program_address(
            &[b"magic-fee-vault", validator.as_ref()],
            &ephemeral_rollups_sdk::id(),
        );
        require_keys_eq!(
            ctx.accounts.magic_fee_vault.key(),
            expected_fee_vault,
            SlabError::InvalidDelegationRecord
        );

        let payer = as_signer(ctx.accounts.slab.to_account_info());
        let bump_seed = [bump];
        let seeds: &[&[u8]] = &[SLAB_SEED, authority.as_ref(), ns.as_ref(), bump_seed.as_ref()];
        MagicIntentBundleBuilder::new(
            payer,
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .magic_fee_vault(ctx.accounts.magic_fee_vault.to_account_info())
        .commit(&commit_list(
            ctx.accounts.slab.to_account_info(),
            ctx.accounts.catalog.to_account_info(),
            ctx.remaining_accounts,
        ))
        .build_and_invoke_signed(&[seeds])?;
        Ok(())
    }

    /// Schedule crank_commit on the ER. Send this transaction to the ER, not L1.
    pub fn schedule_commit_crank(
        ctx: Context<ScheduleCommitCrank>,
        args: ScheduleCommitArgs,
    ) -> Result<()> {
        require!(
            ctx.accounts.slab.authority == ctx.accounts.payer.key(),
            SlabError::Unauthorized
        );
        let commit_ix = Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new(ctx.accounts.slab.key(), false),
                AccountMeta::new(ctx.accounts.catalog.key(), false),
                AccountMeta::new_readonly(ctx.accounts.delegation_record.key(), false),
                AccountMeta::new(ctx.accounts.magic_fee_vault.key(), false),
                AccountMeta::new_readonly(ctx.accounts.magic_program.key(), false),
                AccountMeta::new(ctx.accounts.magic_context.key(), false),
            ],
            data: anchor_lang::InstructionData::data(&crate::instruction::CrankCommit {}),
        };
        let schedule_ix = Instruction::new_with_bincode(
            ctx.accounts.magic_program.key(),
            &MagicBlockInstruction::ScheduleTask(ScheduleTaskArgs {
                task_id: args.task_id,
                execution_interval_millis: args.execution_interval_millis,
                iterations: args.iterations,
                instructions: vec![commit_ix],
            }),
            vec![
                AccountMeta::new(ctx.accounts.payer.key(), true),
                AccountMeta::new(ctx.accounts.slab.key(), false),
                AccountMeta::new(ctx.accounts.catalog.key(), false),
                AccountMeta::new_readonly(ctx.accounts.delegation_record.key(), false),
                AccountMeta::new(ctx.accounts.magic_fee_vault.key(), false),
                AccountMeta::new_readonly(ctx.accounts.magic_program.key(), false),
                AccountMeta::new(ctx.accounts.magic_context.key(), false),
            ],
        );
        invoke(
            &schedule_ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.slab.to_account_info(),
                ctx.accounts.catalog.to_account_info(),
                ctx.accounts.delegation_record.to_account_info(),
                ctx.accounts.magic_fee_vault.to_account_info(),
                ctx.accounts.magic_program.to_account_info(),
                ctx.accounts.magic_context.to_account_info(),
            ],
        )?;
        Ok(())
    }

    pub fn undelegate<'a>(ctx: Context<'a, CommitSlab<'a>>) -> Result<()> {
        stamp_catalog_root(&mut ctx.accounts.slab, &ctx.accounts.catalog)?;
        ctx.accounts.slab.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&commit_list(
            ctx.accounts.slab.to_account_info(),
            ctx.accounts.catalog.to_account_info(),
            ctx.remaining_accounts,
        ))
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

    require_prepared_pda(&ctx.accounts.index.to_account_info(), Index::SIZE)?;
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

fn require_prepared_pda(ai: &AccountInfo, space: usize) -> Result<()> {
    require!(ai.data_len() == space, SlabError::InvalidPage);
    require!(*ai.owner == crate::ID, SlabError::InvalidPage);
    Ok(())
}

fn load_slab_ignore_owner(ai: &AccountInfo, authority: &Pubkey) -> Result<([u8; 32], u8)> {
    let data = ai.try_borrow_data()?;
    let mut src: &[u8] = &data;
    let slab = SlabAccount::try_deserialize(&mut src)?;
    require_keys_eq!(slab.authority, *authority, SlabError::Unauthorized);
    let (expected, _) = Pubkey::find_program_address(
        &[SLAB_SEED, authority.as_ref(), slab.ns.as_ref()],
        &crate::ID,
    );
    require_keys_eq!(*ai.key, expected, SlabError::Unauthorized);
    Ok((slab.ns, slab.bump))
}

fn require_fee_vault(ai: &AccountInfo, authority: &Pubkey, ns: &[u8; 32]) -> Result<u8> {
    let (expected, bump) =
        Pubkey::find_program_address(&[FEE_SEED, authority.as_ref(), ns.as_ref()], &crate::ID);
    require_keys_eq!(*ai.key, expected, SlabError::Unauthorized);
    Ok(bump)
}

fn page_ptr_initialized(ai: &AccountInfo) -> Result<bool> {
    let data = ai.try_borrow_data()?;
    Ok(data.len() >= 8 && data.starts_with(&PagePtr::DISCRIMINATOR))
}

fn commit_list<'info>(
    slab: AccountInfo<'info>,
    catalog: AccountInfo<'info>,
    remaining: &[AccountInfo<'info>],
) -> Vec<AccountInfo<'info>> {
    let mut out = vec![slab, catalog];
    out.extend(remaining.iter().cloned());
    out
}

/// Workaround: MagicIntentBundleBuilder copies `is_signer` from AccountInfo.
/// A crank PDA arrives with is_signer=false. Seeds make the CPI valid.
fn as_signer<'info>(signer: AccountInfo<'info>) -> AccountInfo<'info> {
    AccountInfo {
        is_signer: true,
        ..signer
    }
}

fn rel_index(catalog: &Catalog, rel_oid: u32) -> Result<usize> {
    for i in 0..(catalog.n_rels as usize) {
        if catalog.rels[i].oid == rel_oid {
            return Ok(i);
        }
    }
    err!(SlabError::RelationNotFound)
}

fn is_irys_txid(txid: &[u8; TXID_LEN]) -> bool {
    let Some(last) = txid.iter().rposition(|b| *b != 0) else {
        return false;
    };
    let n = last + 1;
    if n < TXID_MIN_LEN {
        return false;
    }
    txid[..n].iter().all(|b| {
        matches!(
            b,
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_'
        )
    }) && txid[n..].iter().all(|b| *b == 0)
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
    txid: [u8; TXID_LEN],
    hash: [u8; 32],
    entries: &[PkSlot],
) -> Result<()> {
    require!(!entries.is_empty(), SlabError::ProgramLimitExceeded);
    require!(is_irys_txid(&txid), SlabError::InvalidPointer);
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
    let page_initialized = page_ptr_initialized(&ctx.accounts.page_ptr.to_account_info())?;
    if page_initialized {
        require!(
            catalog.rels[rel_i].n_pages == page_no.saturating_add(1),
            SlabError::InvalidPage
        );
    } else {
        require!(
            catalog.rels[rel_i].n_pages == page_no,
            SlabError::InvalidPage
        );
    }
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

    require_prepared_pda(
        &ctx.accounts.page_ptr.to_account_info(),
        8 + PagePtr::INIT_SPACE,
    )?;
    if page_initialized {
        let mut page: PagePtr = {
            let data = ctx.accounts.page_ptr.try_borrow_data()?;
            let mut src: &[u8] = &data;
            PagePtr::try_deserialize(&mut src)?
        };
        require!(
            page.rel_oid == rel_oid && page.page_no == page_no,
            SlabError::InvalidPage
        );
        page.txid = txid;
        page.hash = hash;
        page.n_tuples = page
            .n_tuples
            .checked_add(entries.len() as u16)
            .ok_or(error!(SlabError::ProgramLimitExceeded))?;
        {
            let mut data = ctx.accounts.page_ptr.try_borrow_mut_data()?;
            let mut dst: &mut [u8] = &mut data;
            page.try_serialize(&mut dst)?;
        }
    } else {
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
    }

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
#[instruction(rel_oid: u32, page_no: u32, pk_attr: u8)]
pub struct PrepareRel<'info> {
    pub authority: Signer<'info>,
    #[account(
        seeds = [SLAB_SEED, slab.authority.as_ref(), slab.ns.as_ref()],
        bump = slab.bump,
        has_one = authority @ SlabError::Unauthorized
    )]
    pub slab: Account<'info, SlabAccount>,
    /// CHECK: system-owned lamport vault. Must still be system-owned (L1, before delegate).
    #[account(
        mut,
        seeds = [FEE_SEED, authority.key().as_ref(), slab.ns.as_ref()],
        bump
    )]
    pub fee_vault: UncheckedAccount<'info>,
    /// CHECK: empty Index PDA created here.
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
    /// CHECK: empty PagePtr PDA created here.
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
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(rel_oid: u32, pk_attr: u8)]
pub struct PrepareIndex<'info> {
    pub authority: Signer<'info>,
    /// CHECK: program-owned on L1, or DLP-owned after delegate. Handler checks PDA + authority.
    pub slab: UncheckedAccount<'info>,
    /// CHECK: system-owned lamport vault. Create on L1 only. Handler checks PDA.
    #[account(mut)]
    pub fee_vault: UncheckedAccount<'info>,
    /// CHECK: empty Index PDA created here.
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
#[instruction(rel_oid: u32, page_no: u32)]
pub struct PreparePage<'info> {
    pub authority: Signer<'info>,
    /// CHECK: program-owned on L1, or DLP-owned after delegate. Handler checks PDA + authority.
    pub slab: UncheckedAccount<'info>,
    /// CHECK: system-owned lamport vault. Create on L1 only. Handler checks PDA.
    #[account(mut)]
    pub fee_vault: UncheckedAccount<'info>,
    /// CHECK: empty PagePtr PDA created here.
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
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(rel_oid: u32, pk_attr: u8)]
pub struct ExecSql<'info> {
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
    /// CHECK: Index PDA from prepare_rel. Mutated here, never created here.
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
}

#[derive(Accounts)]
#[instruction(rel_oid: u32, page_no: u32, pk_attr: u8)]
pub struct ExecInsert<'info> {
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
    /// CHECK: PagePtr PDA from prepare_rel. Mutated here, never created here.
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

#[delegate]
#[derive(Accounts)]
pub struct DelegateIndex<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: slab key is an Index seed. Not delegated here.
    pub slab: UncheckedAccount<'info>,
    /// CHECK: Index PDA verified by the delegate CPI via seeds.
    #[account(mut, del)]
    pub index: UncheckedAccount<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegatePage<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: slab key is a PagePtr seed. Not delegated here.
    pub slab: UncheckedAccount<'info>,
    /// CHECK: PagePtr PDA verified by the delegate CPI via seeds.
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

/// Crank path: Magic invokes this with no user signature.
/// #[commit] adds magic_program + magic_context.
#[commit]
#[derive(Accounts)]
pub struct CrankCommit<'info> {
    #[account(
        mut,
        seeds = [SLAB_SEED, slab.authority.as_ref(), slab.ns.as_ref()],
        bump = slab.bump
    )]
    pub slab: Account<'info, SlabAccount>,
    #[account(
        mut,
        seeds = [CAT_SEED, slab.key().as_ref()],
        bump
    )]
    pub catalog: AccountLoader<'info, Catalog>,
    /// CHECK: slab delegation record; bytes [8..40] are the validator.
    #[account(address = ephemeral_rollups_sdk::pda::delegation_record_pda_from_delegated_account(&slab.key()))]
    pub delegation_record: UncheckedAccount<'info>,
    /// CHECK: Magic fee vault of the delegating validator. Required when payer is delegated.
    #[account(mut)]
    pub magic_fee_vault: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ScheduleCommitCrank<'info> {
    /// CHECK: Magic program. CPI target for ScheduleTask.
    pub magic_program: UncheckedAccount<'info>,
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
    /// CHECK: slab delegation record; forwarded into crank_commit.
    #[account(address = ephemeral_rollups_sdk::pda::delegation_record_pda_from_delegated_account(&slab.key()))]
    pub delegation_record: UncheckedAccount<'info>,
    /// CHECK: Magic fee vault of the delegating validator.
    #[account(mut)]
    pub magic_fee_vault: UncheckedAccount<'info>,
    /// CHECK: Magic context. crank_commit MagicIntent writes it.
    #[account(mut, address = ephemeral_rollups_sdk::consts::MAGIC_CONTEXT_ID)]
    pub magic_context: UncheckedAccount<'info>,
    /// CHECK: this program. Required by the Magic schedule CPI.
    pub program: UncheckedAccount<'info>,
}
