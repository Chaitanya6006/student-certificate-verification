// Certificate document helpers.
//
// A certificate document is a JSON string (student name, course, grade, ...).
// It is a PRIVATE input: the contract receives the raw bytes as a circuit
// parameter and commits ONLY its SHA-256 digest to the ledger. The bytes are
// fixed-size Bytes<512> in the circuit (right-padded with zeros), so documents
// are limited to 512 UTF-8 bytes — plenty for a certificate record.

import { Buffer } from 'buffer';

export const DOC_BYTE_LENGTH = 512;

export interface CertificateDocument {
  certId: string;
  studentName: string;
  institution: string;
  course: string;
  grade: string;
  issuedAt: string;
}

export function serializeDocument(doc: CertificateDocument): string {
  return JSON.stringify(doc);
}

/** JSON string → 512-byte buffer (right-padded). Throws if too long. */
export function toDocBytes(docJson: string): Uint8Array {
  const buf = Buffer.from(docJson, 'utf8');
  if (buf.byteLength > DOC_BYTE_LENGTH) {
    throw new Error(
      `Document is ${buf.byteLength} bytes; the circuit fixes documents at ${DOC_BYTE_LENGTH} bytes. Trim it.`,
    );
  }
  const padded = Buffer.alloc(DOC_BYTE_LENGTH);
  buf.copy(padded, 0);
  return padded;
}

/** 512-byte buffer → JSON string (trims zero padding). */
export function fromDocBytes(bytes: Uint8Array): string {
  let end = bytes.byteLength;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return Buffer.from(bytes.slice(0, end)).toString('utf8');
}

/** Parse a padded doc buffer back into a CertificateDocument. */
export function parseDocument(bytes: Uint8Array): CertificateDocument {
  const parsed = JSON.parse(fromDocBytes(bytes)) as CertificateDocument;
  if (typeof parsed.studentName !== 'string') {
    throw new Error('Document JSON is missing "studentName"');
  }
  return parsed;
}

export function bytesToHex(b: Uint8Array): string {
  return Buffer.from(b).toString('hex');
}

export function hexToBytes(hex: string): Uint8Array {
  return Buffer.from(hex, 'hex');
}

/** certId string → Bytes<32> (padded). */
export function certIdToBytes(certId: string): Uint8Array {
  const buf = Buffer.from(certId, 'utf8');
  if (buf.byteLength > 32) throw new Error('certId must be 32 bytes or less');
  const padded = Buffer.alloc(32);
  buf.copy(padded, 0);
  return padded;
}

/** Bytes<32> → trimmed certId string. */
export function bytesToCertId(b: Uint8Array): string {
  let end = b.byteLength;
  while (end > 0 && b[end - 1] === 0) end--;
  return Buffer.from(b.slice(0, end)).toString('utf8');
}
