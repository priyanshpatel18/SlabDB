export const PAGE_BYTES = 8192;
export const PAGE_HEADER = 32;
/** Max utf8 / bytea payload in one cell. The 8 KiB page is the hard cap. */
export const TEXT_MAX_BYTES = 4096;
export const TXID_LEN = 64;
export const TXID_MIN_LEN = 32;

export const TUPLE_LIVE = 0;
export const TUPLE_DEAD = 1;
export const COL_BOOL = 1;
export const COL_INT4 = 2;
export const COL_INT8 = 3;
export const COL_TEXT = 4;
export const COL_TIMESTAMPTZ = 5;
export const COL_UUID = 6;
export const COL_FLOAT8 = 7;
export const COL_JSON = 8;
export const COL_BYTEA = 9;

export type ColTypeName =
  | "bool"
  | "int4"
  | "int8"
  | "text"
  | "timestamptz"
  | "uuid"
  | "float8"
  | "json"
  | "bytea";

export type Column = {
  name: string;
  typ: ColTypeName;
  notNull: boolean;
};

export type SqlJson =
  | null
  | boolean
  | number
  | string
  | SqlJson[]
  | { [key: string]: SqlJson };

export type SqlValue = boolean | number | bigint | string | Uint8Array | SqlJson;

export type SqlParam = SqlValue | null;

export type Row = Record<string, SqlValue>;
