const GRANT_MSG = "writer is not the catalog owner and has no GRANT";

function collect(err: unknown, depth = 0): string {
  if (err == null || depth > 5) {
    return "";
  }
  if (typeof err === "string") {
    return err;
  }
  const parts: string[] = [];
  if (err instanceof Error) {
    parts.push(err.message);
  }
  const bag = err as {
    message?: unknown;
    logs?: unknown;
    errorLogs?: unknown;
    error?: unknown;
    cause?: unknown;
  };
  if (typeof bag.message === "string" && !(err instanceof Error)) {
    parts.push(bag.message);
  }
  if (Array.isArray(bag.logs)) {
    parts.push(bag.logs.map(String).join("\n"));
  }
  if (Array.isArray(bag.errorLogs)) {
    parts.push(bag.errorLogs.map(String).join("\n"));
  }
  if (bag.error) {
    try {
      parts.push(JSON.stringify(bag.error));
    } catch {
      parts.push(String(bag.error));
    }
  }
  if (bag.cause && bag.cause !== err) {
    parts.push(collect(bag.cause, depth + 1));
  }
  try {
    parts.push(JSON.stringify(err));
  } catch {
    /* ignore */
  }
  return parts.filter(Boolean).join("\n");
}

/** Map Anchor / web3 wrap errors to a stable Slab message. */
export function formatProgramError(err: unknown): string {
  const text = collect(err);
  if (
    /NotGranted|no GRANT|not granted|Custom":\s*6016|Custom:\s*6016|custom program error: 0x1780|error: 6016/i.test(
      text
    )
  ) {
    return GRANT_MSG;
  }
  if (/Unknown action ['"]undefined['"]/i.test(text)) {
    return "ER transaction failed. The client did not decode the program error.";
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return text || "transaction failed";
}

export function isGrantDenied(err: unknown): boolean {
  return /no GRANT|NotGranted|not granted|Custom":\s*6016|0x1780/i.test(
    formatProgramError(err)
  );
}
