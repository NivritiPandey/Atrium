# ATRIUM contract

ATRIUM is a private eligibility/access gate. The Compact contract keeps the score
and passphrase in witnesses, while gate configuration, admission counters,
nullifiers, and the entry log are public ledger state.

## Security and product boundary

- `get_eligibility_score` is **self-asserted** by the caller. ATRIUM does not
  verify an issuer signature, an oracle result, a credential, or a person’s
  identity. A caller can choose any score that satisfies the configured
  threshold.
- `prove_entry` therefore provides no Sybil resistance. A caller can create
  multiple private passphrases and obtain multiple admissions until the lifetime
  capacity is reached. The nullifier only prevents reusing the same
  passphrase/pass pair.
- Witness values are private inputs to the proof. Circuit arguments and every
  exported ledger field are public; `disclose()` does not encrypt data.
- Steward authorization is a domain-separated hash check over the private
  `steward_secret` witness. The configured steward commitment is public.

## Stable ABI

The constructor retains six arguments, in order:

```text
[threshold, pass, deadline, curator, steward_hash, limit]
```

The exported circuit, ledger, and witness names remain stable:
`prove_entry`, `rotate_gate`, `close_gate`, `open_gate`,
`steward_public_key`, `make_entry_nullifier`, and all existing ledger/witness
names.

`total_entries` and `entry_limit` are **lifetime** admission accounting. A
rotation cannot reuse the current pass identifier, set an expired deadline, or
lower capacity below admissions already recorded. Closing/reopening does not
reset accounting. Every pass identifier and passphrase must be non-zero;
threshold, deadline, and capacity must be positive.

Generated files under `contracts/managed/atrium` are compiler output. Regenerate
with `npm run compile`; do not hand-edit generated JavaScript, ZKIR, or key
files.
