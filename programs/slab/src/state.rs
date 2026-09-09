use anchor_lang::prelude::*;
use bytemuck::{try_from_bytes, try_from_bytes_mut, try_cast_slice, try_cast_slice_mut};

use crate::constants::{
    ATTR_NAME_LEN, INIT_TABLES, MAX_COLS, MAX_INDEX_KEYS, MAX_TABLES, REL_NAME_LEN, TXID_LEN,
};
use crate::error::SlabError;

#[account]
#[derive(InitSpace)]
pub struct SlabAccount {
    pub authority: Pubkey,
    pub ns: [u8; 32],
    /// sha256 of the Catalog account bytes at the last commit.
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
    /// Bit i set means column i has an Index PDA.
    pub idx_mask: u16,
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
            idx_mask: 0,
            name: [0u8; REL_NAME_LEN],
            attrs: [Attr::default(); MAX_COLS],
        }
    }
}

/// Header + 16 relations at init (10 KiB create cap). `realloc_catalog` adds 16 more.
#[account(zero_copy)]
pub struct Catalog {
    pub n_rels: u16,
    pub bump: u8,
    pub flags: u8,
    pub next_oid: u32,
    pub rels: [Rel; INIT_TABLES],
}

#[zero_copy]
pub struct CatalogHead {
    pub n_rels: u16,
    pub bump: u8,
    pub flags: u8,
    pub next_oid: u32,
}

impl Catalog {
    pub const SIZE: usize = 8 + core::mem::size_of::<Catalog>();
    pub const GROWN_SIZE: usize = 8 + 8 + MAX_TABLES * core::mem::size_of::<Rel>();
}

const _: () = assert!(Catalog::SIZE <= 10_240);
const _: () = assert!(Catalog::GROWN_SIZE > 10_240);
const _: () = assert!(core::mem::size_of::<Rel>() % 8 == 0);
const _: () = assert!(core::mem::size_of::<CatalogHead>() == 8);

pub const CATALOG_RELS_OFF: usize = 16;

pub fn catalog_capacity(data_len: usize) -> usize {
    if data_len < CATALOG_RELS_OFF {
        return 0;
    }
    (data_len - CATALOG_RELS_OFF) / core::mem::size_of::<Rel>()
}

pub fn catalog_head(data: &[u8]) -> Result<&CatalogHead> {
    require!(data.len() >= CATALOG_RELS_OFF, SlabError::InvalidPage);
    require!(data.starts_with(Catalog::DISCRIMINATOR), SlabError::InvalidPage);
    try_from_bytes::<CatalogHead>(&data[8..16]).map_err(|_| error!(SlabError::InvalidPage))
}

pub fn catalog_head_mut(data: &mut [u8]) -> Result<&mut CatalogHead> {
    require!(data.len() >= CATALOG_RELS_OFF, SlabError::InvalidPage);
    require!(data.starts_with(Catalog::DISCRIMINATOR), SlabError::InvalidPage);
    try_from_bytes_mut::<CatalogHead>(&mut data[8..16]).map_err(|_| error!(SlabError::InvalidPage))
}

pub fn catalog_rels(data: &[u8]) -> Result<&[Rel]> {
    let cap = catalog_capacity(data.len());
    require!(cap > 0, SlabError::InvalidPage);
    require!(data.starts_with(Catalog::DISCRIMINATOR), SlabError::InvalidPage);
    let rels = try_cast_slice::<u8, Rel>(&data[CATALOG_RELS_OFF..CATALOG_RELS_OFF + cap * core::mem::size_of::<Rel>()])
        .map_err(|_| error!(SlabError::InvalidPage))?;
    Ok(rels)
}

pub fn catalog_rels_mut(data: &mut [u8]) -> Result<&mut [Rel]> {
    let cap = catalog_capacity(data.len());
    require!(cap > 0, SlabError::InvalidPage);
    require!(data.starts_with(Catalog::DISCRIMINATOR), SlabError::InvalidPage);
    let end = CATALOG_RELS_OFF + cap * core::mem::size_of::<Rel>();
    let rels = try_cast_slice_mut::<u8, Rel>(&mut data[CATALOG_RELS_OFF..end])
        .map_err(|_| error!(SlabError::InvalidPage))?;
    Ok(rels)
}

/// Write grant. PDA `[grant, slab, grantee]`. Owner is always a writer.
#[account]
#[derive(InitSpace)]
pub struct Grant {
    pub slab: Pubkey,
    pub grantee: Pubkey,
    pub bump: u8,
}

/// Pointer to an 8 KiB page on Irys. Row bytes never live here.
#[account]
#[derive(InitSpace)]
pub struct PagePtr {
    pub rel_oid: u32,
    pub page_no: u32,
    pub txid: [u8; TXID_LEN],
    pub hash: [u8; 32],
    pub n_tuples: u16,
    pub flags: u8,
    pub bump: u8,
    pub created_slot: u64,
}

#[zero_copy]
#[derive(Default)]
pub struct IndexEntry {
    pub key: [u8; 32],
    pub page_no: u32,
    pub slot: u16,
    pub key_len: u8,
    pub _pad: u8,
}

/// PK or secondary index. Cap fits the 10 KiB inner-ix create limit.
#[account(zero_copy)]
pub struct Index {
    pub n_keys: u16,
    pub bump: u8,
    pub pk_attr: u8,
    pub rel_oid: u32,
    pub keys: [IndexEntry; MAX_INDEX_KEYS],
}

impl Index {
    pub const SIZE: usize = 8 + core::mem::size_of::<Index>();
}

const _: () = assert!(Index::SIZE <= 10_240);

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

pub fn rel_index(n_rels: u16, rels: &[Rel], rel_oid: u32) -> Result<usize> {
    for i in 0..(n_rels as usize) {
        if rels[i].oid == rel_oid {
            return Ok(i);
        }
    }
    err!(SlabError::RelationNotFound)
}

#[cfg(test)]
mod size_tests {
    use super::*;
    #[test]
    fn rel_bytes() {
        assert_eq!(core::mem::size_of::<Rel>(), 624);
        assert_eq!(core::mem::size_of::<Attr>(), 34);
        assert_eq!(core::mem::size_of::<CatalogHead>(), 8);
    }
}
