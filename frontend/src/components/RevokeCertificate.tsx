import { useState } from 'react';
import type { CertificateDeployedContract } from '../midnight/midnight';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { certIdToBytes, hexToBytes } from '../lib/document';

export interface RevokeCertificateProps {
  readonly deployed: CertificateDeployedContract;
}

export const RevokeCertificate = ({ deployed }: RevokeCertificateProps) => {
  const [certId, setCertId] = useState('');
  const [adminSecret, setAdminSecret] = useState('');

  const { running, error, result: txId, run, reset } = useAsyncAction(async () => {
    if (adminSecret.length === 0) throw new Error('Admin secret is required to revoke a certificate.');
    const secretBytes = hexToBytes(adminSecret);
    if (secretBytes.byteLength !== 32) {
      throw new Error('Admin secret must be exactly 64 hex characters (32 bytes).');
    }
    const tx = await deployed.callTx.revokeCertificate(secretBytes, certIdToBytes(certId));
    return tx.public.txId;
  });

  return (
    <section className="panel panel-danger">
      <h2>Revoke a certificate</h2>
      <p className="muted">
        Marks a certificate <code>revoked = true</code> on-chain. Verifications will then report REVOKED. Only the
        admin (holder of the admin secret) can do this.
      </p>

      <div className="form-grid">
        <label>
          Certificate ID
          <input value={certId} onChange={(e) => setCertId(e.target.value)} placeholder="CERT-20260801-001" />
        </label>
        <label>
          Admin secret — 64 hex chars
          <input
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value.trim())}
            placeholder="…"
            type="password"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="actions">
        <button className="btn btn-danger" disabled={running || !certId} onClick={() => void run()}>
          {running ? 'Proving + submitting…' : 'Revoke certificate'}
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
          Certificate <strong>{certId}</strong> revoked. Transaction: <code>{txId}</code>
        </div>
      )}
    </section>
  );
};