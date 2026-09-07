pub const SLAB_SEED: &[u8] = b"slab";
pub const CAT_SEED: &[u8] = b"cat";
pub const PAGE_SEED: &[u8] = b"page";
pub const IDX_SEED: &[u8] = b"idx";
pub const FEE_SEED: &[u8] = b"fee";

pub const MAX_TABLES: usize = 16;
pub const MAX_COLS: usize = 16;
pub const MAX_ROWS_PER_TABLE: u32 = 4096;
pub const MAX_INDEX_KEYS: usize = 128;
pub const PAGE_BYTES: usize = 8192;
pub const REL_NAME_LEN: usize = 64;
pub const ATTR_NAME_LEN: usize = 32;
pub const TEXT_MAX_BYTES: usize = 1024;
/// Extra lamports on Slab so ER inits can pay rent from a delegated PDA.
pub const FEE_RESERVE_LAMPORTS: u64 = 80_000_000;

pub const COL_BOOL: u8 = 1;
pub const COL_INT4: u8 = 2;
pub const COL_INT8: u8 = 3;
pub const COL_TEXT: u8 = 4;
pub const COL_TIMESTAMPTZ: u8 = 5;
