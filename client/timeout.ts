export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)
      );
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

export function isIrysUnpaid(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /402|not enough funds|not enough balance/i.test(msg);
}
