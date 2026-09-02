# OpsGate — Testing

## Backend

**Network**

```text
GenLayer StudioNet
Chain ID 61999
```

**Contract**

```text
0x31103eF15B807fC41775c4c5D9dF98D2F165Ce14
```

**Explorer**

```text
https://explorer-studio.genlayer.com/address/0x31103eF15B807fC41775c4c5D9dF98D2F165Ce14
```

## Local test wallets used

These addresses were used only as runtime test accounts.

### Workspace owner

```text
0x037f58E33c1Ec8fdA272361E0aAC1e31054a1CDE
```

### Approver 1

```text
0x146e44881d35814bA582D265AF5b97ef2695ec8e
```

### Approver 2

```text
0x99BDA24766701CD8F963659B8C32c698dCd148CB
```

A reviewer does not need these wallets. The contract is multi-tenant, so reviewers can create their own workspace with three wallets they control.

---

## Observed full frontend flow

### 1. Create Workspace #1

Connected wallet:

```text
0x037f58E33c1Ec8fdA272361E0aAC1e31054a1CDE
```

Approvers:

```text
Approver 1
0x146e44881d35814bA582D265AF5b97ef2695ec8e

Approver 2
0x99BDA24766701CD8F963659B8C32c698dCd148CB
```

Observed after finalization:

```text
Workspace #1
Owner       = 0x037f58E33c1Ec8fdA272361E0aAC1e31054a1CDE
Approver 1  = 0x146e44881d35814bA582D265AF5b97ef2695ec8e
Approver 2  = 0x99BDA24766701CD8F963659B8C32c698dCd148CB
change_count = 0
```

**Result: PASS**

---

### 2. Submit a HIGH-risk production change

Workspace owner submitted:

```text
Restart the primary production database cluster to apply a storage configuration change. The service will be briefly unavailable, but the operation is reversible without data loss and does not weaken authentication, authorization, encryption, access control, or integrity validation.
```

Observed GenLayer equivalence output:

```json
{"risk":"RISK_HIGH"}
```

Observed frontend state:

```text
Workspace #1
Change #1
Risk = HIGH
Approvals required = 2
Delay = 120 seconds
Status = AWAITING_APPROVAL
```

**Result: PASS**

---

### 3. Approver 1 approves

Connected wallet:

```text
0x146e44881d35814bA582D265AF5b97ef2695ec8e
```

Call:

```text
approve_change(1, 1)
```

Explorer observed:

```text
FINALIZED
SUCCESS
```

Frontend after state refresh:

```text
Approver 1 = APPROVED
Approver 2 = WAITING
Approvals = 1/2
Status = AWAITING_APPROVAL
```

**Result: PASS**

---

### 4. Negative test — owner tries to execute at 1/2

Connected wallet:

```text
0x037f58E33c1Ec8fdA272361E0aAC1e31054a1CDE
```

Call:

```text
mark_change_executed(1, 1)
```

Explorer observed:

```text
FINALIZED consensus
Execution Result: ERROR
Result Code: Rollback

Required approvals not reached
```

The transaction reached consensus but the contract execution rolled back, so state was not mutated.

This is expected behavior and proves the frontend cannot bypass the deterministic approval gate.

**Result: PASS (intentional rejection)**

---

### 5. Approver 2 approves

Connected wallet:

```text
0x99BDA24766701CD8F963659B8C32c698dCd148CB
```

Call:

```text
approve_change(1, 1)
```

Observed frontend state:

```text
Approver 1 = APPROVED
Approver 2 = APPROVED
Approvals = 2/2
Status = READY
```

The HIGH timelock had already elapsed by this point.

**Result: PASS**

---

### 6. Owner marks the change executed

Connected wallet:

```text
0x037f58E33c1Ec8fdA272361E0aAC1e31054a1CDE
```

Call:

```text
mark_change_executed(1, 1)
```

Observed final frontend state:

```text
Risk = HIGH
Approvals = 2/2
Status = EXECUTED
On-chain record is terminal.
```

Observed transaction card:

```text
Mark executed
FINALIZED
```

**Result: PASS**

---

## Runtime summary

```text
Create workspace                         PASS
Role assignment                          PASS
Workspace load                           PASS
Natural-language submission              PASS
GenLayer RISK_HIGH classification        PASS
Approver 1                               PASS
1/2 early execution rejection            PASS
Approver 2                               PASS
2/2 -> READY                             PASS
Owner execution                          PASS
Final EXECUTED state                     PASS
Wallet account auto-sync                 PASS
No-F5 role/state refresh                 PASS
Transaction-card finalization            PASS
```

## Transaction-status hardening discovered during testing

StudioNet runtime testing exposed two frontend-only status issues:

1. a transaction could already be FINALIZED on Explorer while a heavier viem transaction lookup returned `Failed to fetch`;
2. a GenLayer status RPC shape could return an internal backend `psycopg2` parameter mismatch even though contract state was correct.

The final frontend therefore:

```text
uses /api/rpc
uses eth_getTransactionByHash as primary tx lookup
retains a status-query compatibility fallback
reconciles transaction UI with authoritative contract state
refreshes visible state after wallet switch and browser focus
```

The important separation is:

```text
transaction status UI != contract state
```

If contract state proves the successful mutation, the transaction card can safely stop displaying an indefinite spinner.

## Reviewer smoke test

A reviewer can reproduce the core flow with three wallets:

```text
Wallet A = owner
Wallet B = approver 1
Wallet C = approver 2
```

1. Wallet A creates a workspace with B and C.
2. A submits the HIGH example above.
3. B approves.
4. A attempts execution and should receive `Required approvals not reached`.
5. C approves.
6. A executes after the timelock.
7. Confirm final `EXECUTED`.

## Optional multi-tenant isolation test

Create another workspace with a different owner.

Then have the owner of Workspace #1 try:

```text
submit_change(<other workspace id>, ...)
```

Expected rollback:

```text
Only the workspace owner may perform this action
```

This isolation behavior was already proven on the underlying multi-tenant ChangeRisk contract architecture.

## Frontend checklist

Verify before submission:

```text
OpsGate logo visible
Built on GenLayer branding visible
StudioNet / 61999 visible
correct project contract visible
wallet connect works
account switch updates role without F5
Workspace tab works
Change Control tab works
Audit & Policy tab works
workspace create/load works
HIGH risk badge renders
approval nodes reflect chain state
negative execution rolls back
final execution becomes EXECUTED
transaction card stops at FINALIZED on successful mutation
```

## Build / deployment gate

The latest UI was successfully exercised in the local Vite browser runtime.

Before GitHub/Vercel submission, run once from the final extracted package:

```bash
npm install
npm run build
```

Do not claim a separate production build log unless that command completes successfully on the final package.

After Vercel deployment, run a short production smoke test:

```text
connect wallet
load Workspace #1
open Change #1
verify HIGH / 2-of-2 / EXECUTED
```

No new transaction is needed for that smoke test.
