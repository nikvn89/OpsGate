import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  CONTRACT_ADDRESS,
  EXPLORER_BASE,
  READ_RPC,
  READ_STATE_STATUS
} from "./config";
import { reportError, walletErrorCode } from "./errors";
import type { Address, Change, ChangeFeed, Config, Workspace } from "./types";

const STUDIO_WALLET_RPC = "https://studio.genlayer.com/api";
const STUDIONET_CHAIN_HEX = `0x${studionet.id.toString(16)}`;

const proxiedStudionet = {
  ...studionet,
  rpcUrls: {
    ...studionet.rpcUrls,
    default: {
      ...studionet.rpcUrls.default,
      http: [READ_RPC]
    }
  }
} as typeof studionet;

export const readClient = createClient({ chain: proxiedStudionet });

function parseJson<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function readState() {
  return READ_STATE_STATUS as never;
}

export async function getConfig(): Promise<Config> {
  const result = await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_config",
    args: [],
    stateStatus: readState()
  } as any);
  return parseJson<Config>(result);
}

export async function getLatestWorkspaceId(owner: Address): Promise<number> {
  const result = await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_latest_workspace_id",
    args: [owner],
    stateStatus: readState()
  } as any);
  return Number(result);
}

export async function getWorkspace(workspaceId: number): Promise<Workspace> {
  const result = await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_workspace",
    args: [workspaceId],
    stateStatus: readState()
  } as any);
  return parseJson<Workspace>(result);
}

export async function getChange(
  workspaceId: number,
  changeId: number
): Promise<Change> {
  const result = await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_change",
    args: [workspaceId, changeId],
    stateStatus: readState()
  } as any);
  return parseJson<Change>(result);
}

export async function getChanges(
  workspaceId: number,
  start = 1,
  count = 20
): Promise<ChangeFeed> {
  const result = await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_changes",
    args: [workspaceId, start, count],
    stateStatus: readState()
  } as any);
  return parseJson<ChangeFeed>(result);
}

function requireProvider() {
  if (!window.ethereum) {
    throw new Error(
      "No browser wallet detected. Install MetaMask or a compatible EVM wallet."
    );
  }
  return window.ethereum;
}

async function switchToStudionet(): Promise<void> {
  const ethereum = requireProvider();

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIONET_CHAIN_HEX }]
    });
    return;
  } catch (error) {
    const code = walletErrorCode(error);
    if (code === 4001) {
      throw new Error(
        "Network switch was rejected. Switch the wallet to GenLayer Studio Network to continue."
      );
    }
    if (code !== 4902) {
      throw new Error(
        reportError(
          "switch network",
          error,
          "Could not switch to GenLayer Studio Network."
        )
      );
    }
  }

  try {
    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: STUDIONET_CHAIN_HEX,
          chainName: studionet.name || "GenLayer Studio Network",
          rpcUrls: [STUDIO_WALLET_RPC],
          nativeCurrency: {
            name: studionet.nativeCurrency?.name || "GEN Token",
            symbol: studionet.nativeCurrency?.symbol || "GEN",
            decimals: studionet.nativeCurrency?.decimals ?? 18
          },
          blockExplorerUrls: [EXPLORER_BASE]
        }
      ]
    });
  } catch (error) {
    if (walletErrorCode(error) === 4001) {
      throw new Error(
        "Adding GenLayer Studio Network was rejected. Add the network in your wallet to continue."
      );
    }
    throw new Error(
      reportError(
        "add network",
        error,
        "Could not add GenLayer Studio Network to the wallet."
      )
    );
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIONET_CHAIN_HEX }]
    });
  } catch (error) {
    if (walletErrorCode(error) === 4001) {
      throw new Error(
        "Network switch was rejected. Switch the wallet to GenLayer Studio Network to continue."
      );
    }
    throw new Error(
      reportError(
        "switch network after add",
        error,
        "GenLayer Studio Network was added but could not be selected."
      )
    );
  }
}

export async function ensureStudioChain(): Promise<void> {
  const ethereum = requireProvider();
  const rawChainId = await ethereum.request({ method: "eth_chainId" });
  const current =
    typeof rawChainId === "string" ? Number.parseInt(rawChainId, 16) : 0;

  if (current === studionet.id) return;

  await switchToStudionet();

  const after = await ethereum.request({ method: "eth_chainId" });
  const afterId = typeof after === "string" ? Number.parseInt(after, 16) : 0;
  if (afterId !== studionet.id) {
    throw new Error(
      `Wallet is not connected to GenLayer Studio Network (chain ${studionet.id}).`
    );
  }
}

export async function connectWallet(): Promise<Address> {
  const ethereum = requireProvider();
  const accounts = (await ethereum.request({
    method: "eth_requestAccounts"
  })) as string[];

  const address = accounts?.[0] as Address | undefined;
  if (!address) throw new Error("Wallet connection was not approved.");

  // Chain-only onboarding. Do not call client.connect(), which invokes
  // wallet/Snap methods that are unnecessary for normal EVM writes.
  await ensureStudioChain();
  return address;
}

export async function currentWallet(): Promise<Address | null> {
  if (!window.ethereum) return null;
  const accounts = (await window.ethereum.request({
    method: "eth_accounts"
  })) as string[];
  return (accounts?.[0] as Address | undefined) ?? null;
}

function getWriteClient(account: Address) {
  const ethereum = requireProvider();
  return createClient({
    chain: studionet,
    account,
    provider: ethereum as never
  });
}

export async function writeContractAction(
  account: Address,
  functionName: string,
  args: Array<string | number | bigint | boolean> = []
): Promise<`0x${string}`> {
  await ensureStudioChain();
  const client = getWriteClient(account);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value: 0n
  } as any);
  return hash as `0x${string}`;
}

type RpcEnvelope<T> = {
  jsonrpc?: string;
  id?: number | string;
  result?: T;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

async function rawRpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(READ_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params
    })
  });

  if (!response.ok) {
    throw new Error(`RPC ${method} failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as RpcEnvelope<T>;

  if (payload.error) {
    throw new Error(
      payload.error.message ||
        `RPC ${method} failed${payload.error.code ? ` (${payload.error.code})` : ""}.`
    );
  }

  if (payload.result === undefined) {
    throw new Error(`RPC ${method} returned no result.`);
  }

  return payload.result;
}

function statusNameFromValue(value: unknown): string {
  if (typeof value === "string") {
    const upper = value.toUpperCase();
    if (upper.startsWith("0X")) {
      const numeric = Number.parseInt(upper, 16);
      return statusNameFromValue(numeric);
    }
    if (/^\d+$/.test(upper)) return statusNameFromValue(Number(upper));
    return upper;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "UNKNOWN";

  if (numeric === 13) return "LEADER_TIMEOUT";
  if (numeric === 12) return "VALIDATORS_TIMEOUT";
  if (numeric === 11) return "READY_TO_FINALIZE";
  if (numeric === 10) return "APPEAL_COMMITTING";
  if (numeric === 9) return "APPEAL_REVEALING";
  if (numeric === 8) return "CANCELED";
  if (numeric === 7) return "FINALIZED";
  if (numeric === 6) return "UNDETERMINED";
  if (numeric === 5) return "ACCEPTED";
  if (numeric === 4) return "REVEALING";
  if (numeric === 3) return "COMMITTING";
  if (numeric === 2) return "PROPOSING";
  if (numeric === 1) return "PENDING";
  if (numeric === 0) return "UNINITIALIZED";
  return "UNKNOWN";
}

function maybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const clean = value.trim();
  if (!clean.startsWith("{") && !clean.startsWith("[")) return value;
  try {
    return JSON.parse(clean);
  } catch {
    return value;
  }
}

function executionNameFromTransaction(tx: Record<string, any>): string {
  const direct = String(
    tx.txExecutionResultName ??
      tx.tx_execution_result_name ??
      tx.executionResultName ??
      tx.execution_result_name ??
      ""
  ).toUpperCase();

  if (direct) return direct;

  const consensus = maybeJson(tx.consensus_data ?? tx.consensusData) as any;
  const receipts =
    consensus?.leader_receipt ??
    consensus?.leaderReceipt ??
    consensus?.leader_receipts ??
    consensus?.leaderReceipts;

  const first = Array.isArray(receipts) ? receipts[0] : receipts;
  const raw = String(
    first?.execution_result ??
      first?.executionResult ??
      first?.result ??
      ""
  ).toUpperCase();

  if (raw === "SUCCESS" || raw === "FINISHED_WITH_RETURN") {
    return "FINISHED_WITH_RETURN";
  }
  if (raw === "ERROR" || raw === "FAILED" || raw === "FINISHED_WITH_ERROR") {
    return "FINISHED_WITH_ERROR";
  }

  return raw;
}

async function transactionByHashStatus(hash: `0x${string}`) {
  const tx = await rawRpc<Record<string, any> | null>(
    "eth_getTransactionByHash",
    [hash]
  );

  if (!tx) {
    return {
      status: "PENDING",
      statusCode: 1,
      executionName: ""
    };
  }

  const statusRaw =
    tx.statusName ??
    tx.status_name ??
    tx.status ??
    tx.consensusStatus ??
    tx.consensus_status;

  const status = statusNameFromValue(statusRaw);
  const executionName = executionNameFromTransaction(tx);

  if (
    executionName.includes("FINISHED_WITH_ERROR") ||
    executionName === "ERROR" ||
    executionName === "FAILED"
  ) {
    return {
      status: "FAILED",
      statusCode: status === "FINALIZED" ? 7 : -1,
      executionName
    };
  }

  return {
    status,
    statusCode:
      typeof statusRaw === "number"
        ? statusRaw
        : typeof statusRaw === "string" && /^\d+$/.test(statusRaw)
          ? Number(statusRaw)
          : -1,
    executionName
  };
}

let transactionStatusParamMode: "string" | "object" | null = null;

async function lightweightStatusFallback(hash: `0x${string}`) {
  const call = (params: unknown[]) =>
    rawRpc<{
      status?: string;
      statusCode?: number;
    }>("gen_getTransactionStatus", params);

  if (transactionStatusParamMode === "string") return call([hash]);
  if (transactionStatusParamMode === "object") return call([{ txId: hash }]);

  try {
    const result = await call([hash]);
    transactionStatusParamMode = "string";
    return result;
  } catch (stringError) {
    try {
      const result = await call([{ txId: hash }]);
      transactionStatusParamMode = "object";
      return result;
    } catch {
      throw stringError;
    }
  }
}

export async function getTransactionStatus(hash: `0x${string}`) {
  // StudioNet runtime source of truth for the card:
  // 1) query the full transaction by hash through our same-origin RPC proxy;
  // 2) fall back to gen_getTransactionStatus only if the full lookup fails.
  try {
    const result = await transactionByHashStatus(hash);
    if (result.status !== "UNKNOWN") return result;
  } catch {
    // Fall through to the lightweight endpoint below.
  }

  const result = await lightweightStatusFallback(hash);
  const numeric = Number(result.statusCode ?? -1);
  const status = statusNameFromValue(result.status ?? numeric);

  return {
    status,
    statusCode: Number.isFinite(numeric) ? numeric : -1,
    executionName: ""
  };
}
