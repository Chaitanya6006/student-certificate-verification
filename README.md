# Student Certificate Verification dApp

A tamper-proof certificate registry built on the [Midnight Network](https://midnight.network/). An issuing authority stores only a **SHA-256 digest** of each certificate on-chain; the document itself — student name, course, grade — is proved in **zero knowledge** and never revealed. Anyone can verify a certificate against the public record; forged or revoked certificates are detected instantly.

INTO the Midnight — SPPU bootcamp project.

[![Generic badge](https://img.shields.io/badge/Compact%20Compiler-0.31.1-1abc9c.svg)](https://shields.io/)
[![Generic badge](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://shields.io/)
[![Generic badge](https://img.shields.io/badge/Midnight.js-4.1.1-yellow.svg)](https://shields.io/)

## Live on Preview

| | |
|---|---|
| **Contract address** | `657e40da5bbacca8135e0e8a02fe2feccc6d1b85db06082085cd1fc2aab2025b` |
| **Network** | Midnight **Preview** |
| **Deployer** | `mn_addr_preview1xcq5nqld5u6wmgcss4zn2p7q2w0ldu9srz88rxvqrvvdg704rsnswxkeyw` |
| **Faucet** | https://faucet.preview.midnight.network |

### Verify on-chain (any machine, no SDK)

```bash
curl -s "https://indexer.preview.midnight.network/api/v4/graphql" \
  -H 'content-type: application/json' \
  -d '{"query":"{ contract(address: \"657e40da5bbacca8135e0e8a02fe2feccc6d1b85db06082085cd1fc2aab2025b\") { address state } }"}'
```

A non-null `state` confirms the contract exists on-chain. 8 transactions are recorded against the contract — the first (indexer id `14904`) is the deployment transaction; the full hash list is in [`docs/onchain-evidence.md`](docs/onchain-evidence.md).

## Initial Product Idea

A university-grade **scholastic credential registry** where issuing institutions onboard once (registering a zero-knowledge admin credential) and then issue, verify and revoke student certificates entirely through a web app — no paperwork, no shared databases. Students get a private link containing their certificate (grade, name, course) and employers or other universities verify it in zero knowledge against the public registry: the check proves "the document you hold is the one the university issued" without revealing anything beyond a VALID/REVOKED/INVALID answer. Institutes keep full control (issue + revoke rights), students keep full privacy of their marks, and the ledger catches forged, altered or revoked certificates instantly.

## The Problem It Solves

Paper certificates are forged by altering names, marks and grades. Central databases can be silently rewritten. Blockchain fixes *tamper-evidence*, but a public chain would leak every student's private data. Midnight's **zero-knowledge runtime** solves both at once: commitments are public, records are private.

## How It Works

```
Issuing institute (admin)                 Anyone (student, employer)
┌──────────────────────────┐              ┌──────────────────────────────┐
│ certId, studentId,       │              │ certId + certificate doc     │
│ institution, doc, secret │              │ (name, course, grade...)     │
│            │             │              │            │                 │
│            ▼             │              │            ▼                 │
│  issueCertificate(zk)    │              │  verifyCertificate(zk)       │
│  docHash = SHA-256(doc)  │╌╌╌╌╌╌╌╌╌╌╌╌╌│  proof: SHA-256(doc) ==      │
│  only docHash goes       │  on-chain   │  ledger docHash, but never   │
│  on-chain                │╌╌╌╌╌╌╌╌╌╌╌╌╌│  reveal doc                 │
└──────────────────────────┘              └──────────────────────────────┘
```

1. **Issue.** The admin proves knowledge of the admin secret (a zero-knowledge domain-separated credential), commits `sha256(document)` and public fields (`certId`, `studentId`, `institution`, `issuedAt`) to the ledger.
2. **Verify.** Anyone submits the certificate ID plus *their copy of the document*. The `verifyCertificate` circuit proves in zero knowledge that `SHA-256(doc) == stored docHash`. **The document itself never leaves the verifier's device.**
3. **Revoke.** The admin proves the secret again and flips `revoked = true`.

Tampering scenario: fake doc ⇒ hash mismatch ⇒ `INVALID`. Revoked ⇒ `REVOKED`. Unknown ID ⇒ `INVALID`.

## Privacy — Why the grade never leaks

- The ledger exposes only: `certId`, `studentId`, `institution`, `docHash`, `issuedAt`, `revoked`, `lastVerification`, `adminHash`.
- The raw document (512-byte field) enters the circuit **only as a witness**: it is consumed inside the zero-knowledge proof and provably consistent with the on-chain hash — nothing else.
- The admin secret is a 32-byte value hashed with a domain separator (`sha256("cert:admin:" ∥ zeros ∥ secret)`); only that digest is stored on-chain. It lives exclusively in `.certificate-admin-secret.json` (gitignored) or in your wallet's memory in the web UI.
- The test suite proves this: `tests/certificate.test.ts` inspects every public state after issuance and asserts the name/grade strings are **absent from the ledger**.

## Public State vs Private Witness

| | On-chain (public state) | In the proof (private witness) |
|---|---|---|
| **What is it** | Data that anyone can read from the ledger | Data that only the prover sees; consumed inside the circuit |
| **This contract** | `certId`, `studentId`, `institution`, `docHash`, `issuedAt`, `revoked`, `lastVerification`, `adminHash` | `docBytes` (the full 512-byte document: name, course, grade) and `adminSecret` |
| **What the verifier learns** | That a certificate with this ID exists, was issued on date X by institute Y, and its content hashes to `docHash` | Nothing about `docBytes` — only that `SHA-256(docBytes)` equals the on-chain `docHash` |
| **Integrity** | Public data cannot be modified without the node network accepting the transition (blockchain) | The prover cannot cheat: the circuit enforces the hash equality, so a fake document yields `INVALID` |

Each circuit declares `witnesses: { … }` (private) and `public` outputs explicitly in `contracts/certificate.compact`;
the compiler generates the ZK circuits (see `contracts/managed/certificate/keys/`) from that split.

## Circuits (`contracts/certificate.compact`)

| Circuit | Witness (private) | Public | Enforced by the circuit |
|---|---|---|---|
| `issueCertificate` | `docBytes: Bytes<512>`, `adminSecret: Bytes<32>` | `certId`, `studentId`, `institution`, `issuedAt` | admin credential valid · unique ID · doc = `Bytes<512>` |
| `verifyCertificate` | `docBytes: Bytes<512>` | `certId` | certificate exists · certifies `SHA-256(doc)` against stored `docHash` (records VALID/INVALID/REVOKED result) |
| `revokeCertificate` | `adminSecret: Bytes<32>` | `certId` | admin credential, certificate exists |

## Project Structure

```
student-certificate-verification/
├── contracts/
│   └── certificate.compact        # The Midnight smart contract (Compact)
├── src/                           # CLI + deployment tooling (TypeScript)
│   ├── admin.ts                   #   admin secret creation/loading
│   ├── cli.ts                     #   issue / verify / revoke / list / status / balance
│   ├── deploy.ts                   #   devnet + Preview deployment (faucet-aware)
│   ├── document.ts                #   512-byte document padding, hashing
│   ├── ledger.ts                   #   read-only indexer access
│   ├── network.ts                  #   per-network config (preview/preprod/devnet)
│   ├── setup.ts                    #   one-shot funding + deploy
│   ├── wallet.ts / wallet-state.ts #   wallet persistence
├── frontend/                       # React (Vite) dApp
│   ├── src/midnight/midnight.ts    #   DApp Connector v4 providers (wallet proving)
│   ├── src/hooks/useMidnight.ts    #   wallet connect state machine
│   └── src/components/…            #   Issue / Verify / Revoke / Ledger panels
├── tests/certificate.test.ts       # 10 integration tests (real proofs, local devnet)
├── compose.yml                     # local devnet (node, indexer, proof-server)
└── scripts/frontend-keys.mjs      # copies ZK artifacts for the browser
```

## Prerequisites

- Node.js 22+
- Docker (local devnet + local proof server)
- Midnight Wallet browser extension with the **DApp Connector API 4.x** (frontend only)
- Free tNIGHT from https://faucet.preview.midnight.network (one-time, ~30s to arrive)

## Setup

```bash
npm install
npm run compile          # compiles certificate.compact -> contracts/managed/
docker compose up -d --wait   # local devnet (node 9944, indexer 8088, proof server 6300)
```

Note: `npm run frontend:build` also runs `frontend:keys`, which copies the compiled circuits to `frontend/public/managed/certificate` for in-browser proving.

## Test

```bash
npm test
```
Runs the 10 integration tests against the local devnet with real proofs (`docker compose up -d --wait` must be running). Covers: happy-path issuance, SHA-256 correctness, duplicate IDs, rogue admins, valid/fake/missing verification, revocation, and the privacy assertions above.

## Deploy (real network)

```bash
npm run deploy -- --network preview
#   1. creates a fresh wallet seed (persisted under .midnight-state.json)
#   2. prints the wallet address and asks you to request tNIGHT at the faucet
#   3. waits (default 120s — override with MIDNIGHT_FAUCET_TIMEOUT_MS)
#   4. registers DUST, deploys the contract with your adminHash
```

The address is saved to `.midnight-state.json` and used by the CLI automatically.

## CLI

```bash
npm run cli -- issue   --id CERT-2026-0001 --student "P. Sharma" --institution "SPPU — Pune" --course "CS" --grade "A+"
npm run cli -- verify  --id CERT-2026-0001                       # fake document → INVALID
npm run cli -- verify  --id CERT-2026-0001 --doc v1doc.json      # real document → VALID
npm run cli -- revoke  --id CERT-2026-0001
npm run cli -- list                                              # public ledger (no private fields)
npm run cli -- status --id CERT-2026-0001
```

## Web App

```bash
cp frontend/.env.example frontend/.env   # add VITE_CONTRACT_ADDRESS
npm run frontend:dev                     # http://localhost:5173
```

- Connect the Midnight Wallet extension (must be set to the **preview** network).
- The wallet's DApp Connector v4 API drives discovery, connection, transaction balancing and submission.
- ZK artifacts are fetched by your browser from `/managed/certificate` (keep `/keys/*.prover`, `*.bzkir`, `*.vkey` served).

Deploy the static bundle to Vercel/Netlify: the included `vercel.json` / `netlify.toml` build the app and publish `frontend/dist`. Remember to set `VITE_CONTRACT_ADDRESS` (and `VITE_NETWORK`) as build-time environment variables in your hosting dashboard.

## Troubleshooting

- **Preview RPC drops** (`disconnected from wss://rpc.preview.midnight.network`): the public RPC sometimes closes sockets during submit-and-watch. Deploy and CLI automatically retry (`runCall`, DUST registration loop). If you see it in custom scripts, the same retry is the pattern.
- **`expected instance of StateValue`**: two copies of `onchain-runtime-v3` got installed. `package.json` pins `@midnight-ntwrk/onchain-runtime-v3: 3.0.0` via `overrides` — reinstall with a clean `node_modules` and `package-lock` and never reintroduce a second copy.
- **Faucet waits forever**: the faucet step is intentionally manual (anti-abuse). Use `MIDNIGHT_FAUCET_TIMEOUT_MS=120000`.

### Browser runtime (wallet connect) — known gotchas, all fixed in this repo

- **"Expected ZK artifact… text/html"** — the Midnight Wallet fetches verifier keys as `keys/<circuit>.verifier`; `scripts/frontend-keys.mjs` serves the compiler's original layout (plus `<circuit>.vkey` for midnight-js).
- **"No private state found at private state ID"** — `findDeployedContract` requires `initialPrivateState`; ours is statically `{}`, passed explicitly in `frontend/src/midnight/midnight.ts`.
- **"Network ID has not been configured"** — call `setNetworkId('preview')` (`@midnight-ntwrk/midnight-js-network-id`) before any wallet operation.
- **`Buffer is not defined`** — the compact runtime needs Node globals; `vite-plugin-node-polyfills` is configured in `frontend/vite.config.ts` (`globals: { Buffer, process, global }`).

## Roadmap

- [x] Compact contract with issue/verify/revoke
- [x] Devnet integration test suite (10 tests, real proofs)
- [x] CLI + Preview deployment
- [x] React front end with wallet connect
- [ ] Vercel/Netlify live URL (copy CI env vars)
- [ ] Student-facing "check my result" view + QR codes
- [ ] Batch issuance for many students (multiple `issueCertificate` per transaction)

## License

MIT