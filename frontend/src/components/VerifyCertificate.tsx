import { useState } from 'react';
import type { CertificateDeployedContract, CertificateProviders } from '../midnight/midnight';
import { readLedgerState } from '../midnight/midnight';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { certIdToBytes, serializeDocument, toDocBytes, type CertificateDocument } from '../lib/document';

export interface VerificationOutcome {
  readonly txId: string;
  readonly blockHeight: bigint;
  readonly verified: boolean;
  readonly revoked: boolean;
}

export interface VerifyCertificateProps {
  readonly deployed: CertificateDeployedContract;
  readonly providers: CertificateProviders;
}

export const VerifyCertificate = ({ deployed, providers }: VerifyCertificateProps) => {
  const [certId, setCertId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState('');
  const [grade, setGrade] = useState('');
  const [issuedAt, setIssuedAt] = useState('');

  const { running, error, result: outcome, run, reset } = useAsyncAction<VerificationOutcome>(async () => {
    const document: CertificateDocument = { certId, studentName, institution, course, grade, issuedAt };
    const docBytes = toDocBytes(serializeDocument(document));
    const certIdBytes = certIdToBytes(certId);

    const tx = await deployed.callTx.verifyCertificate(certIdBytes, docBytes);
    const state = await readLedgerState(providers, deployed.deployTxData.public.contractAddress);
    const last = state?.lastVerification;
    if (!last) throw new Error('Could not read the verification result from the ledger.');

    return {
      txId: tx.public.txId,
      blockHeight: BigInt(tx.public.blockHeight),
      verified: last.verified,
      revoked: last.revoked,
    };
  });

  const statusBadge = (() => {
    if (!outcome) return null;
    if (outcome.verified && !outcome.revoked) {
      return <span className="badge badge-ok">VALID — certificate exists and the document is authentic</span>;
    }
    if (outcome.revoked) {
      return <span className="badge badge-warn">REVOKED — certificate was revoked by the admin</span>;
    }
    return <span className="badge badge-error">INVALID — no matching certificate or document mismatch</span>;
  })();

  return (
    <section className="panel">
      <h2>Verify a certificate</h2>
      <p className="muted">
        Upload the certificate document here (re-entered as private inputs). A zero-knowledge proof — not the document
        — attests the certificate <code>docHash</code> matches the ledger record. The verification outcome is recorded
        on-chain.
      </p>

      <div className="form-grid">
        <label>
          Certificate ID
          <input value={certId} onChange={(e) => setCertId(e.target.value)} placeholder="CERT-20260801-001" />
        </label>
        <label>
          Student name
          <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Priya Sharma" />
        </label>
        <label>
          Institution
          <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="SPPU — Pune" />
        </label>
        <label>
          Course
          <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Computer Engineering" />
        </label>
        <label>
          Grade
          <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="A+" />
        </label>
        <label>
          Issued on (YYYY-MM-DD)
          <input value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} placeholder="2026-08-01" />
        </label>
      </div>

      <div className="actions">
        <button className="btn btn-primary" disabled={running || !certId} onClick={() => void run()}>
          {running ? 'Proving + submitting…' : 'Verify in zero knowledge'}
        </button>
        {(error || outcome) && (
          <button className="btn btn-ghost" onClick={reset}>
            Reset
          </button>
        )}
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {outcome && (
        <div className="notice">
          {statusBadge}
          <p className="muted">
            Verified at block <code>{outcome.blockHeight.toString()}</code> · tx <code>{outcome.txId}</code>
          </p>
        </div>
      )}
    </section>
  );
};