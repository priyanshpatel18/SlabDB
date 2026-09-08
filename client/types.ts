export const PAGE_BYTES = 8192;
export const PAGE_HEADER = 32;
export const TEXT_MAX_BYTES = 1024;
export const TXID_LEN = 64;
export const TXID_MIN_LEN = 32;

export const COL_BOOL = 1;
export const COL_INT4 = 2;
export const COL_INT8 = 3;
export const COL_TEXT = 4;
export const COL_TIMESTAMPTZ = 5;

export type ColTypeName = "bool" | "int4" | "int8" | "text" | "timestamptz";

export type Column = {
  name: string;
  typ: ColTypeName;
  notNull: boolean;
};

export type SqlValue = boolean | number | bigint | string;

export type Row = Record<string, SqlValue>;
