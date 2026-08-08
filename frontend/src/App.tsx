import { useMidnight } from './hooks/useMidnight';
import { WalletConnect } from './components/WalletConnect';
import { IssueCertificate } from './components/IssueCertificate';
import { VerifyCertificate } from './components/VerifyCertificate';
import { RevokeCertificate } from './components/RevokeCertificate';
import { CertificateList } from './components/CertificateList';

export const App = () => {
  const wallet = useMidnight();
  const { status, deployed, providers, networkId } = wallet;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo">◆</span>
          <div>
            <h1>CertiProof</h1>
            <p className="tagline">Student certificate verification on Midnight</p>
          </div>
        </div>
        <div className="header-right">
          <span className="badge badge-ghost">network: {networkId}</span>
          <WalletConnect wallet={wallet} />
        </div>
      </header>

      {status !== 'connected' || !deployed || !providers ? (
        <main className="landing">
          <section className="hero">
            <h2>Tamper-proof certificates, zero-knowledge privacy</h2>
            <p>
              An issuing authority stores only a <strong>SHA-256 hash</strong> of each certificate on-chain. The
              document itself — name, course, grade — is proved in zero knowledge and never revealed. Anyone can
              verify the certificate against the public record; forged or revoked certificates are detected instantly.
            </p>
            {status === 'idle' && (
              <p className="hero-cta">
                Connect the <strong>{networkId}</strong> Midnight Wallet extension to continue. No wallet yet? Get it
                at{' '}
                <a href="https://midnightwallet.io" target="_blank" rel="noreferrer">
                  midnightwallet.io
                </a>
                .
              </p>
            )}
          </section>
          <section className="features">
            <div className="feature-card">
              <h3>🔒 Private by design</h3>
              <p>
                Certificate content is a circuit input — only its digest is committed to the blockchain. Grades and
                names never appear on-chain.
              </p>
            </div>
            <div className="feature-card">
              <h3>⚖️ Verifiable by anyone</h3>
              <p>
                A single hash is enough to check any certificate. The result — VALID, INVALID or REVOKED — is recorded
                on-chain.
              </p>
            </div>
            <div className="feature-card">
              <h3>🗡️ Forge-proof</h3>
              <p>
                No one — not even the issuing institute — can rewrite history. Tampering, duplicate IDs and rogue
                issuers are rejected by the circuit.
              </p>
            </div>
          </section>
        </main>
      ) : (
        <main className="dashboard">
          <IssueCertificate deployed={deployed} />
          <VerifyCertificate deployed={deployed} providers={providers} />
          <RevokeCertificate deployed={deployed} />
          <CertificateList providers={providers} deployed={deployed} />
        </main>
      )}

      <footer className="footer muted">
        Certified data lives on the Midnight Preview network. This dApp is an INTO the Midnight — SPPU bootcamp
        project.
      </footer>
    </div>
  );
};