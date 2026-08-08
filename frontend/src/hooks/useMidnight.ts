import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type CertificateDeployedContract,
  type CertificateProviders,
  initializeProviders,
  joinContract,
} from '../midnight/midnight';

export type WalletStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface MidnightWallet {
  readonly status: WalletStatus;
  readonly error: string | null;
  readonly address: string | null;
  readonly networkId: string;
  readonly deployed: CertificateDeployedContract | null;
  readonly providers: CertificateProviders | null;
  connect(): Promise<void>;
  disconnect(): void;
}

export const useMidnight = (): MidnightWallet => {
  const [status, setStatus] = useState<WalletStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [deployed, setDeployed] = useState<CertificateDeployedContract | null>(null);
  const [providers, setProviders] = useState<CertificateProviders | null>(null);
  const disposedRef = useRef(false);

  const networkId = (import.meta.env.VITE_NETWORK as string | undefined) ?? 'preview';

  const disconnect = useCallback(() => {
    disposedRef.current = true;
    setStatus('idle');
    setError(null);
    setAddress(null);
    setDeployed(null);
    setProviders(null);
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    try {
      const { providers: newProviders, unshieldedAddress } = await initializeProviders();
      const contractAddress = (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined)?.trim();
      if (!contractAddress) {
        throw new Error(
          'VITE_CONTRACT_ADDRESS is not set — create frontend/.env with the deployed contract address (see .env.example).',
        );
      }
      const newDeployed = await joinContract(newProviders, contractAddress);
      if (disposedRef.current) return;

      setProviders(newProviders);
      setDeployed(newDeployed);
      setAddress(unshieldedAddress);
      setStatus('connected');
    } catch (cause) {
      if (disposedRef.current) return;
      setStatus('error');
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  return { status, error, address, networkId, deployed, providers, connect, disconnect };
};
