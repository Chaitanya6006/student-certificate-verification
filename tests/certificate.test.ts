/**
 * Integration tests for the Certificate Registry contract, run against the
 * LOCAL devnet (docker compose up -d --wait).
 *
 * These are REAL tests: every assertion goes through the full stack — wallet,
 * zero-knowledge proof generation, transaction submission and the indexer.
 *
 * Covered:
 *   (a) circuit logic      — issue / verify / revoke / duplicate / non-admin
 *   (b) state transitions  — ledger maps, flags and disclosed results
 *   (c) PRIVACY            — private document content never appears in any
 *                            on-chain output or event
 */
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { execSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';

import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

import { NETWORK_CONFIGS, type NetworkConfig } from '../src/network';
import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from '../src/wallet';
import { deriveAdminHash } from '../src/admin';
import { toDocBytes, certIdToBytes, serializeDocument, type CertificateDocument } from '../src/document';
import { getCertificate, getLastVerification, readLedger } from '../src/ledger';

// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const zkConfigPath = path.join(projectRoot, 'contracts', 'managed', 'certificate');
const contractPath = path.join(zkConfigPath, 'contract', 'index.js');

const networkConfig: NetworkConfig = NETWORK_CONFIGS.undeployed;
const PRIVATE_STATE_ID = 'certificatePrivateStateTest';

const adminSecret = crypto.randomBytes(32);
const adminHash = deriveAdminHash(adminSecret);

// ── Test fixtures ────────────────────────────────────────────────────────────
// The "document" is the PRIVATE witness: it contains the student's name,
// course and grade. It must NEVER appear in any on-chain output.

const DOC_A = serializeDocument({
  certId: 'CERT-2026-0001',
  studentName: 'Priya Sharma',
  institution: 'SPPU — Pune',
  course: 'B.E. Computer Science',
  grade: '9.2 CGPA',
  issuedAt: '2026-06-01',
} satisfies CertificateDocument);

const DOC_A_TAMPERED = serializeDocument({
  certId: 'CERT-2026-0001',
  studentName: 'Priya Sharma',
  institution: 'SPPU — Pune',
  course: 'B.E. Computer Science',
  grade: '4.0 CGPA', // ← forged grade
  issuedAt: '2026-06-01',
} satisfies CertificateDocument);

const CERT_ID = certIdToBytes('CERT-2026-0001');

const PRIVATE_MARKERS = ['Priya Sharma', '9.2 CGPA', '4.0 CGPA', 'B.E. Computer Science'];

let walletCtx: WalletContext;
let providers: any;
let deployed: any;
let contractAddress: string;

function sha256(b: Uint8Array): Uint8Array {
  return crypto.createHash('sha256').update(b).digest();
}

beforeAll(async () => {
  // 1. Devnet up.
  execSync('docker compose up -d --wait', { cwd: projectRoot, stdio: 'inherit', timeout: 600_000 });

  // 2. Contract must be compiled (npm run compile).
  if (!fs.existsSync(contractPath)) {
    throw new Error('Contract not compiled — run `npm run compile` first');
  }

  const Certificate = await import(pathToFileURL(contractPath).href);
  const compiledContract = CompiledContract.make('certificate', Certificate.Contract).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );

  // 3. Wallet (genesis seed on the local devnet).
  walletCtx = await createWallet({ network: 'undeployed', networkConfig, seed: '0000000000000000000000000000000000000000000000000000000000000001' });
  await walletCtx.wallet.waitForSyncedState();
  await persistWalletState('undeployed', walletCtx);

  // 4. DUST registration (needed to pay for transactions).
  const state = await walletCtx.wallet.waitForSyncedState();
  const unregistered = state.unshielded.availableCoins.filter((c: any) => !c.meta?.registeredForDustGeneration);
  if (unregistered.length > 0) {
    const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
      unregistered,
      walletCtx.unshieldedKeystore.getPublicKey(),
      (payload) => walletCtx.unshieldedKeystore.signData(payload),
    );
    await walletCtx.wallet.submitTransaction(await walletCtx.wallet.finalizeRecipe(recipe));
  }
  await walletCtx.wallet.waitForSyncedState();

  const privateStatePassword = 'Local-Devnet-Development-Placeholder-1';
  const walletProvider = {
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'certificate-state-test',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  // 5. Deploy with the test admin hash.
  deployed = await deployContract(providers, {
    compiledContract: compiledContract as any,
    args: [adminHash],
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });
  contractAddress = deployed.deployTxData.public.contractAddress;
});

afterAll(async () => {
  if (walletCtx) await walletCtx.wallet.stop();
});

describe('circuit logic — certificate issuance', () => {
  it('admin issues a certificate; the on-chain docHash equals SHA-256 of the document', async () => {
    const docBytes = toDocBytes(DOC_A);
    const issuedAt = BigInt(Date.now());

    const tx = await deployed.callTx.issueCertificate(adminSecret, CERT_ID, 'SPPU-2026-0001', 'SPPU — Pune', docBytes, issuedAt);
    expect(tx.public.blockHeight).toBeGreaterThan(0n);

    const cert = await getCertificate(contractAddress, networkConfig, 'CERT-2026-0001');
    expect(cert).not.toBeNull();
    expect(cert!.studentId).toBe('SPPU-2026-0001');
    expect(cert!.institution).toBe('SPPU — Pune');
    expect(cert!.revoked).toBe(false);
    expect(cert!.issuedAt).toBe(issuedAt);
    // The ledger digest must exactly equal SHA-256 of the private document.
    expect(cert!.docHash).toBe(sha256(docBytes).toString('hex'));
  });

  it('rejects a duplicate certificate ID', async () => {
    await expect(
      deployed.callTx.issueCertificate(
        adminSecret,
        CERT_ID,
        'SPPU-2026-0001',
        'SPPU — Pune',
        toDocBytes(DOC_A),
        BigInt(Date.now()),
      ),
    ).rejects.toThrow();
  });

  it('rejects a non-admin issuer', async () => {
    const rogueSecret = crypto.randomBytes(32);
    await expect(
      deployed.callTx.issueCertificate(
        rogueSecret,
        certIdToBytes('CERT-2026-9999'),
        'SPPU-2026-9999',
        'Somewhere Else',
        toDocBytes(DOC_A),
        BigInt(Date.now()),
      ),
    ).rejects.toThrow();
  });
});

describe('circuit logic — verification', () => {
  it('verifies an authentic document as VALID', async () => {
    await deployed.callTx.verifyCertificate(CERT_ID, toDocBytes(DOC_A));

    const result = await getLastVerification(contractAddress, networkConfig);
    expect(result).not.toBeNull();
    expect(result!.certId).toBe('CERT-2026-0001');
    expect(result!.verified).toBe(true);
    expect(result!.revoked).toBe(false);
  });

  it('detects a FAKE certificate (tampered document) as INVALID', async () => {
    await deployed.callTx.verifyCertificate(CERT_ID, toDocBytes(DOC_A_TAMPERED));

    const result = await getLastVerification(contractAddress, networkConfig);
    expect(result).not.toBeNull();
    expect(result!.certId).toBe('CERT-2026-0001');
    expect(result!.verified).toBe(false);
    expect(result!.revoked).toBe(false);
  });

  it('reports INVALID for a certificate that does not exist', async () => {
    await deployed.callTx.verifyCertificate(certIdToBytes('CERT-DOES-NOT-EXIST'), toDocBytes(DOC_A));

    const result = await getLastVerification(contractAddress, networkConfig);
    expect(result).not.toBeNull();
    expect(result!.verified).toBe(false);
  });
});

describe('state transitions — revocation', () => {
  it('admin revokes a certificate; verify then reports REVOKED', async () => {
    await deployed.callTx.revokeCertificate(adminSecret, CERT_ID);

    const cert = await getCertificate(contractAddress, networkConfig, 'CERT-2026-0001');
    expect(cert!.revoked).toBe(true);

    // Even with the ORIGINAL authentic document, a revoked certificate must
    // never verify as valid.
    await deployed.callTx.verifyCertificate(CERT_ID, toDocBytes(DOC_A));
    const result = await getLastVerification(contractAddress, networkConfig);
    expect(result!.revoked).toBe(true);
  });

  it('rejects revoking a non-admin caller', async () => {
    const rogueSecret = crypto.randomBytes(32);
    await expect(
      deployed.callTx.revokeCertificate(rogueSecret, CERT_ID),
    ).rejects.toThrow();
  });
});

describe('privacy — private inputs are never exposed', () => {
  it('the student name/grade/course never appear anywhere on-chain', async () => {
    // The full public ledger state (all maps + fields), serialized to text.
    const ledger = await readLedger(contractAddress, networkConfig);
    expect(ledger).not.toBeNull();

    const serialized = JSON.stringify(
      {
        certificates: Array.from(ledger!.certificates),
        lastVerification: ledger!.lastVerification,
        adminHash: ledger!.adminHash,
      },
      // bigint fields (issuedAt) cannot be JSON.stringify'd by default.
      (_, v) => (typeof v === 'bigint' ? v.toString() : v),
    );

    for (const marker of PRIVATE_MARKERS) {
      expect(serialized).not.toContain(marker);
    }
    // The on-chain record holds only a SHA-256 digest of the document — never
    // the document or any substring of it.
    expect(serialized).not.toContain('studentName');
    expect(serialized).not.toContain('grade');
    expect(serialized).toContain('docHash');
  });

  it('the admin secret never appears on-chain', async () => {
    const ledger = await readLedger(contractAddress, networkConfig);
    expect(ledger).not.toBeNull();
    const serialized = JSON.stringify(
      { certificates: Array.from(ledger!.certificates), lastVerification: ledger!.lastVerification, adminHash: ledger!.adminHash },
      (_, v) => (typeof v === 'bigint' ? v.toString() : v),
    );
    expect(serialized).not.toContain(adminSecret.toString('hex'));
  });
});
