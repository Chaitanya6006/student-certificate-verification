# On-chain evidence (Midnight Preview)

Verifiable proof that the student-certificate contract is live on **Preview**.
All values below were read back from the public indexer on 2026-08-08.

## Contract

- **Address**: `657e40da5bbacca8135e0e8a02fe2feccc6d1b85db06082085cd1fc2aab2025b`
- **Deployer**: `mn_addr_preview1xcq5nqld5u6wmgcss4zn2p7q2w0ldu9srz88rxvqrvvdg704rsnswxkeyw`
- **Faucet**: https://faucet.preview.midnight.network

### Verify the contract exists (any machine, no SDK)

```bash
curl -sS https://indexer.preview.midnight.network/api/v4/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ contract(address: \"657e40da5bbacca8135e0e8a02fe2feccc6d1b85db06082085cd1fc2aab2025b\") { address state } }"
```

A non-null `state` field proves the contract exists on-chain.

## Transactions on this contract (oldest -> newest)

| # | action | hash |
|---|---|---|
| 1 | deploy | `4b5c7f9df6a8a1f286b1ca32c3d2cd35e2af23132527f6a67fd7f14cc33ebdef` |
| 2 | call | `f859465177558fee35b90ab34eba20dc2e4c994f086f140bfbedad2e790eefab` |
| 3 | call | `f7f4908a6304849b31a4955b2f914fc8c7f9b35989334469ad1cd0958760f0c1` |
| 4 | call | `f741ac9151f87fb89601c943da8229edfad9b12d3c287895522058bd598cdb16` |
| 5 | call | `c37fdda01fc3661bdd9521af522a3e2de27c83d5ff1b09eafa924dc04b148a9a` |
| 6 | call | `7ccd1bd4c291715f3b0a0cb9f6bc30802547ae2905464af7c976eb3407df5e8b` |
| 7 | call | `98965efa58bf902b82c19aeccae4d8b76bc1569ba44d90586ec605d131b95646` |
| 8 | call | `97de69a55572d99ce3f8e7464cf02728aaa7457013d8842023b598bef89287c8` |

Action 1 (indexer id `14904`) is the **deployment transaction**.

Indexer action ids: [14904, 14906, 14919, 14921, 14926, 14928, 14930, 14971]

## Verbatim indexer response

{
  "data": {
    "contract": {
      "actions": [ {"transaction": {"id": 14904, "hash": "4b5c7f9df6a8a1f286b1ca32c3d2cd35e2af23132527f6a67fd7f14cc33ebdef"}},
 {"transaction": {"id": 14906, "hash": "f859465177558fee35b90ab34eba20dc2e4c994f086f140bfbedad2e790eefab"}},
 {"transaction": {"id": 14919, "hash": "f7f4908a6304849b31a4955b2f914fc8c7f9b35989334469ad1cd0958760f0c1"}},
 {"transaction": {"id": 14921, "hash": "f741ac9151f87fb89601c943da8229edfad9b12d3c287895522058bd598cdb16"}},
 {"transaction": {"id": 14926, "hash": "c37fdda01fc3661bdd9521af522a3e2de27c83d5ff1b09eafa924dc04b148a9a"}},
 {"transaction": {"id": 14928, "hash": "7ccd1bd4c291715f3b0a0cb9f6bc30802547ae2905464af7c976eb3407df5e8b"}},
 {"transaction": {"id": 14930, "hash": "98965efa58bf902b82c19aeccae4d8b76bc1569ba44d90586ec605d131b95646"}},
 {"transaction": {"id": 14971, "hash": "97de69a55572d99ce3f8e7464cf02728aaa7457013d8842023b598bef89287c8"}} ]
    }
  }
}
