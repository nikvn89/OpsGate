# OpsGate

**Production change control, powered by GenLayer consensus.**

OpsGate is a multi-tenant GenLayer dApp for risk-aware production change control. A workspace owner submits a natural-language production change, GenLayer validators classify the **declared operational risk**, and the contract deterministically enforces the approval threshold and timelock before execution may be recorded.

## Live backend

**Network:** GenLayer StudioNet  
**Chain ID:** `61999`

**Project contract**

```text
0x31103eF15B807fC41775c4c5D9dF98D2F165Ce14
```

**Explorer**

```text
https://explorer-studio.genlayer.com/address/0x31103eF15B807fC41775c4c5D9dF98D2F165Ce14
```

OpsGate intentionally uses a separate deployment from the standalone `ChangeRisk` Intelligent Contract submission.

## Why GenLayer

Production changes are usually written in natural language:

- restart a production database;
- disable a security control;
- rotate infrastructure configuration;
- perform a destructive data migration;
- deploy a behavior-changing release.

A deterministic smart contract can enforce approvals and time delays, but it cannot reliably interpret the operational meaning of that prose.

OpsGate separates the problem into two layers:

```text
GenLayer validators -> semantic risk classification
Contract            -> deterministic approval + timelock gate
Frontend            -> submit, read, display, and audit
```

The semantic output is intentionally narrow:

```text
RISK_LOW
RISK_HIGH
RISK_CRITICAL
```

The contract then applies fixed deterministic consequences:

| Risk | Required approvals | Demo timelock |
|---|---:|---:|
| `RISK_LOW` | 1 | 0s |
| `RISK_HIGH` | 2 | 120s |
| `RISK_CRITICAL` | 2 | 600s |

The AI does **not** choose the number of approvals or the timelock.

## Multi-tenant architecture

There is no global application owner.

Any wallet can create its own isolated workspace:

```text
create_workspace(approver_1, approver_2)
```

The caller becomes owner only of that workspace.

Each workspace keeps isolated:

```text
owner
approver_1
approver_2
change_counter
last_submission_at
changes
approval state
execution state
```

This makes OpsGate reviewer-friendly: judges can create a fresh workspace using their own wallets and do not depend on deployer-controlled demo accounts.

## dApp flow

```text
1. Create / open workspace
2. Submit production change
3. GenLayer consensus classifies risk
4. Independent approvers approve
5. Contract enforces approval threshold + timelock
6. Workspace owner marks the change executed
7. Append-only history remains visible
```

## Portal-inspired interface

OpsGate uses a compact three-tab dashboard to avoid a long scrolling page:

```text
Workspace
Change Control
Audit & Policy
```

The interface uses GenLayer-inspired light gradients, cyan/violet/lime accents, a consensus-orbit visual, and clear role-aware controls.

### Workspace

- create isolated workspace;
- open workspace by id;
- load the connected wallet's latest workspace;
- show owner and approver roles.

### Change Control

- submit a natural-language production change;
- display the GenLayer consensus risk result;
- show deterministic approvals and delay;
- display approver state;
- display `execute_after`;
- approve or mark executed according to the connected wallet role.

### Audit & Policy

- load the append-only change feed;
- reopen previous changes;
- display fixed LOW/HIGH/CRITICAL policy consequences.

## Contract is the source of truth

The frontend never decides:

- risk;
- required approvals;
- delay;
- readiness;
- authorization;
- executed state.

The UI only submits writes, reads contract state, renders the result, and shows a display countdown from the absolute on-chain `execute_after`.

`mark_change_executed()` remains the authoritative enforcement point.

## Wallet UX

The app uses standard EVM wallet methods rather than requiring a wallet Snap:

```text
eth_requestAccounts
eth_chainId
wallet_switchEthereumChain
wallet_addEthereumChain
```

Wallet switching is automatically detected.

When the user changes MetaMask account, OpsGate re-reads the currently open workspace/change and updates the visible role without requiring an F5 refresh.

The app also refreshes state when the browser tab regains focus.

## RPC and transaction handling

Reads use the bundled same-origin proxy:

```text
/api/rpc
```

which forwards to:

```text
https://studio.genlayer.com/api
```

The transaction UI is hardened for observed StudioNet behavior:

- write controls lock while a transaction is pending;
- the transaction card polls status through the proxy;
- `eth_getTransactionByHash` is used as the primary transaction lookup;
- a compatibility fallback is retained for GenLayer status queries;
- authoritative contract state can prove a successful mutation and reconcile the transaction card;
- wallet switching and focus refreshes re-read contract state;
- failed execution does not mutate contract state.

This was added after real StudioNet runtime testing exposed inconsistent transaction-status responses even when the contract state had already finalized correctly.

## Verified local runtime flow

The complete HIGH-risk flow was exercised against the project backend.

Observed:

```text
Create workspace                         PASS
Load isolated roles                     PASS
Submit natural-language change          PASS
GenLayer consensus -> RISK_HIGH         PASS
Approver 1 approval                     PASS
Owner execute at 1/2 -> rollback        PASS
Approver 2 approval                     PASS
2/2 approvals -> READY                  PASS
Owner final execution                   PASS
Final state -> EXECUTED                 PASS
Wallet auto-sync without F5             PASS
Transaction card -> FINALIZED           PASS
```

See [`TESTING.md`](./TESTING.md) for the exact test case and observed evidence.

## Repository structure

```text
OpsGate/
├─ api/
│  └─ rpc.js
├─ contract/
│  └─ ChangeRisk.py
├─ public/
│  ├─ genlayer-logo.jpg
│  └─ opsgate-logo.svg
├─ src/
│  ├─ App.tsx
│  ├─ config.ts
│  ├─ errors.ts
│  ├─ genlayer.ts
│  ├─ main.tsx
│  ├─ styles.css
│  ├─ types.ts
│  └─ vite-env.d.ts
├─ .env.example
├─ .gitignore
├─ index.html
├─ package.json
├─ README.md
├─ TESTING.md
├─ PROJECT_SUBMISSION_NOTE.txt
├─ tsconfig.app.json
├─ tsconfig.json
├─ tsconfig.node.json
└─ vite.config.ts
```

## Local development

```bash
npm install
npm run build
npm run dev
```

Vite normally serves the app at:

```text
http://localhost:5173
```

## Environment

The defaults are already configured in `.env.example`:

```text
VITE_CONTRACT_ADDRESS=0x31103eF15B807fC41775c4c5D9dF98D2F165Ce14
VITE_READ_RPC=/api/rpc
VITE_DEMO_WORKSPACE_ID=0
VITE_READ_STATE_STATUS=finalized
```

## Vercel deployment

1. Push this repository to GitHub.
2. Import it into Vercel.
3. Use the default Vite build settings.
4. No RPC secret is required.
5. `/api/rpc` is deployed as the Vercel serverless RPC proxy.

After deployment, repeat the short smoke test in `TESTING.md`.

## Honest scope

OpsGate evaluates the **declared description** of a production change.

It does **not** prove that the real-world operation performed by a human or machine actually matches that declaration.

OpsGate guarantees a narrower on-chain property:

- immutable submitted descriptions;
- validator-consensus risk classification;
- deterministic approval requirements;
- deterministic timelock requirements;
- workspace-scoped authorization;
- append-only execution records.

It is an accountability and approval-gating primitive, not an off-chain truth oracle.

## Contract source integrity

The bundled `contract/ChangeRisk.py` SHA-256 is:

```text
f6581757cc43e62b2e33b326c1ac0e01f12e67170f120a4844c47044ab854d79
```
