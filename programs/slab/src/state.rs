use anchor_lang::prelude::*;

use crate::constants::{ATTR_NAME_LEN, MAX_COLS, MAX_TABLES, REL_NAME_LEN};

#[account]
#[derive(InitSpace)]
pub struct SlabAccount {
    pub authority: Pubkey,
    pub ns: [u8; 32],
    pub catalog_root: [u8; 32],
    pub schema_version: u32,
    pub bump: u8,
    pub flags: u8,
}

#[zero_copy]
#[derive(Default)]
pub struct Attr {
    pub name: [u8; ATTR_NAME_LEN],
    pub typ: u8,
    pub not_null: u8,
}

#[zero_copy]
pub struct Rel {
    pub oid: u32,
    pub n_pages: u32,
    pub n_tuples: u32,
    pub n_attrs: u8,
    pub pk_attr: u8,
    pub _pad: [u8; 2],
    pub name: [u8; REL_NAME_LEN],
    pub attrs: [Attr; MAX_COLS],
}

impl Default for Rel {
    fn default() -> Self {
        Self {
            oid: 0,
            n_pages: 0,
            n_tuples: 0,
            n_attrs: 0,
            pk_attr: 0,
            _pad: [0; 2],
            name: [0u8; REL_NAME_LEN],
            attrs: [Attr::default(); MAX_COLS],
        }
    }
}

/// Live relation catalog. Zero-copy so 32 tables do not blow the BPF stack.
#[account(zero_copy)]
pub struct Catalog {
    pub n_rels: u16,
    pub bump: u8,
    pub _pad: [u8; 5],
    pub rels: [Rel; MAX_TABLES],
}

impl Catalog {
    pub const SIZE: usize = 8 + core::mem::size_of::<Catalog>();
}

/// Pointer to an 8 KiB page on Arweave. Row bytes never live here.
#[account]
#[derive(InitSpace)]
pub struct PagePtr {
    pub txid: [u8; 43],
    pub hash: [u8; 32],
    pub n_tuples: u16,
    pub flags: u8,
    pub created_slot: u64,
}

/// PK index on the PER. Spill to Arweave pages later.
#[account]
#[derive(InitSpace)]
pub struct Index {
    pub n_keys: u16,
    pub bump: u8,
}

pub fn encode_name<const N: usize>(src: &str) -> Result<[u8; N]> {
    require!(
        !src.is_empty() && src.len() <= N,
        crate::error::SlabError::InvalidIdentifier
    );
    let mut out = [0u8; N];
    out[..src.len()].copy_from_slice(src.as_bytes());
    Ok(out)
}

pub fn name_eq<const N: usize>(stored: &[u8; N], src: &str) -> bool {
    if src.len() > N {
        return false;
    }
    stored[..src.len()] == *src.as_bytes() && stored[src.len()..].iter().all(|b| *b == 0)
}
