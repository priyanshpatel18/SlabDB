pub mod constants;
pub mod error;
pub mod state;

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

use constants::{
    CAT_SEED, COL_BOOL, COL_INT4, COL_INT8, COL_TEXT, COL_TIMESTAMPTZ, MAX_COLS, MAX_TABLES,
    SLAB_SEED,
};
use error::SlabError;
use state::{encode_name, name_eq, Attr, Catalog, Rel, SlabAccount};

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

    pub fn exec_sql(ctx: Context<ExecSql>, stmt: SqlStmt) -> Result<()> {
        match stmt {
            SqlStmt::CreateTable {
                name,
                columns,
                pk_attr,
            } => create_table(ctx, &name, &columns, pk_attr),
        }
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

    for i in 0..(catalog.n_rels as usize) {
        require!(
            !name_eq(&catalog.rels[i].name, name),
            SlabError::RelationExists
        );
    }

    let mut rel = Rel::default();
    rel.oid = (catalog.n_rels as u32) + 1;
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

    let rel_idx = catalog.n_rels as usize;
    catalog.rels[rel_idx] = rel;
    catalog.n_rels += 1;
    ctx.accounts.slab.schema_version += 1;
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
