import type { MidnightWallet } from '../hooks/useMidnight';

const shortAddress = (address: string): string =>
  address.length > 18 ? `${address.slice(0, 9)}…${address.slice(-6)}` : address;

export const WalletConnect = ({ wallet }: { wallet: MidnightWallet }) => {
  const { status, address, error, networkId, connect, disconnect } = wallet;

  return (
    <div className="wallet-bar">
      {status === 'connected' && (
        <>
          <span className="badge badge-ok">Connected to {networkId}</span>
          <code className="address">{shortAddress(address ?? '')}</code>
          <button className="btn btn-ghost" onClick={disconnect}>
            Disconnect
          </button>
        </>
      )}
      {status === 'connecting' && (
        <>
          <span className="spinner" aria-hidden="true" />
          <span className="muted">Connecting to Midnight Wallet…</span>
        </>
      )}
      {status === 'idle' && (
        <button className="btn btn-primary" onClick={() => void connect()}>
          Connect Midnight Wallet
        </button>
      )}
      {status === 'error' && (
        <>
          <span className="badge badge-error">Connection failed</span>
          <span className="error-text">{error}</span>
          <button className="btn btn-primary" onClick={() => void connect()}>
            Retry
          </button>
        </>
      )}
    </div>
  );
};
