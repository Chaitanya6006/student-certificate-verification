// Midnight provider factory for the browser.
//
// Connects to the Midnight Wallet browser extension (DApp Connector API v4),
// builds the provider set the midnight-js runtime expects, and exposes the
// certificate contract API. Proving happens inside the wallet
// (ConnectedAPI.getProvingProvider) — no remote prover server is needed.

import semver from 'semver';
import { ConnectedAPI, type InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { findDeployedContract, type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import {
  Binding,
  FinalizedTransaction,
  Proof,
  SignatureEnabled,
  Transaction,
  TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import type {
  MidnightProviders,
  PrivateStateId,
  UnboundTransaction,
} from '@midnight-ntwrk/midnight-js-types';
import { Contract as CertificateContract, type Circuits, ledger } from '../generated/certificate-contract';
import { inMemoryPrivateStateProvider } from './in-memory-private-state-provider';

declare global {
  interface Window {
    midnight?: Record<string, InitialAPI>;
  }
}

const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

export const CERTIFICATE_PRIVATE_STATE_ID = 'certificatePrivateState';
export const DEFAULT_NETWORK_ID = 'preview';

export type CertificatePrivateState = Record<string, never>;
export type CertificateCircuitKeys = keyof Circuits<CertificatePrivateState>;
export type CertificateProviders = MidnightProviders<
  CertificateCircuitKeys,
  PrivateStateId,
  CertificatePrivateState
>;
export type CertificateDeployedContract = FoundContract<CertificateContract>;

export const getWalletExtensionName = (): string => {
  const { VITE_WALLET_NAME } = import.meta.env;
  return typeof VITE_WALLET_NAME === 'string' && VITE_WALLET_NAME.length > 0 ? VITE_WALLET_NAME : 'Midnight Wallet';
};

const getFirstCompatibleWallet = (): InitialAPI | undefined => {
  if (!window.midnight) return undefined;
  return Object.values(window.midnight).find(
    (wallet): wallet is InitialAPI =>
      !!wallet &&
      typeof wallet === 'object' &&
      'apiVersion' in wallet &&
      semver.satisfies(wallet.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION),
  );
};

export const connectToWallet = async (networkId: string = DEFAULT_NETWORK_ID): Promise<ConnectedAPI> => {
  const wallet = getFirstCompatibleWallet();
  if (!wallet) {
    throw new Error(`No compatible wallet extension found (DApp Connector API ${COMPATIBLE_CONNECTOR_API_VERSION}).`);
  }
  const connectedAPI = await wallet.connect(networkId);
  const status = await connectedAPI.getConnectionStatus();
  if (status.status !== 'connected') {
    throw new Error('Wallet connection was rejected by the user.');
  }
  if (status.networkId !== networkId) {
    throw new Error(`Wallet is connected to "${status.networkId}" but this app needs "${networkId}".`);
  }
  return connectedAPI;
};

export const initializeProviders = async (): Promise<{
  providers: CertificateProviders;
  unshieldedAddress: string;
}> => {
  const connectedAPI = await connectToWallet();
  const config = await connectedAPI.getConfiguration();
  const zkConfigPath = `${window.location.origin}/managed/certificate`;
  const keyMaterialProvider = new FetchZkConfigProvider<CertificateCircuitKeys>(zkConfigPath, fetch.bind(window));
  const shieldedAddresses = await connectedAPI.getShieldedAddresses();
  const proverServerUri = config.proverServerUri;

  const walletProvider = {
    getCoinPublicKey(): string {
      return shieldedAddresses.shieldedCoinPublicKey;
    },
    getEncryptionPublicKey(): string {
      return shieldedAddresses.shieldedEncryptionPublicKey;
    },
    async balanceTx(tx: UnboundTransaction, ttl?: Date): Promise<FinalizedTransaction> {
      const received = await connectedAPI.balanceUnsealedTransaction(toHex(tx.serialize()));
      return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
        'signature',
        'proof',
        'binding',
        fromHex(received.tx),
      );
    },
  };

  return {
    providers: {
      privateStateProvider: inMemoryPrivateStateProvider<PrivateStateId, CertificatePrivateState>(),
      publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
      zkConfigProvider: keyMaterialProvider,
      proofProvider: httpClientProofProvider(proverServerUri!, keyMaterialProvider),
      walletProvider,
      midnightProvider: {
        async submitTx(tx: FinalizedTransaction): Promise<TransactionId> {
          await connectedAPI.submitTransaction(toHex(tx.serialize()));
          return tx.identifiers()[0];
        },
      },
    },
    unshieldedAddress: (await connectedAPI.getUnshieldedAddress()).unshieldedAddress,
  };
};

export const joinContract = async (
  providers: CertificateProviders,
  contractAddress: string,
): Promise<CertificateDeployedContract> => {
  const compiledContract = CompiledContract.make<CertificateContract>('certificate', CertificateContract).pipe(
    CompiledContract.withVacantWitnesses,
  ) as CompiledContract.CompiledContract<CertificateContract, CertificatePrivateState, never>;
  return findDeployedContract<CertificateContract>(providers, {
    compiledContract,
    contractAddress,
    privateStateId: CERTIFICATE_PRIVATE_STATE_ID,
  });
};

/** Reads the latest public ledger state from the indexer. Never touches private data. */
export const readLedgerState = async (
  providers: CertificateProviders,
  contractAddress: string,
): Promise<CertificateLedger | null> => {
  const state = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!state) return null;
  return ledger(state.data);
};

export type CertificateLedger = ReturnType<typeof ledger>;
