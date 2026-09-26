# ENS Drive (powered by Cascade) — living build plan

> **Naming:** *ENS Drive* is the product; *Cascade* is its permission layer — the `CascadeSubregistry` / `CascadeSubregistryV2` contracts and the ReBAC rule they implement. Contract and code names stay `Cascade…`, matching the Sepolia deployment.

Original input: [`../plan.md`](../plan.md), kept unedited. This file is the working version and the handoff between sessions.

Audience: the ENS team, for design feedback, and the ETHGlobal judges: submitted to the ENS track (Best Use of ENSv2) on 2026-09-26, first draft without the video; the finalist pitch is in [pitch-finalist.md](pitch-finalist.md). Goal: the fastest honest demo of team-based inheritance on the real ENSv2 beta deployment, first one hop (v1), now the cascade (v2).

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
| `CascadeSubregistryV2` (4 teams, depth 1–3, link check, lazy `_checkRoles`) | **live on Sepolia, the demo** | `0x7aa1…d0a3` on `protocol.orbit-dao.eth` — [roadmap-v2 §9](roadmap-v2.md#9-the-demo-tree-orbit-daoeth). Earlier tree `acme-labs.eth` still live |
| Teams: `TeamRegistry` core-devs / auditors, `NestedTeam` security-council ⊃ auditors | **live on Sepolia** | `0x1709…adb0`, `0x6394…9b62`, `0xce0b…4acfa` |
| `HatsTeam`, `SafeTeam` adapters | fork-tested | against the real Hats v1 and Safe 1.4.1 (`npm run test:fork`); not deployed |
| Tests | passing (local) | `forge test` 71 (unit, fuzz, invariants, gaps, gas, 2 opt-in fork) + 3 Halmos proofs (`npm run prove`) |
| Forked-Sepolia rehearsal of setup + demo | passed (anvil fork) | two consecutive 8-step runs |
| Demo, live | **demoed on Sepolia** | 8 steps: reverted / success / reverted / reverted / reverted / reverted — [evidence](evidence.md) |
| Gas | measured | via team 91,946 / denied 69,921 (Sepolia); native vs team 73,069 / 75,382 (local, warm) |
| Explainer page for the ENS team | published (private) | claude.ai artifact, version 2 — share from its Share menu |
| Repository | private on GitHub | keep private until the user says otherwise |
| Shared core (`core/cascade/`) | done | terminal demo re-run on a fork after extraction: every outcome as expected |
| ENS Drive web UI (`web/`) | **hosted and live**: https://ens-drive.vercel.app, Cascade tab (orbit-dao.eth) + One folder tab (acme-corp.eth), real transactions and `cast run` traces | dedicated least-privilege keys, rate limits, balance guard; join / move / cascade switch / attack / reset checked on the live site after each deploy |
| Submission | first draft submitted 2026-09-26 (commit `fdff719`) | form copy in [submission.md](submission.md), updated to the current state; demo video still to record |

## Thesis

A subname registry whose EAC role lookup also asks the names above it: *does any of them grant one of my teams a role on the path down to me, and is this account a member?* Team membership then governs every current and future subname under `protocol.orbit-dao.eth` (v2) or `devops.acme-corp.eth` (v1) with one role write, no per-subname grants, and no token transfers.

## Design

- **v2 (the demo):** `CascadeSubregistryV2` overrides `_getRoles` (full union, for views) and `_checkRoles` (lazy, for writes: own roles first, one level at a time, membership asked only when a grant covers a missing role, stop when covered). Up to 4 teams, depth 1–3 via stock `getParent`, each level counted only if it points back down (`getSubregistry`). Member calls capped at 100k, parent reads and link checks at 50k. Details: [roadmap-v2.md](roadmap-v2.md).
- **v1 mechanism:** `CascadeSubregistry` overrides EAC's `_getRoles`. For non-root resources, an account's roles are its own plus the regular roles `parent.roles("devops", team)` returns, if `team.isMember(account)`. Admin bits masked; root never inherited. Every reader agrees: writes, `hasRoles`, `roles`, `explain`.
- **Why a pointer:** EAC cannot list who holds a role, so the registry names its candidate (`team`) and reads the parent's grant to it live. The grant is the authority; the pointer alone confers nothing.
- **Pointer guard:** `ROLE_SET_TEAM` on root, must be a contract declaring `ITeam` via ERC-165, `TeamPointerUpdated(old, new, by)` on change. Trust assumption: the `ROLE_SET_TEAM` holder.
- **External calls:** STATICCALLs in view context, gas-capped (30k / 50k), malformed return data fails closed.
- **Invalidation:** parent unregister / expiry / re-registration ends the team's authority like any native grant; transfer keeps it like any delegate's grant.

## Name hierarchy

v2 (the cascade demo):

- `orbit-dao.eth` — a fictional DAO, registered via commit–reveal; the .eth registry grants security-council edit + set resolver on it; its subregistry is a stock `PermissionedRegistry`.
- `protocol.orbit-dao.eth` — subregistry = `CascadeSubregistryV2` (teams core-devs and security-council, depth 2); the org registry grants core-devs edit on it.
- `vault`, `oracle`, `bridge` `.protocol.orbit-dao.eth` — the three contract names; `+ New file` adds more.
- `alex.orbit-dao.eth` (hosted demo account) and `alex-dev.orbit-dao.eth` (local) — Alex's names.

v1 (the one-folder demo):

- `acme-corp.eth` — registered via commit–reveal; its subregistry is a stock `PermissionedRegistry` (the "org registry").
- `devops.acme-corp.eth` — in the org registry, subregistry = `CascadeSubregistry`; `TeamRegistry` is granted `ROLE_SET_SUBREGISTRY` on it.
- `svc-<id>.devops.acme-corp.eth` — created live during each demo run.

## Demo path — web (the pitch)

The Cascade tab's 8-step guide (script: [pitch-finalist.md](pitch-finalist.md)): Alex edits `vault` (refused) → **drag Alex into core-devs** (the chip moves at once, the three names flip to "can edit" when the transaction lands) → edit (allowed) → **move Alex to the auditors** → edit (still allowed, via security-council on `orbit-dao.eth`) → **"Sharing flows into subfolders" off** → edit (refused) → on again → the "On-chain, just now" card and **Behind the scenes** trace → **Under the hood**. Off the main path: set resolver, + New file, the attack (refused), Start over.

The One folder tab keeps the v1 path: Share dialog → + New file → Edit as outsider (refused) → drag the outsider into devops-team → edit (saved; "Can edit · via devops-team") → drag out → edit (refused) → attack (refused).

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

Steps 0–3 are live on Sepolia and in the demo (`roadmap/full-rebac` merged into `main` 2026-09-27): the **Cascade** tab runs steps 1–3 on `orbit-dao.eth` (the earlier `acme-labs.eth` tree is still live), the **One folder** tab runs step 0 on `acme-corp.eth`. Step 4's adapters are tested against the real Hats and Safe on a fork, not deployed. Step 5 waits for ENS feedback. Every step keeps the same invariants: native grants untouched, admin and root roles never inherited, bounded lookups that fail closed.

| # | Step | Model | Status |
|---|---|---|---|
| 0 | One hop | parent → team → member | **live (MVP)** |
| 1 | Many teams per role | up to 4 teams per registry; each gets whatever the parent grants it (`CascadeSubregistryV2`) | live on Sepolia, the demo |
| 2 | Teams of teams | `NestedTeam`: up to 4 sub-teams, 3 levels, cycles end at the limit; no Cascade change | live on Sepolia, the demo |
| 3 | Multi-hop names | `depth` 1–3 up the tree via stock `getParent`; each level counts only if the ancestor points back down (`getSubregistry`) (`CascadeSubregistryV2`) | live on Sepolia, the demo |
| 4 | Bring your own roster | `HatsTeam` (hat wearers), `SafeTeam` (Safe owners) behind `isMember()`; no Cascade change | built; tested with mocks and on a fork against the real Hats v1 and Safe 1.4.1; not deployed |
| 5 | Who-can-access queries, resolver records, agent fleets | reverse lookups via events + indexer; record-level rights (a second mechanism — resolver permissions aren't keyed by parent name); agents as the use case | after ENS feedback |

Before any of 1–4: invariant/fuzz tests for the step-0 rule, so each extension is checked against the same properties — **done** (`contracts/test/CascadeInvariant.t.sol`). After the third ENS pitch: the gap tests (approvals, expiry, the 15-member cap, a v1/v2 equivalence invariant) and 3 Halmos proofs — **done** ([feedback/ens-pitch-3.md](feedback/ens-pitch-3.md)).

**Gas trade-off, resolved for writes:** every inherited lookup on a v2 subname reads every team's grant at every level. For native callers, v2 now has a native-first fast path in `_checkRoles`: if the caller's stored roles already cover the check, no team or ancestor is consulted (same outcome, since inheritance only adds roles). Measured locally (warm), a native owner's `setSubregistry` on v2 with 2 teams costs 89,355 gas at depth 1 and 133,017 at depth 3 without the fast path, and 40,293 at either depth with it. Views (`hasRoles`, `roles`) are not overridable in `PermissionedRegistry` and still compute the full answer. Worst case for an inherited lookup, 4 hostile teams at depth 3, is bounded at ~553k.

**Gas for members, improved after the third ENS pitch:** the lazy, role-aware `_checkRoles` (decision 18) asks a team about membership only when its grant covers a still-missing role and stops when covered. On Sepolia a member's level-1 write went 165,723 → 97,665 gas, level-2 through the nested team 148,473 → 138,289; an owner's write 36,971 (unchanged).

## Cut list

- UI edge cases: the wallet-as-team and parent re-issue steps stay terminal-only.
- Wallet connection on the hosted site: visitors drive the shared demo account (Alex).
- Roadmap step 5 (who-can-access, resolver records, agents): waits for ENS feedback.

## Decisions taken

See [decisions.md](decisions.md). In short: stored `team` pointer (option A, user decision); neutral org name `acme-corp.eth`, Perjury operator key as signer (user decision); denied writes sent, not simulated; fallthrough moved to `_getRoles`; gas-capped low-level STATICCALLs with no reentrancy guard; Mutable Token ID concern resolved by reading the parent live.

## Open

- Demo video: not yet recorded (script in [pitch-finalist.md](pitch-finalist.md) §2).
- Repository: private; the ENS track requires it public (the user decides when).
- ENS team feedback on the design questions in the README (holder discovery, extension points and a virtual `hasRoles`, value over root grants, the team's role on the folder itself) and the pitch-3 questions.
- Contract source verification on Etherscan — not done.
- External audit.
