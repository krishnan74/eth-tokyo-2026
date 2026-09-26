# ENS Drive (powered by Cascade) — living build plan

> **Naming:** *ENS Drive* is the product; *Cascade* is its permission layer — the `CascadeSubregistry` contract and the ReBAC rule it implements. Contract and code names stay `Cascade…`, matching the Sepolia deployment.

Original input: [`../plan.md`](../plan.md), kept unedited. This file is the working version and the handoff between sessions.

Audience: the ENS team, for design feedback. Not a prize submission — no time-box, no track checklist. Goal is the fastest honest demo of the one-hop fallthrough on the real ENSv2 beta deployment.

## Status

| Component | State | Evidence |
|---|---|---|
| ENSv2 beta deployment still live (Sepolia) | verified (read-only) | `ethRegistry` 0x1d78…971e has code; `LABEL_STORE()` → 0xD735…E855; registrar answers `isAvailable` |
| Source matches deployment | verified (read-only) | `ensdomains/contracts-v2@48b3e2d` has `LABEL_STORE`, as does the deployed `UserRegistry` impl |
| EAC extension point | verified (source) | `_getRoles` is `internal view virtual` and documented as the read-time hook; the fallthrough overrides it |
| EAC can enumerate role holders | **no** (source) | EAC exposes holder *counts* (`roleCount`, `getAssigneeCount`), not identities — hence the `team` pointer |
| `CascadeSubregistry` (`_getRoles` hook, validated `team`) | **demoed on Sepolia** | `0x2f15…5e13` — [evidence](evidence.md). Earlier `_checkRoles` version `0xa6e5…3b22` retired |
| `TeamRegistry` (EAC roster, ERC-165) | **demoed on Sepolia** | `0x11dd…72bb` — [evidence](evidence.md). Earlier `0x1a3d…b881` retired |
| `AlwaysTrueTeam` demo fixture | deployed | `0xaa73…20c1` — the attacker's contract in step 6 |
| `acme-corp.eth` → org registry → `devops` → Cascade wiring | deployed | setup tx hashes in [evidence](evidence.md) |
| Audit remediation (A1–A6) | **demoed on Sepolia** | demo steps 4, 6–8 + tests — [remediation](remediation.md) |
| Unit tests | passing (local) | `forge test` 17/17 |
| Forked-Sepolia rehearsal of setup + demo | passed (anvil fork) | two consecutive 8-step runs |
| Demo, live | **demoed on Sepolia** | 8 steps: reverted / success / reverted / reverted / reverted / reverted — [evidence](evidence.md) |
| Gas | measured | via team 91,946 / denied 69,921 (Sepolia); native vs team 73,069 / 75,382 (local, warm) |
| Explainer page for the ENS team | published (private) | claude.ai artifact, version 2 — share from its Share menu |
| Repository | private on GitHub | keep private until the user says otherwise |
| Shared core (`core/cascade/`) | done | terminal demo re-run on a fork after extraction: every outcome as expected |
| ENS Drive web UI (`web/`) | shared-drive demo + live traces; clicked through on a fork; Reset + trace replay run on live Sepolia; an earlier UI version clicked through on Sepolia | seven actions as expected, every trace decoded, no console errors. Writes and traces local-only |

## Thesis

A subname registry whose EAC role lookup also asks the parent name: *does it grant a team contract a role on me, and is this account a member?* Team membership then governs every current and future subname under `devops.acme-corp.eth` with one role write, no per-subname grants, and no token transfers.

## Design

- **Mechanism:** `CascadeSubregistry` overrides EAC's `_getRoles`. For non-root resources, an account's roles are its own plus the regular roles `parent.roles("devops", team)` returns, if `team.isMember(account)`. Admin bits masked; root never inherited. Every reader agrees: writes, `hasRoles`, `roles`, `explain`.
- **Why a pointer:** EAC cannot list who holds a role, so the registry names its candidate (`team`) and reads the parent's grant to it live. The grant is the authority; the pointer alone confers nothing.
- **Pointer guard:** `ROLE_SET_TEAM` on root, must be a contract declaring `ITeam` via ERC-165, `TeamPointerUpdated(old, new, by)` on change. Trust assumption: the `ROLE_SET_TEAM` holder.
- **External calls:** STATICCALLs in view context, gas-capped (30k / 50k), malformed return data fails closed.
- **Invalidation:** parent unregister / expiry / re-registration ends the team's authority like any native grant; transfer keeps it like any delegate's grant.

## Name hierarchy

- `acme-corp.eth` — registered via commit–reveal; its subregistry is a stock `PermissionedRegistry` (the "org registry").
- `devops.acme-corp.eth` — in the org registry, subregistry = `CascadeSubregistry`; `TeamRegistry` is granted `ROLE_SET_SUBREGISTRY` on it.
- `svc-<id>.devops.acme-corp.eth` — created live during each demo run.

## Demo path — web (the pitch)

The shared-drive view: open the Share dialog → **+ New file** → **Edit as outsider** (refused) → **drag the outsider into devops-team** → edit (saved; Who has access shows "Can edit · via devops-team", given directly: none) → drag out → edit (refused) → **attack** (refused) → **Behind the scenes** trace → **Under the hood**.

## Demo path — terminal (`npm run demo`; `--core` runs 1–5)

1. Setup, one line: the parent grants `TeamRegistry` `ROLE_SET_SUBREGISTRY` on `devops`. The fallthrough is the `_getRoles` hook.
2. Create a new subname; the outsider's `setSubregistry` → **reverts**. Live per-check reads, relationship graph.
3. Grant the outsider `MEMBER`. One line.
4. Same write → **succeeds**. Stock `hasRoles` = true; gas caps; before/after tree, relationships, and checks.
5. Revoke `MEMBER`; same write → **reverts**. State box shows the flip.
6. Outsider `setTeam(AlwaysTrueTeam)` → **reverts** (`EACUnauthorizedAccountRoles`).
7. Operator `setTeam(wallet)` → **reverts** (`TeamNotContract`).
8. Parent re-issues `devops`; member writes → **reverts** (grant scoped to the old registration). Setup restored.

On Sepolia a full run is 14 transactions, about three minutes of confirmations; `--step` for presenting, `--recap` to replay the last run without transactions.

## Roadmap: from the MVP rule to full ReBAC

Steps 0–3 are live on Sepolia and in the demo (`roadmap/full-rebac` merged into `main` 2026-09-27): the **Cascade** tab runs steps 1–3 on `acme-labs.eth`, the **One folder** tab runs step 0 on `acme-corp.eth`. Step 4's adapters are tested against the real Hats and Safe on a fork, not deployed. Step 5 waits for ENS feedback. Every step keeps the same invariants: native grants untouched, admin and root roles never inherited, bounded lookups that fail closed.

| # | Step | Model | Status |
|---|---|---|---|
| 0 | One hop | parent → team → member | **live (MVP)** |
| 1 | Many teams per role | up to 4 teams per registry; each gets whatever the parent grants it (`CascadeSubregistryV2`) | live on Sepolia (branch) |
| 2 | Teams of teams | `NestedTeam`: up to 4 sub-teams, 3 levels, cycles end at the limit; no Cascade change | live on Sepolia (branch) |
| 3 | Multi-hop names | `depth` 1–3 up the tree via stock `getParent`; each level counts only if the ancestor points back down (`getSubregistry`) (`CascadeSubregistryV2`) | live on Sepolia (branch) |
| 4 | Bring your own roster | `HatsTeam` (hat wearers), `SafeTeam` (Safe owners) behind `isMember()`; no Cascade change | built on branch, tested with mocks; not deployed |
| 5 | Who-can-access queries, resolver records, agent fleets | reverse lookups via events + indexer; record-level rights (a second mechanism — resolver permissions aren't keyed by parent name); agents as the use case | after ENS feedback |

Before any of 1–4: invariant/fuzz tests for the step-0 rule, so each extension is checked against the same properties — **done** (`contracts/test/CascadeInvariant.t.sol`: 5 invariants, 5 fuzz tests).

**Gas trade-off, resolved for writes:** every inherited lookup on a v2 subname reads every team's grant at every level. For native callers, v2 now has a native-first fast path in `_checkRoles`: if the caller's stored roles already cover the check, no team or ancestor is consulted (same outcome, since inheritance only adds roles). Measured locally (warm), a native owner's `setSubregistry` on v2 with 2 teams costs 89,355 gas at depth 1 and 133,017 at depth 3 without the fast path, and 40,293 at either depth with it. Views (`hasRoles`, `roles`) are not overridable in `PermissionedRegistry` and still compute the full answer. Worst case for an inherited lookup, 4 hostile teams at depth 3, is bounded at ~553k.

## Cut list

- UI edge cases: the wallet-as-team and parent re-issue steps stay terminal-only.
- Prize tracks, time-box — not the goal of this build (user decision).

## Decisions taken

See [decisions.md](decisions.md). In short: stored `team` pointer (option A, user decision); neutral org name `acme-corp.eth`, Perjury operator key as signer (user decision); denied writes sent, not simulated; fallthrough moved to `_getRoles`; gas-capped low-level STATICCALLs with no reentrancy guard; Mutable Token ID concern resolved by reading the parent live.

## Open

- ENS team feedback on the design questions in the README (holder discovery, `_getRoles` for cross-contract inheritance and its cost to native owners, value over root grants, the team's role on `devops` itself).
- Contract source verification on Etherscan — not done.
- Native-owner gas baseline on Sepolia (only measured locally).
