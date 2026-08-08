/**
 * CLI for the Certificate Registry contract.
 *
 *   npm run cli -- issue  --id <certId> --student <name> --institution <inst> [--doc <file>]
 *   npm run cli -- verify --id <certId> [--doc <file>]
 *   npm run cli -- revoke --id <certId>
 *   npm run cli -- list
 *   npm run cli -- status --id <certId>
 *   npm run cli -- balance
 *
 * PRIVACY: every private input (the admin secret, the document bytes) is used
 * only inside the proof. Nothing private is ever printed to the console or
 * stored anywhere except inside the generated zero-knowledge proof.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { resolveNetwork, getOrCreateSeed, getDeployment } from './network';
import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from './wallet';
import { loadOrCreateAdminSecret } from './admin';
import { toDocBytes, certIdToBytes, serializeDocument, type CertificateDocument } from './document';
import { getCertificate, getLastVerification, listCertificates, readLedger } from './ledger';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = 'certificatePrivateState';

const { network, config: networkConfig } = resolveNetwork();
const SEED = getOrCreateSeed(network);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'certificate');
const contractPath = path.join(zkConfigPath, 'contract', 'index.js');

if (!fs.existsSync(contractPath)) {
  console.error('\n❌ Contract not compiled! Run: npm run compile\n');
  process.exit(1);
}

const Certificate = await import(pathToFileURL(contractPath).href);

const compiledContract = CompiledContract.make('certificate', Certificate.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);

async function createProviders(walletCtx: WalletContext) {
  const privateStatePassword = process.env.PRIVATE_STATE_PASSWORD?.trim() || 'Local-Devnet-Development-Placeholder-1';

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

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'certificate-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        out[key] = 'true';
      } else {
        out[key] = value;
        i++;
      }
    }
  }
  return out;
}

function usage(): void {
  console.log(`Usage: npm run cli -- <command> [options]

Commands:
  issue   --id <certId> --student <name> --institution <inst> [--course <c>] [--grade <g>] [--issued <date>] [--doc <file>]
  verify  --id <certId> [--doc <file>]
  revoke  --id <certId>
  list
  status  --id <certId>
  balance

Notes:
  - The document (name, course, grade...) is PRIVATE: only its SHA-256
    digest is committed on-chain. It is never printed by this CLI.
  - verify with no --doc simulates a FAKE certificate: the circuit proves
    the submitted document does NOT match the on-chain digest.
  - issue and revoke require the admin secret (see src/admin.ts).`);
}

async function syncWallet(walletCtx: WalletContext): Promise<void> {
  console.log('  Syncing with network...');
  console.log('  ℹ  This may take several minutes depending on network size.');
  console.log('     RPC disconnection messages during sync are normal and can be safely ignored.\n');
  const syncStart = Date.now();
  const syncInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - syncStart) / 1000);
    process.stdout.write(`\r  ⏳ Still syncing... (${elapsed}s elapsed)   `);
  }, 5000);
  await walletCtx.wallet.waitForSyncedState();
  clearInterval(syncInterval);
  process.stdout.write('\r  ✓ Synced with network.                                      \n');
  await persistWalletState(network, walletCtx);
}

async function connectDeployed(adminSecret?: Uint8Array) {
  const deployment = getDeployment(network);
  if (!deployment) {
    console.error(`No deploy on file for network ${network}. Run \`npm run setup -- --network ${network}\` first.`);
    process.exit(1);
  }
  console.log(`  Contract: ${deployment.address}`);
  console.log(`  Network:  ${network}\n`);

  const walletCtx = await createWallet({ network, networkConfig, seed: SEED });
  await syncWallet(walletCtx);

  const providers = await createProviders(walletCtx);
  const deployed: any = await findDeployedContract(providers, {
    compiledContract: compiledContract as any,
    contractAddress: deployment.address,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });

  return { walletCtx, deployed, deployment };
}

async function cmdIssue(args: Record<string, string>): Promise<void> {
  const certId = args.id;
  const student = args.student;
  const institution = args.institution;
  if (!certId || !student || !institution) {
    console.error('issue requires --id, --student and --institution');
    usage();
    process.exit(1);
  }

  let docJson: string;
  if (args.doc) {
    docJson = fs.readFileSync(args.doc, 'utf8');
  } else {
    const doc: CertificateDocument = {
      certId,
      studentName: student,
      institution,
      course: args.course ?? 'B.E. Computer Science',
      grade: args.grade ?? 'Not disclosed',
      issuedAt: args.issued ?? new Date().toISOString().slice(0, 10),
    };
    docJson = serializeDocument(doc);
  }

  const admin = loadOrCreateAdminSecret();
  const issuedAt = BigInt(Date.now());

  console.log('  Connecting to wallet + contract...');
  const { walletCtx, deployed } = await connectDeployed();

  console.log(`\n  Issuing certificate ${certId}...`);
  console.log('  ℹ  The document stays on this machine — only its SHA-256 digest will be committed on-chain.\n');
  console.log('  Generating zero-knowledge proof...');
  try {
    const tx = await deployed.callTx.issueCertificate(
      admin.secret,
      certIdToBytes(certId),
      student,
      institution,
      toDocBytes(docJson),
      issuedAt,
    );
    console.log(`\n  ✅ Certificate ${certId} issued!`);
    console.log(`  Transaction ID: ${tx.public.txId}`);
    console.log(`  Block height: ${tx.public.blockHeight}\n`);
  } catch (error) {
    console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await walletCtx.wallet.stop();
  }
}

async function cmdVerify(args: Record<string, string>): Promise<void> {
  const certId = args.id;
  if (!certId) {
    console.error('verify requires --id');
    usage();
    process.exit(1);
  }

  // PRIVATE: the submitted document. Never printed, never persisted, never
  // sent anywhere except inside the zero-knowledge proof.
  let docJson: string | null = null;
  if (args.doc) {
    docJson = fs.readFileSync(args.doc, 'utf8');
  }

  const { walletCtx, deployed } = await connectDeployed();

  const label = docJson === null ? 'a FAKE/tampered document' : 'the submitted document';
  console.log(`\n  Verifying ${certId} against ${label}...`);
  console.log('  Generating zero-knowledge proof...');
  console.log('  🔒 Proved without revealing your input\n');

  const docBytes = docJson === null ? new Uint8Array(512) : toDocBytes(docJson);

  try {
    const tx = await deployed.callTx.verifyCertificate(certIdToBytes(certId), docBytes);
    console.log(`  ✅ Verification submitted!`);
    console.log(`  Transaction ID: ${tx.public.txId}`);
    console.log(`  Block height: ${tx.public.blockHeight}\n`);

    const result = await getLastVerification(deploymentAddress(), networkConfig);
    if (result) {
      console.log('  ── Result (read from the public ledger) ──');
      console.log(`  Certificate : ${result.certId}`);
      if (result.revoked) {
        console.log(`  Status      : ❌ REVOKED — this certificate was revoked by the admin`);
      } else if (result.verified) {
        console.log(`  Status      : ✅ VALID — the document matches the on-chain digest`);
      } else {
        console.log(`  Status      : ❌ INVALID — the document does NOT match the on-chain digest (fake certificate detected)`);
      }
      console.log('  ℹ  Only this result is public. The document itself was never revealed.\n');
    }
  } catch (error) {
    console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await walletCtx.wallet.stop();
  }
}

function deploymentAddress(): string {
  const deployment = getDeployment(network);
  if (!deployment) throw new Error('No deploy on file');
  return deployment.address;
}

async function cmdRevoke(args: Record<string, string>): Promise<void> {
  const certId = args.id;
  if (!certId) {
    console.error('revoke requires --id');
    usage();
    process.exit(1);
  }

  const admin = loadOrCreateAdminSecret();
  const { walletCtx, deployed } = await connectDeployed();

  console.log(`\n  Revoking certificate ${certId}...`);
  console.log('  Generating zero-knowledge proof (admin authorization)...');
  try {
    const tx = await deployed.callTx.revokeCertificate(admin.secret, certIdToBytes(certId));
    console.log(`\n  ✅ Certificate ${certId} revoked!`);
    console.log(`  Transaction ID: ${tx.public.txId}`);
    console.log(`  Block height: ${tx.public.blockHeight}\n`);
  } catch (error) {
    console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await walletCtx.wallet.stop();
  }
}

async function cmdList(): Promise<void> {
  console.log(`\n  Reading certificate registry from the indexer (public data only)...\n`);
  const certs = await listCertificates(deploymentAddress(), networkConfig);
  if (certs.length === 0) {
    console.log('  No certificates issued yet.\n');
    return;
  }
  for (const c of certs) {
    console.log(`  ${c.revoked ? '❌' : '✅'} ${c.certId}`);
    console.log(`     student    : ${c.studentId}`);
    console.log(`     institution: ${c.institution}`);
    console.log(`     issued     : ${new Date(Number(c.issuedAt)).toISOString()}`);
    console.log(`     docHash    : 0x${c.docHash}`);
    console.log(`     revoked    : ${c.revoked}\n`);
  }
}

async function cmdStatus(args: Record<string, string>): Promise<void> {
  const certId = args.id;
  if (!certId) {
    console.error('status requires --id');
    usage();
    process.exit(1);
  }
  console.log(`\n  Reading certificate ${certId} from the indexer...\n`);
  const c = await getCertificate(deploymentAddress(), networkConfig, certId);
  if (!c) {
    console.log(`  ❌ Certificate ${certId} does not exist on-chain.\n`);
    return;
  }
  console.log(`  ✅ ${c.certId}`);
  console.log(`     student    : ${c.studentId}`);
  console.log(`     institution: ${c.institution}`);
  console.log(`     issued     : ${new Date(Number(c.issuedAt)).toISOString()}`);
  console.log(`     docHash    : 0x${c.docHash}`);
  console.log(`     revoked    : ${c.revoked}\n`);
}

async function cmdBalance(): Promise<void> {
  const walletCtx = await createWallet({ network, networkConfig, seed: SEED });
  await syncWallet(walletCtx);
  const state = await walletCtx.wallet.waitForSyncedState();
  const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  const dust = state.dust.balance(new Date());
  console.log(`\n  tNight: ${balance.toLocaleString()}`);
  console.log(`  DUST  : ${dust.toLocaleString()}\n`);
  await walletCtx.wallet.stop();
}

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        Certificate Registry — Student Certificates           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const argv = process.argv.slice(2);
  const command = argv[0];
  const args = parseArgs(argv.slice(1));

  switch (command) {
    case 'issue': await cmdIssue(args); break;
    case 'verify': await cmdVerify(args); break;
    case 'revoke': await cmdRevoke(args); break;
    case 'list': await cmdList(); break;
    case 'status': await cmdStatus(args); break;
    case 'balance': await cmdBalance(); break;
    default: usage(); process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
