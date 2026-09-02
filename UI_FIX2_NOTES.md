# OpsGate V2 R3 — UI FIX2

Fixes a remaining race in post-submit selection.

- When a Submit change transaction is proven finalized by the authoritative workspace change_count, the frontend now immediately loads and selects that newest change.
- This no longer depends on a second effect or transaction-status polling order.
- Existing UI fixes remain: terminal transaction toast auto-hide, Artifact verified card, and disabled execution action while approvals/timelock are incomplete.
- Intelligent contract source is unchanged.
