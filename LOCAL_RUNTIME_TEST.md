# OpsGate V2 R3 local runtime

Contract: `0x31103eF15B807fC41775c4c5D9dF98D2F165Ce14`

Wallet mapping:
- Owner/deployer: `0x6276095FAEA15108740445ff277fdA8c304657F4`
- Approver 1: `0x037f58E33c1Ec8fdA272361E0aAC1e31054a1CDE`
- Approver 2 + pipeline signer: `0x146e44881d35814bA582D265AF5b97ef2695ec8e`

Run:
```bash
npm install
npm run dev
```

The Vite development server proxies `/api/rpc` to StudioNet, so local browser reads still target the deployed StudioNet contract.

A valid submit requires a public commit-pinned GitHub/GitLab artifact URI and the same 40-hex commit/object id in the immutable ref position.
