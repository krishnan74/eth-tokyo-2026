# Build log

## 2026-09-26

- Ingested `plan.md`. Probed the ENSv2 beta deployment read-only: still live; deployed `UserRegistry` and `contracts-v2@48b3e2d` both expose `LABEL_STORE`, so HEAD source matches closely enough to subclass.
- Read EAC source: `_checkRoles` is `internal view virtual` (the extension point exists), but there is no holder enumeration — only a 4-bit assignee count. The plan's "look up who holds the role on the parent" is not implementable as written. Chose a stored `team` pointer + live parent `hasRoles` check (option A).
- Wrote `TeamRegistry` and `CascadeSubregistry`; 5 of 6 tests failed on first run — a test bug (`vm.prank` consumed by `team.TEAM_RESOURCE()` evaluated as an argument), not a contract bug. ~5 min.
- Rehearsed setup + demo on an anvil fork of Sepolia, including real commit–reveal against the beta registrar (time-warped). Clean first time.
- Ran setup on Sepolia (10 txs incl. a 70 s commit wait), then the demo: reverted / success / reverted, all mined. Universal Resolver finds a resolver for all three names (inherited for the two subnames).

## 2026-09-26 (later) — audit remediation

- Moved the fallthrough into `_getRoles`; added `ROLE_SET_TEAM`, `TeamPointerUpdated`, contract + ERC-165 validation, gas-capped STATICCALLs, `nativeRoles()`. 17 tests.
- First gas-capped version used `try/catch`; a test with a team returning 1 byte showed it reverts the whole check (including native owners). Switched to low-level `staticcall` + length check. ~10 min.
- Two test mistakes, not contract bugs: tried to grant an admin bit on a name after registration (stock ENSv2 forbids it), and `explain()` only reported membership when the grant existed (changed to always report it).
- Rehearsed `setup --redeploy` and the 8-step demo twice on a fork (second run confirmed step 8 restores state), then redeployed on Sepolia and ran all 8 steps live.
