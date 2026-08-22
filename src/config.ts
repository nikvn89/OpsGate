const DEFAULT_CONTRACT_ADDRESS =
  "0xBb945d1e8f7072a211F634077742Cb319337AcbF" as const;

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const envContract = String(
  import.meta.env.VITE_CONTRACT_ADDRESS ?? ""
).trim();

export const CONTRACT_ADDRESS =
  (ADDRESS_RE.test(envContract)
    ? envContract
    : DEFAULT_CONTRACT_ADDRESS) as `0x${string}`;

const envReadRpc = String(import.meta.env.VITE_READ_RPC ?? "").trim();

export const READ_RPC = envReadRpc || "/api/rpc";

const envDemoWorkspace = String(
  import.meta.env.VITE_DEMO_WORKSPACE_ID ?? ""
).trim();

export const DEMO_WORKSPACE_ID = Number(envDemoWorkspace || "0");

const envReadState = String(
  import.meta.env.VITE_READ_STATE_STATUS ?? ""
).trim();

export const READ_STATE_STATUS = envReadState || "finalized";

export const EXPLORER_BASE = "https://explorer-studio.genlayer.com";
export const CONTRACT_EXPLORER_URL =
  `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`;
