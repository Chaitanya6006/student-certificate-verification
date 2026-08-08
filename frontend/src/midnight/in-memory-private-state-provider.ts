// A minimal in-memory private state provider. The certificate contract keeps
// NO private state on chain (all private data lives inside zero-knowledge
// circuit inputs), so nothing sensitive is ever persisted here.

import type { ContractAddress, SigningKey } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  type ExportPrivateStatesOptions,
  type ExportSigningKeysOptions,
  type ImportPrivateStatesOptions,
  type ImportPrivateStatesResult,
  type ImportSigningKeysOptions,
  type ImportSigningKeysResult,
  type PrivateStateExport,
  type PrivateStateId,
  type PrivateStateProvider,
  type SigningKeyExport,
} from '@midnight-ntwrk/midnight-js-types';

export const inMemoryPrivateStateProvider = <PSI extends PrivateStateId, PS = unknown>(): PrivateStateProvider<
  PSI,
  PS
> => {
  const privateStates = new Map<ContractAddress, Map<PSI, PS>>();
  const signingKeys = new Map<ContractAddress, SigningKey>();
  let contractAddress: ContractAddress | null = null;

  return {
    setContractAddress(address: ContractAddress): void {
      contractAddress = address;
    },
    async set(privateStateId: PSI, state: PS): Promise<void> {
      if (contractAddress === null) throw new Error('No contract address set');
      let states = privateStates.get(contractAddress);
      if (!states) {
        states = new Map<PSI, PS>();
        privateStates.set(contractAddress, states);
      }
      states.set(privateStateId, state);
    },
    async get(privateStateId: PSI): Promise<PS | null> {
      if (contractAddress === null) return null;
      return privateStates.get(contractAddress)?.get(privateStateId) ?? null;
    },
    async remove(privateStateId: PSI): Promise<void> {
      privateStates.get(contractAddress ?? '')?.delete(privateStateId);
    },
    async clear(): Promise<void> {
      if (contractAddress !== null) privateStates.delete(contractAddress);
    },
    async setSigningKey(address: ContractAddress, signingKey: SigningKey): Promise<void> {
      signingKeys.set(address, signingKey);
    },
    async getSigningKey(address: ContractAddress): Promise<SigningKey | null> {
      return signingKeys.get(address) ?? null;
    },
    async removeSigningKey(address: ContractAddress): Promise<void> {
      signingKeys.delete(address);
    },
    async clearSigningKeys(): Promise<void> {
      signingKeys.clear();
    },
    async exportPrivateStates(_options?: ExportPrivateStatesOptions): Promise<PrivateStateExport> {
      return { format: 'midnight-private-state-export', encryptedPayload: '', salt: '' };
    },
    async importPrivateStates(
      _exportData: PrivateStateExport,
      _options?: ImportPrivateStatesOptions,
    ): Promise<ImportPrivateStatesResult> {
      return { imported: 0, skipped: 0, overwritten: 0 };
    },
    async exportSigningKeys(_options?: ExportSigningKeysOptions): Promise<SigningKeyExport> {
      return { format: 'midnight-signing-key-export', encryptedPayload: '', salt: '' };
    },
    async importSigningKeys(
      _exportData: SigningKeyExport,
      _options?: ImportSigningKeysOptions,
    ): Promise<ImportSigningKeysResult> {
      return { imported: 0, skipped: 0, overwritten: 0 };
    },
  };
};
