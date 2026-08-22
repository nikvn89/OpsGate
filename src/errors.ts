export function walletErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const raw = (error as { code?: unknown }).code;
  if (typeof raw === "number") return raw;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function nestedMessage(error: unknown, depth = 0): string {
  if (depth > 3 || error == null) return "";
  if (typeof error === "string") return error.trim();
  if (error instanceof Error) return error.message?.trim() || "";
  if (typeof error !== "object") return "";

  const value = error as {
    message?: unknown;
    data?: unknown;
    cause?: unknown;
    error?: unknown;
  };

  if (typeof value.message === "string" && value.message.trim()) {
    return value.message.trim();
  }

  for (const candidate of [value.data, value.cause, value.error]) {
    const found = nestedMessage(candidate, depth + 1);
    if (found) return found;
  }

  return "";
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function userErrorMessage(
  error: unknown,
  fallback = "Unexpected wallet or RPC error."
): string {
  const code = walletErrorCode(error);

  if (code === 4001) return "Wallet request was rejected.";
  if (code === 4100) {
    return "This site is not authorized to use the selected wallet account.";
  }
  if (code === 4902) return "GenLayer Studio Network is not added to this wallet.";
  if (code === -32002) {
    return "A wallet request is already pending. Open your wallet and complete it.";
  }
  if (code === -32601) {
    return "This wallet does not support the requested method. Use MetaMask or a compatible EVM wallet.";
  }
  if (code === -32603) {
    return "The wallet or RPC returned an internal error. Please try again.";
  }

  const message = singleLine(nestedMessage(error));

  if (
    message.includes("psycopg2.") ||
    message.includes("can't adapt type") ||
    message.includes("SELECT transactions.") ||
    message.includes("ProgrammingError")
  ) {
    return "StudioNet transaction-status RPC returned an internal backend error. No new transaction is required; retry Check or reload finalized contract state.";
  }

  if (message && message !== "[object Object]") return message;
  return fallback;
}

export function reportError(
  scope: string,
  error: unknown,
  fallback?: string
): string {
  console.error(`[OpsGate] ${scope}:`, error);
  return userErrorMessage(error, fallback);
}
