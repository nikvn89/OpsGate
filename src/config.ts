export const CONTRACT_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}` | undefined) ??
  "0xBb945d1e8f7072a211F634077742Cb319337AcbF";

export const READ_RPC =
  (import.meta.env.VITE_READ_RPC as string | undefined) ?? "/api/rpc";

export const DEMO_WORKSPACE_ID = Number(
  import.meta.env.VITE_DEMO_WORKSPACE_ID ?? "0"
);

export const READ_STATE_STATUS =
  (import.meta.env.VITE_READ_STATE_STATUS as string | undefined) ?? "finalized";

export const EXPLORER_BASE = "https://explorer-studio.genlayer.com";
export const CONTRACT_EXPLORER_URL = `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`;
