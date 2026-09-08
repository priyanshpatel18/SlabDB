pub const SLAB_SEED: &[u8] = b"slab";
pub const CAT_SEED: &[u8] = b"cat";
pub const PAGE_SEED: &[u8] = b"page";
pub const IDX_SEED: &[u8] = b"idx";
pub const FEE_SEED: &[u8] = b"fee";

pub const INIT_TABLES: usize = 16;
pub const MAX_TABLES: usize = 32;
pub const MAX_COLS: usize = 16;
pub const MAX_ROWS_PER_TABLE: u32 = 4096;
pub const MAX_INDEX_KEYS: usize = 128;
pub const PAGE_BYTES: usize = 8192;
/// Irys receipt id is ASCII (32..=64). Stored zero-padded on the right.
pub const TXID_LEN: usize = 64;
pub const TXID_MIN_LEN: usize = 32;
pub const REL_NAME_LEN: usize = 64;
pub const ATTR_NAME_LEN: usize = 32;
pub const TEXT_MAX_BYTES: usize = 1024;
/// Extra lamports on the fee vault so `prepare_index` / `prepare_page` can pay rent on L1
/// for several tables after Slab is already delegated.
pub const FEE_RESERVE_LAMPORTS: u64 = 800_000_000;
/// Extra lamports on Slab. MagicIntent uses the delegated Slab as payer.
pub const MAGIC_INTENT_LAMPORTS: u64 = 20_000_000;

pub const COL_BOOL: u8 = 1;
pub const COL_INT4: u8 = 2;
pub const COL_INT8: u8 = 3;
pub const COL_TEXT: u8 = 4;
pub const COL_TIMESTAMPTZ: u8 = 5;
