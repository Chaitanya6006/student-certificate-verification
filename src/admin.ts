// Admin secret management for the certificate contract.
//
// The admin authorizes certificate issuance/revocation by proving knowledge of
// a 32-byte admin secret — in-circuit via `persistentHash(domain || secret)`,
// never revealed on-chain. Only its public image (adminHash) is committed at
// deploy time.
//
// The secret is generated once, persisted to a LOCAL, gitignored file, and
// reused across deploys. If it is lost, the deployed contract's adminHash no
// longer matches any secret: the contract is effectively frozen for admin
// actions (verify still works). Keep a backup of this file in production.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// MUST match the domain separator in contracts/certificate.compact
// (`pad(32, "cert:admin:")`). persistentHash<Vector<2, Bytes<32>>> is exactly
// SHA-256 of the concatenated 64 bytes (verified against the runtime).
export const ADMIN_DOMAIN = 'cert:admin:';

export const ADMIN_SECRET_FILE = '.certificate-admin-secret.json';

export interface AdminKeys {
  /** 32-byte admin secret — NEVER log, NEVER send anywhere. */
  secret: Uint8Array;
  /** 32-byte public image of the secret; passed to the contract constructor. */
  adminHash: Uint8Array;
}

function pad32(s: string): Buffer {
  const b = Buffer.alloc(32);
  b.write(s, 0, 'utf8');
  return b;
}

/** Derives the on-chain adminHash exactly as the circuit does. */
export function deriveAdminHash(secret: Uint8Array): Uint8Array {
  if (secret.byteLength !== 32) throw new Error('Admin secret must be exactly 32 bytes');
  return crypto.createHash('sha256').update(Buffer.concat([pad32(ADMIN_DOMAIN), Buffer.from(secret)])).digest();
}

function secretFilePath(cwd?: string): string {
  return path.join(cwd ?? process.cwd(), ADMIN_SECRET_FILE);
}

/** Loads the persisted admin secret, generating + persisting one on first use. */
export function loadOrCreateAdminSecret(cwd?: string): AdminKeys {
  const file = secretFilePath(cwd);
  if (fs.existsSync(file)) {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as { secret: string };
    const secret = Buffer.from(raw.secret, 'hex');
    if (secret.byteLength !== 32) throw new Error(`Invalid admin secret in ${file}`);
    return { secret, adminHash: deriveAdminHash(secret) };
  }
  const secret = crypto.randomBytes(32);
  const adminHash = deriveAdminSecretAndHash(secret);
  fs.writeFileSync(file, JSON.stringify({ secret: secret.toString('hex') }, null, 2) + '\n');
  console.log(`  ℹ Generated a new admin secret and saved it to ${file} (gitignored — back it up!).`);
  return { secret, adminHash };
}

function deriveAdminSecretAndHash(secret: Buffer): Uint8Array {
  return deriveAdminHash(secret);
}

export function loadAdminSecretOnly(cwd?: string): Uint8Array | null {
  const file = secretFilePath(cwd);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as { secret: string };
  return Buffer.from(raw.secret, 'hex');
}
