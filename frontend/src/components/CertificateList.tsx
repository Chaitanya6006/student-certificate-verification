import { useCallback, useEffect, useState } from 'react';
import type { CertificateDeployedContract, CertificateLedger, CertificateProviders } from '../midnight/midnight';
import { readLedgerState } from '../midnight/midnight';
import { bytesToCertId, bytesToHex } from '../lib/document';

const shortHash = (b: Uint8Array): string => `${bytesToHex(b).slice(0, 16)}…`;

export interface CertificateListProps {
  readonly providers: CertificateProviders;
  readonly deployed: CertificateDeployedContract;
}

export const CertificateList = ({ providers, deployed }: CertificateListProps) => {
  const [ledger, setLedger] = useState<CertificateLedger | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contractAddress = deployed.deployTxData.public.contractAddress;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      setLedger(await readLedgerState(providers, contractAddress));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRefreshing(false);
    }
  }, [providers, contractAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const entries = ledger ? Array.from(ledger.certificates) : [];
  const last = ledger?.lastVerification;

  return (
    <section className="panel">
      <h2>Certificate ledger</h2>
      <p className="muted">
        Public data only — every entry carries the certificate ID, student, institution, a hash of the document and
        its issuance date. Names, courses and grades never appear here: they are proven in zero knowledge.
      </p>

      <div className="actions">
        <button className="btn btn-ghost" disabled={refreshing} onClick={() => void refresh()}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {entries.length === 0 && !refreshing ? (
        <p className="muted">No certificates issued yet.</p>
      ) : (
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Certificate ID</th>
              <th>Student ID</th>
              <th>Institution</th>
              <th>docHash</th>
              <th>Issued</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, cert]) => (
              <tr key={bytesToHex(key)}>
                <td>{bytesToCertId(key)}</td>
                <td>{cert.studentId}</td>
                <td>{cert.institution}</td>
                <td>
                  <code>{shortHash(cert.docHash)}</code>
                </td>
                <td>{new Date(Number(cert.issuedAt)).toISOString().slice(0, 10)}</td>
                <td>
                  {cert.revoked ? (
                    <span className="badge badge-warn">revoked</span>
                  ) : (
                    <span className="badge badge-ok">valid</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {last && (
        <div className="last-verification muted">
          Last verification on-chain: certificate <code>{bytesToCertId(last.certId)}</code> →{' '}
          {last.revoked ? 'REVOKED' : last.verified ? 'VALID' : 'INVALID'}
        </div>
      )}
    </section>
  );
};