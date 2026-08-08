import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  issueCertificate(context: __compactRuntime.CircuitContext<PS>,
                   adminSecret_0: Uint8Array,
                   certId_0: Uint8Array,
                   studentId_0: string,
                   institution_0: string,
                   docBytes_0: Uint8Array,
                   issuedAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  verifyCertificate(context: __compactRuntime.CircuitContext<PS>,
                    certId_0: Uint8Array,
                    docBytes_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeCertificate(context: __compactRuntime.CircuitContext<PS>,
                    adminSecret_0: Uint8Array,
                    certId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  issueCertificate(context: __compactRuntime.CircuitContext<PS>,
                   adminSecret_0: Uint8Array,
                   certId_0: Uint8Array,
                   studentId_0: string,
                   institution_0: string,
                   docBytes_0: Uint8Array,
                   issuedAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  verifyCertificate(context: __compactRuntime.CircuitContext<PS>,
                    certId_0: Uint8Array,
                    docBytes_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeCertificate(context: __compactRuntime.CircuitContext<PS>,
                    adminSecret_0: Uint8Array,
                    certId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  issueCertificate(context: __compactRuntime.CircuitContext<PS>,
                   adminSecret_0: Uint8Array,
                   certId_0: Uint8Array,
                   studentId_0: string,
                   institution_0: string,
                   docBytes_0: Uint8Array,
                   issuedAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  verifyCertificate(context: __compactRuntime.CircuitContext<PS>,
                    certId_0: Uint8Array,
                    docBytes_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeCertificate(context: __compactRuntime.CircuitContext<PS>,
                    adminSecret_0: Uint8Array,
                    certId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  certificates: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { studentId: string,
                                 institution: string,
                                 docHash: Uint8Array,
                                 issuedAt: bigint,
                                 revoked: boolean
                               };
    [Symbol.iterator](): Iterator<[Uint8Array, { studentId: string,
  institution: string,
  docHash: Uint8Array,
  issuedAt: bigint,
  revoked: boolean
}]>
  };
  readonly lastVerification: { certId: Uint8Array,
                               verified: boolean,
                               revoked: boolean
                             };
  readonly adminHash: Uint8Array;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               initialAdminHash_0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
