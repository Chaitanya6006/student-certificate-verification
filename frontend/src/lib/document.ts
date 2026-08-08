// Browser-safe certificate document helpers (no Node Buffer).
//
// The contract fixes certificate documents at Bytes<512> (right-padded). Only
// the SHA-256 digest of the document ever reaches the ledger; the raw bytes
// (student name, course, grade) are a private circuit input and stay in the
// browser.

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

export function toDocBytes(docJson: string): Uint8Array {
  const bytes = new TextEncoder().encode(docJson);
  if (bytes.byteLength > DOC_BYTE_LENGTH) {
    throw new Error(
      `Document is ${bytes.byteLength} bytes; the circuit fixes documents at ${DOC_BYTE_LENGTH} bytes. Trim it.`,
    );
  }
  const padded = new Uint8Array(DOC_BYTE_LENGTH);
  padded.set(bytes, 0);
  return padded;
}

export function fromDocBytes(bytes: Uint8Array): string {
  let end = bytes.byteLength;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return new TextDecoder().decode(bytes.slice(0, end));
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.byteLength; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function certIdToBytes(certId: string): Uint8Array {
  const bytes = new TextEncoder().encode(certId);
  if (bytes.byteLength > 32) throw new Error('certId must be 32 bytes or less');
  const padded = new Uint8Array(32);
  padded.set(bytes, 0);
  return padded;
}

export function bytesToCertId(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
  return bytesToHex(new Uint8Array(digest));
}
