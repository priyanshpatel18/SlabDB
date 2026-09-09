function viewOf(buf: Uint8Array): DataView {
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
}

export function writeU8(buf: Uint8Array, value: number, offset: number): void {
  viewOf(buf).setUint8(offset, value);
}

export function writeU16LE(buf: Uint8Array, value: number, offset: number): void {
  viewOf(buf).setUint16(offset, value, true);
}

export function writeU32LE(buf: Uint8Array, value: number, offset: number): void {
  viewOf(buf).setUint32(offset, value, true);
}

export function writeI32LE(buf: Uint8Array, value: number, offset: number): void {
  viewOf(buf).setInt32(offset, value, true);
}

export function writeI64LE(buf: Uint8Array, value: bigint, offset: number): void {
  viewOf(buf).setBigInt64(offset, value, true);
}

export function readU8(buf: Uint8Array, offset: number): number {
  return viewOf(buf).getUint8(offset);
}

export function readU16LE(buf: Uint8Array, offset: number): number {
  return viewOf(buf).getUint16(offset, true);
}

export function readU32LE(buf: Uint8Array, offset: number): number {
  return viewOf(buf).getUint32(offset, true);
}

export function readI32LE(buf: Uint8Array, offset: number): number {
  return viewOf(buf).getInt32(offset, true);
}

export function readI64LE(buf: Uint8Array, offset: number): bigint {
  return viewOf(buf).getBigInt64(offset, true);
}

export function writeF64LE(buf: Uint8Array, value: number, offset: number): void {
  viewOf(buf).setFloat64(offset, value, true);
}

export function readF64LE(buf: Uint8Array, offset: number): number {
  return viewOf(buf).getFloat64(offset, true);
}
