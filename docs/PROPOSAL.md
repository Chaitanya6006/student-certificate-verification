# Product Proposal — Student Certificate Verification on Midnight

**Bootcamp:** INTO the Midnight — SPPU
**Idea from the provided list:** verifiable academic credentials with privacy (ZKP-based certificate registry)
**Status:** implemented and deployed to Midnight Preview

## 1. Problem

Paper certificates are forged by editing names, marks and grades; central university databases can be silently altered. Publishing certificates on a **transparent** blockchain solves tampering but leaks every student's private data (grades, institution history). Universities need trustworthy credentials; students and employers need them without exposing private academic records.

## 2. Proposal

A **zero-knowledge certificate registry** on the Midnight Network:

- Universities/institutes onboard once (admin credential) and issue certificates with one click.
- Only a SHA-256 digest of each certificate plus public fields (certificate ID, student ID, institution, issue date, status) is ever stored on-chain.
- The full document (name, course, grade) exists only on the student's side and is proven in zero knowledge against the digest.
- Anyone with a certificate copy can verify it for FREE — the document never leaves the verifier's device; the answer is only VALID / REVOKED / INVALID.
- Institutes keep full control: issue and revoke rights are cryptographically enforced (only the admin secret holder can write).

## 3. Why Midnight (privacy model)

| | Transparency chain | Midnight (this dApp) |
|---|---|---|
| Tamper-evident registry | ✓ | ✓ |
| Document hash committed on-chain | ✓ | ✓ |
| Grades / names hidden from the chain | ✗ (leaked) | ✓ (witness-only) |
| Who verified what | visible | hidden (shielded txs) |

Observer can learn: existence of the certificate, its ID/student ID/institution/date, digest, status.
Observer cannot learn: name, course, grade, admin secret, identifiers of transacting users.

## 4. Scope (delivered)

- Compact contract: `issueCertificate`, `verifyCertificate`, `revokeCertificate` (each proves its own property).
- 10 integration tests with real proofs (privacy asserted mechanically).
- CLI + deployment tooling (devnet + Preview, faucet-aware).
- React dApp with Midnight Wallet (DApp Connector v4): issue / verify / revoke / ledger.
- CI/CD: GitHub Actions compiles, tests, builds and deploys the web app to GitHub Pages.
- Live on Preview: contract `657e40da5bbacca8135e0e8a02fe2feccc6d1b85db06082085cd1fc2aab2025b`.

## 5. Out of scope / future

- Batch issuance, QR-based sharing, student self-service portal, PDF signing/embedding, preprod/mainnet rollout.