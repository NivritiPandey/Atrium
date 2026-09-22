# Atrium product proposal

## Selected Level 3 problem: Private Allowlist Access

Atrium is a privacy-preserving access room. A curator publishes a minimum eligibility threshold, a pass domain, an expiry, and an entry capacity. A visitor supplies an eligibility signal and a passphrase as private witnesses. The Compact circuit proves that the hidden signal clears the public threshold, derives a gate-scoped nullifier, rejects replay, and records an anonymous entry. The curator receives a public, verifiable result without receiving the visitor's score, passphrase, source credential, or an identity map.

## Product boundary

The first implementation intentionally demonstrates the privacy boundary with a self-entered score. It is not an attestation system. A production Atrium room should connect the witness to an attested credential, issuer signature, or allowlist membership proof before making a real eligibility claim.

## Why this belongs on Midnight

A conventional allowlist asks an operator to hold more identity data than the access decision actually requires. Atrium makes the access predicate explicit: publish the rule, prove it privately, and disclose only the outcome and replay guard. Midnight's opt-in privacy model makes the public surface inspectable without requiring the evidence behind it to become public.

## MVP path

1. Deploy a room from the browser on Preview or Preprod.
2. Publish the public configuration in the Observatory.
3. Connect a compatible wallet and generate an entry proof.
4. Show the accepted proof and anonymous nullifier in the public record.
5. Replace the self-entered demonstration score with a credential-backed witness adapter.
