# Audit remediation — what changed, and where each item is proven

Response to the ENSv2-documentation loophole audit (`cascade-remediation-spec.md`). Every item is either fixed and demoed, or named as a limitation. "Demo step" means `npm run demo` on Sepolia; the run's transactions are in [`evidence.md`](evidence.md).

| Item | Status | Proof |
|---|---|---|
| A1 — use EAC's `_getRoles` hook | **Fixed.** The fallthrough is now an override of `_getRoles`, the hook `PermissionedRegistry` uses for approved operators. Side effect: the public `hasRoles` / `roles` now agree with writes. | Demo step 4 prints stock `hasRoles(...) = true`. Test `test_hasRolesAgreesWithWrites`. |
| A2 — gate the `team` pointer | **Was already gated** (by `ROLE_SET_PARENT`); now a dedicated `ROLE_SET_TEAM` (nybble 10, unused by `RegistryRolesLib`), and `TeamPointerUpdated(oldTeam, newTeam, changedBy)` on every change. | Demo step 6 (outsider → `EACUnauthorizedAccountRoles`, decoded from the chain). Tests `test_outsiderCannotSetTeam`, `test_setTeamEmitsOldNewSender`. |
| A3 — validate the pointer | **Fixed.** Rejects non-contracts (`TeamNotContract`) and contracts not declaring `ITeam` via ERC-165 (`TeamInterfaceUnsupported`). Trust assumption stated in code and README: the `ROLE_SET_TEAM` holder is trusted, since a contract can lie about ERC-165. | Demo step 7 (operator → `TeamNotContract`). Tests `test_setTeamRejectsWallet`, `test_setTeamRejectsUndeclaredInterface`. |
| A4 — reentrancy / gas | **Gas caps added** (`isMember` 30k, parent `roles` 50k) via low-level STATICCALL that also tolerates malformed return data. **No reentrancy guard**, deliberately: both calls happen in view context (STATICCALL — the callee cannot modify any state), and write paths complete every check before any effect. A guard would protect nothing. | Demo step 4 prints the caps. Tests `test_gasCapBoundsTeamCall`, `test_badTeamFailsClosed_nativeOwnerUnaffected` (revert, infinite loop, 1-byte return: all fail closed, native owner unaffected). |
| A5 — Mutable Token ID | **Option 1 already held; now proven.** The premise needed correcting: in ENSv2, token IDs regenerate on role grant/revoke (to protect buyers); the *EAC resource* resets on unregister/expiry/re-registration; transfers keep third-party grants. The inherited roles are read live from the parent's *current* resource, so the team's authority ends exactly when native grants do. The stored pointer confers nothing by itself. | Demo step 8 (parent re-issues `devops`: same pointer, same member, write reverts). Tests `test_parentReissueInvalidatesTeamGrant`, `test_parentExpiryInvalidatesTeamGrant`, `test_parentTransferKeepsGrant_likeAnyNativeDelegate`. |
| A6 — one-hop depth | **Named.** Contract NatSpec, README "Honest limits", demo closing summary. | — |

## Part C checklist

- [x] Fallthrough uses `_getRoles`
- [x] Setting the `team` pointer requires a real EAC role (`ROLE_SET_TEAM`), with an event emitted on change
- [x] A non-role-holder attempting to change the pointer is demoed failing, live (step 6)
- [x] A non-contract address attempting to be set as `team` is demoed failing, live (step 7)
- [x] The external `isMember()` call is gas-capped, visible in the demo output (step 4)
- [x] Checks-effects-interactions confirmed; reentrancy guard judged unnecessary because the calls are STATICCALLs — reasoning in code comments and above
- [x] Mutable Token ID interaction resolved (Option 1), demoed live (step 8)
- [x] Multi-level depth limitation stated in code comments and the demo's closing summary
- [x] Wording: "EAC exposes holder *counts* (`roleCount`, `getAssigneeCount`), not holder *identities*" — README, qa.md, explainer

## New things this pass surfaced

- **Native owners now pay for the hook.** Every non-root role lookup can make up to two external calls, including for accounts that already hold the role natively: ≈2.3k gas extra per write locally (`test_gas_nativeVsFallthrough`: 73,069 vs 75,382, warm). Raised as design question 2.
- **`try/catch` does not catch undecodable return data.** The first version of the gas-capped calls used `try/catch`; a team returning one byte would have reverted every check on the registry, including native owners'. Replaced with a low-level STATICCALL and a length check (`test_badTeamFailsClosed_nativeOwnerUnaffected`, mode 2).
- **Self-parent.** `setParent(this)` would recurse; `_teamGrant` refuses it (`test_selfParentDoesNotRecurse`).

## Deployment

The earlier `CascadeSubregistry` (`0xa6e5…3b22`) and `TeamRegistry` (`0x1a3d…b881`) are retired: `devops` was repointed at the new registry and the old team's grant revoked (`npm run setup -- --write --redeploy`). Subnames created under the old registry are no longer reachable from `devops`. Retired addresses are kept in `deployments/sepolia.json`.
