# OpsGate V2 R3 — UI FIX2

Fixes a remaining race in post-submit selection.

- When a Submit change transaction is proven finalized by the authoritative workspace change_count, the frontend now immediately loads and selects that newest change.
- This no longer depends on a second effect or transaction-status polling order.
- Existing UI fixes remain: terminal transaction toast auto-hide, Artifact verified card, and disabled execution action while approvals/timelock are incomplete.
- Intelligent contract source is unchanged.


## Final production polish

- Hide `Approve change` once the deterministic approval threshold is already satisfied.
  This avoids offering redundant approvals (for example, approver 2 on a LOW 1-of-2 change)
  while preserving the pipeline attestation action when the same wallet is also the pipeline signer.
