// Read-only ledger access via the network's indexer. Used by the CLI, the
// tests and the frontend integration paths. No wallet required — the ledger
// state is public by design (hashes, identifiers and flags only; never the
// private document content).

import { Buffer } from 'buffer';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type { NetworkConfig } from './network';
import { certIdToBytes } from './document';
import * as CertificateContract from '../contracts/managed/certificate/contract/index.js';

export type CertificateLedger = ReturnType<typeof CertificateContract.ledger>;

export interface PublicCertificate {
  certId: string;
  studentId: string;
  institution: string;
  docHash: string;
  issuedAt: bigint;
  revoked: boolean;
}

export interface PublicVerification {
  certId: string;
  verified: boolean;
  revoked: boolean;
}

function bytesToHex(b: Uint8Array): string {
  return Buffer.from(b).toString('hex');
}

function certIdToString(b: Uint8Array): string {
  let end = b.byteLength;
  while (end > 0 && b[end - 1] === 0) end--;
  return Buffer.from(b.slice(0, end)).toString('utf8');
}

/** Fetches the latest public ledger state of the deployed contract. */
export async function readLedger(address: string, config: NetworkConfig, opts: { indexer?: string; indexerWS?: string } = {}): Promise<CertificateLedger | null> {
  const indexer = opts.indexer ?? config.indexer;
  const indexerWS = opts.indexerWS ?? config.indexerWS;
  const pdp = indexerPublicDataProvider(indexer, indexerWS);
  const state = await pdp.queryContractState(address);
  if (!state) return null;
  return CertificateContract.ledger(state.data);
}

/** Lists every issued certificate as plain objects (public data only). */
export async function listCertificates(address: string, config: NetworkConfig): Promise<PublicCertificate[]> {
  const ledger = await readLedger(address, config);
  if (!ledger) return [];
  const out: PublicCertificate[] = [];
  for (const [key, cert] of ledger.certificates) {
    out.push({
      certId: certIdToString(key),
      studentId: cert.studentId,
      institution: cert.institution,
      docHash: bytesToHex(cert.docHash),
      issuedAt: cert.issuedAt,
      revoked: cert.revoked,
    });
  }
  return out;
}

export async function getCertificate(address: string, config: NetworkConfig, certId: string): Promise<PublicCertificate | null> {
  const ledger = await readLedger(address, config);
  if (!ledger) return null;
  const key = certIdToBytes(certId);
  if (!ledger.certificates.member(key)) return null;
  const cert = ledger.certificates.lookup(key);
  return {
    certId,
    studentId: cert.studentId,
    institution: cert.institution,
    docHash: bytesToHex(cert.docHash),
    issuedAt: cert.issuedAt,
    revoked: cert.revoked,
  };
}

export async function getLastVerification(address: string, config: NetworkConfig): Promise<PublicVerification | null> {
  const ledger = await readLedger(address, config);
  if (!ledger) return null;
  const lv = ledger.lastVerification;
  if (lv.certId.byteLength === 0) return null;
  return { certId: certIdToString(lv.certId), verified: lv.verified, revoked: lv.revoked };
}
