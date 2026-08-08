import { useEffect, useMemo, useState } from 'react';
import type { CertificateDeployedContract } from '../midnight/midnight';
import { useAsyncAction } from '../hooks/useAsyncAction';
import {
  certIdToBytes,
  hexToBytes,
  serializeDocument,
  sha256Hex,
  toDocBytes,
  type CertificateDocument,
} from '../lib/document';

const defaultCertId = (): string =>
  `CERT-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;

const defaultIssuedAt = (): string => new Date().toISOString().slice(0, 10);

export const IssueCertificate = ({ deployed }: { deployed: CertificateDeployedContract }) => {
  const [certId, setCertId] = useState(defaultCertId);
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState('');
  const [grade, setGrade] = useState('');
  const [issuedAt, setIssuedAt] = useState(defaultIssuedAt);
  const [adminSecret, setAdminSecret] = useState('');

  const document: CertificateDocument = useMemo(
    () => ({ certId, studentName, institution, course, grade, issuedAt }),
    [certId, studentName, institution, course, grade, issuedAt],
  );
  const docJson = serializeDocument(document);
  const [previewHash, setPreviewHash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void sha256Hex(toDocBytes(docJson)).then((hash) => {
      if (!cancelled) setPreviewHash(hash);
    });
    return () => {
      cancelled = true;
    };
  }, [docJson]);

  const { running, error, result: txId, run, reset } = useAsyncAction(async () => {
    if (adminSecret.length === 0) throw new Error('Admin secret is required to issue a certificate.');
    const secretBytes = hexToBytes(adminSecret);
    if (secretBytes.byteLength !== 32) {
      throw new Error('Admin secret must be exactly 64 hex characters (32 bytes).');
    }
    const certIdBytes = certIdToBytes(certId);
    const docBytes = toDocBytes(docJson);
    const issuedAtMs = BigInt(new Date(`${issuedAt}T00:00:00Z`).getTime());

    const tx = await deployed.callTx.issueCertificate(
      secretBytes,
      certIdBytes,
      studentId,
      institution,
      docBytes,
      issuedAtMs,
    );
    return tx.public.txId;
  });

  return (
    <section className="panel">
      <h2>Issue a certificate</h2>
      <p className="muted">
        The certificate contents (name, course, grade) are a <strong>private circuit input</strong>. Only the SHA-256
        digest is ever stored on-chain — the school admin proves, in zero knowledge, that the document matches.
      </p>

      <div className="form-grid">
        <label>
          Certificate ID (public)
          <input value={certId} onChange={(e) => setCertId(e.target.value)} />
        </label>
        <label>
          Student ID (public)
          <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="SPPU-2026-0001" />
        </label>
        <label>
          Student name (private)
          <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Priya Sharma" />
        </label>
        <label>
          Institution (public)
          <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="SPPU — Pune" />
        </label>
        <label>
          Course (private)
          <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Computer Engineering" />
        </label>
        <label>
          Grade (private)
          <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="A+" />
        </label>
        <label>
          Issued on (public)
          <input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
        </label>
        <label className="admin-field">
          Admin secret — 64 hex chars (private, never leaves your browser)
          <input
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value.trim())}
            placeholder="…"
            type="password"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="hash-preview">
        docHash that will be stored on-chain:{' '}
        <code>{previewHash ? `${previewHash.slice(0, 24)}…` : 'computing…'}</code>
      </div>

      <div className="actions">
        <button className="btn btn-primary" disabled={running} onClick={() => void run()}>
          {running ? 'Proving + submitting…' : 'Issue certificate'}
        </button>
        {(error || txId) && (
          <button className="btn btn-ghost" onClick={reset}>
            Reset
          </button>
        )}
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {txId && (
        <div className="notice notice-ok">
          Certificate <strong>{certId}</strong> issued. Transaction: <code>{txId}</code>
        </div>
      )}
    </section>
  );
};
