# OpsGate Vercel production fix

Observed on the first Vercel deployment:

```text
Unexpected end of JSON input
Version: viem@2.55.19
```

The production header also displayed:

```text
CONTRACT —
```

while the local build correctly used:

```text
0xBb945d1e8f7072a211F634077742Cb319337AcbF
```

## Fixes in this package

### 1. Empty Vercel environment values no longer erase defaults

`src/config.ts` now trims environment values and validates the contract address.

An empty `VITE_CONTRACT_ADDRESS` therefore falls back to:

```text
0xBb945d1e8f7072a211F634077742Cb319337AcbF
```

An empty `VITE_READ_RPC` falls back to:

```text
/api/rpc
```

### 2. Hardened Vercel RPC proxy

`api/rpc.js` now:

- preserves the original JSON-RPC request body;
- supports parsed, string, Buffer, or raw-stream request bodies;
- never sends an empty response back to viem/genlayer-js;
- returns structured JSON-RPC proxy errors;
- exposes a GET health check;
- disables caching.

### 3. Vercel function timeout

`vercel.json` gives `api/rpc.js` a 30-second function limit.

## Production verification

After redeploy:

1. Open `/api/rpc` in the browser.
2. It should return JSON containing:
   `"ok": true`.
3. Open the OpsGate homepage.
4. Header should show `CONTRACT 0xBb94…AcbF`.
5. Connect the owner wallet.
6. Load Workspace #1.
7. Open Change #1.
8. Confirm `HIGH`, `2/2`, `EXECUTED`.

No new transaction is required for this production smoke test.
