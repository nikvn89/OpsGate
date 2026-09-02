# OpsGate V2 R3 runtime E2E status

Contract: `0x31103eF15B807fC41775c4c5D9dF98D2F165Ce14`

Contract source SHA256: `c5901da704be949f9a618a769ad5939e0ef65a83edf16183b6833d67e0aaf6dc`

## Observed runtime checks

- Workspace creation: PASS
- LOW artifact assessment: PASS (`LOW`)
- LOW approval threshold / zero-second timelock: PASS
- LOW pipeline execution: PASS
- HIGH artifact assessment: PASS (`HIGH`)
- HIGH 1/2 approval does not start timelock: PASS
- HIGH final approval anchors 120-second timelock: PASS
- HIGH pre-timelock execution: rejected as expected
- HIGH correct-digest pipeline execution: PASS
- CRITICAL artifact assessment: PASS (`CRITICAL`)
- CRITICAL final approval anchors 600-second timelock: PASS
- Unauthorized pipeline execution attempt: rejected as expected
- CRITICAL wrong executed digest after timelock: rejected as expected
- CRITICAL correct executed digest after timelock: PASS
- M2 anchoring set: PASS
  - neutral/reassuring LOW pair -> LOW / LOW
  - neutral/reassuring HIGH pair -> HIGH / HIGH
  - neutral/reassuring CRITICAL pair -> CRITICAL / CRITICAL

## UI fixes applied after runtime testing

1. Terminal transaction toast auto-hides 8 seconds after reaching a terminal status.
2. Artifact result card redesigned into a light verified-artifact panel with compact digest, copy, and source actions.
3. A newly finalized submitted change is automatically selected.
4. Pipeline attestation is disabled until approvals are complete and the timelock has elapsed; the UI shows the availability countdown/time.

The deployed contract source is unchanged by these frontend fixes.


## Production smoke

- Vercel read/load workspace: PASS
- Wallet switch and role refresh without reload: PASS
- Vercel approval write: PASS
- Console smoke after clear/navigation/wallet switch: PASS (no new errors observed)
- Final UI polish: redundant approval button hidden after threshold reached
