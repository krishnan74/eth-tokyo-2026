# Roadmap v2 — many teams, teams of teams, multi-hop names

> Built on branch `roadmap/full-rebac`, merged into `main` on 2026-09-27: the **Cascade** tab of the home page (and https://ens-drive.vercel.app) runs this; the **One folder** tab still runs v1 on `acme-corp.eth`. The two use separate name trees and contracts — no v2 transaction touches a v1 contract, name or grant.

What roadmap steps 1–4 add, how they keep the MVP's guarantees, where they are deployed, and how to try them in the browser. Design reasoning is in [`decisions.md`](decisions.md) (12–17); the build story in [`build-log.md`](build-log.md).

---

## 1. The rule, generalised

v1 (one hop, one team):

```
roles = native  ∪  (parent.roles(label, team) & regular bits)        if team.isMember(caller)
```

v2 (up to 4 teams, up to 3 levels):

```
roles = native  ∪  ⋃ over teams t, levels k ≤ depth, t.isMember(caller):
                        ancestor_k.roles(label_k, t) & regular bits
```

- **Teams** — `addTeam` / `removeTeam` (max 4), each checked like v1's `setTeam`: a contract, ERC-165 `ITeam`, gated by the root role `ROLE_SET_TEAM`, events `TeamAdded` / `TeamRemoved`. Each team gets exactly what the ancestors grant *that team* — devops can edit while security only sets resolvers.
- **Depth** — `setDepth(1..3)`, default 1, which is exactly v1's behaviour. Level 1 is this registry's parent (stock `setParent`); each further level is the previous ancestor's own `getParent()`.
- **Link check** — a level counts only if the ancestor really points down: `ancestor.getSubregistry(label) == registry below`. A registry cannot adopt a parent that didn't adopt it, and because `getSubregistry` returns 0 for expired names, expiry anywhere on the path cuts inheritance above it. The walk stops at the first broken link.
- **Nested teams and rosters** — need no Cascade change: `NestedTeam` answers `isMember` for its own members and its sub-teams' (max 4, 3 levels, depth passed down so cycles end); `HatsTeam` and `SafeTeam` answer from Hats / a Safe.

Still true, exactly as in v1: the logic lives in the `_getRoles` hook, so views and writes agree; it only adds roles; admin bits (upper 128) are masked; nothing is inherited at `ROOT_RESOURCE`; every external call is a gas-capped STATICCALL that fails closed.

## 2. What else changed in the contract

| Change | Why |
|---|---|
| Member-call cap 30k → 100k | Nested teams and Hats eligibility modules need more; over the cap still means "not a member". |
| Return data copied one word at most (assembly `staticcall` + `returndatacopy`) | A hostile team or ancestor could otherwise inflate the caller's gas with an oversized reply (lint `return-bomb`). |
| `getParent()` reply size-checked (≤ 320 bytes) and decoded in a self-call (`decodeParent`) inside try/catch | It returns a string; undecodable data would otherwise revert every check. Now it can only end the walk. |
| Membership asked only when a team's grant would add new bits | Saves calls; the result is identical. |
| **Lazy, role-aware write check** in `_checkRoles` (after ENS's pitch-3 suggestion) | `_getRoles` isn't told which role is being checked, so it computes everything; `_checkRoles` is told. Writes now evaluate lazily: the caller's stored roles first (owners pay no lookup), then one level at a time; a team is asked about membership only when its grants so far include a still-missing role; a known non-member's grants aren't read again; evaluation stops as soon as the requested roles are covered. Same yes/no as the full union (inheritance only adds) — proven by a differential fuzz test. `hasRoles` isn't `virtual` in `PermissionedRegistry`, so views still compute the full union. |
| `explain()` reports which team and level supplied a role; `ancestry()` returns the verified path | For the UI and for debugging. |

## 3. Contracts

| Contract | File | Address (Sepolia) |
|---|---|---|
| `CascadeSubregistryV2` for `platform.acme-labs.eth` (depth 2, teams dev-team + security; lazy check, deploy 2) | `contracts/src/CascadeSubregistryV2.sol` | [`0x1c361c62e2ea3330790f1d6c17e42b873081ddc8`](https://sepolia.etherscan.io/address/0x1c361c62e2ea3330790f1d6c17e42b873081ddc8) |
| Retired: the first `CascadeSubregistryV2` (full-union check) | | [`0xa6b159d2e785a6146d9e21a1cc377b781e70a246`](https://sepolia.etherscan.io/address/0xa6b159d2e785a6146d9e21a1cc377b781e70a246) |
| Org registry for `acme-labs.eth` (stock `PermissionedRegistry`, parent = `.eth` registry) | stock ENSv2 | [`0x35888867cc0c37d54ae0f902611ec4a5b8a73beb`](https://sepolia.etherscan.io/address/0x35888867cc0c37d54ae0f902611ec4a5b8a73beb) |
| dev-team (`TeamRegistry`) | `contracts/src/TeamRegistry.sol` | [`0xaa75275e77f89267f28a5bbf2f7f40b920941253`](https://sepolia.etherscan.io/address/0xaa75275e77f89267f28a5bbf2f7f40b920941253) |
| security (`NestedTeam`, contains sre) | `contracts/src/teams/NestedTeam.sol` | [`0x179aa1bac7758557defe517330147afd55f54134`](https://sepolia.etherscan.io/address/0x179aa1bac7758557defe517330147afd55f54134) |
| sre (`TeamRegistry`) | `contracts/src/TeamRegistry.sol` | [`0x2bd2a5bf158ec73ab1c8d1989e4b3b200d055163`](https://sepolia.etherscan.io/address/0x2bd2a5bf158ec73ab1c8d1989e4b3b200d055163) |
| `HatsTeam`, `SafeTeam` | `contracts/src/teams/` | not deployed — tested with mocks and, on a Sepolia fork, against the real Hats Protocol v1 (`0x3bc1…d137`) and Safe 1.4.1 (`npm run test:fork`) |

The tree and its grants:

```
.eth registry ── acme-labs ──▶ OrgRegistry v2 ── platform ──▶ CascadeSubregistryV2 ── svc-api, svc-…
   grant: security holds SET_RESOLVER on acme-labs      (level 2)
                           grant: dev-team holds SET_SUBREGISTRY on platform   (level 1)
```

`SET_RESOLVER` on `acme-labs.eth` is an ordinary grant: the ENSv2 registrar gives a new name's owner `SET_RESOLVER_ADMIN` (and `SET_SUBREGISTRY_ADMIN`).

## 4. Try it

```bash
npm run setup:v2               # simulate; --write to send (idempotent; book: deployments/sepolia-v2.json)
npm run smoke:v2               # terminal check of every step; cleans up after itself
npm run ui                     # on this branch, the home page's drive runs on v2: http://localhost:3000
```

**The home page's Cascade tab** (hosted at https://ens-drive.vercel.app with the dedicated demo keys, or `npm run ui` locally with the `.env` keys, which own the v2 tree): two folder levels, `acme-labs.eth` shared with **security** and `platform` shared with **dev-team** — both **"can edit"** (`SET_SUBREGISTRY`; security also has `SET_RESOLVER`). The main path is one verb, eight guided steps: refused → drag into dev-team → edit works (via platform) → drag from dev-team into **sre** (inside security) → edit works (via acme-labs.eth, one folder up) → switch "Sharing flows into subfolders" off (`setDepth(1)`) → refused → on again. One step off the main path, nothing removed: "each group gets its own permissions" (set resolver as outsider), + New file, the attack (outsider `addTeam(AlwaysTrueTeam)`, refused), Start over, and the live `cast run` trace — the result bar shows the call chain in one line (link check → `getParent` → link check → grants → dev-team, then security → sre).

## 5. Evidence (Sepolia)

**Deploy 1 — setup** (`npm run setup:v2 -- --write`, after a rehearsal on an anvil fork; the full-union check):

| Step | Tx |
|---|---|
| deploy org | [`0x507ea1df…`](https://sepolia.etherscan.io/tx/0x507ea1df4c3036e21f6550d75f54bcf367611980e610c31279c9f12a0c19142f) |
| deploy cascade | [`0x98ff61a7…`](https://sepolia.etherscan.io/tx/0x98ff61a75ddffb6bcebdbe8d2a13bd1ad48b9c665a9f67abecebe9ba259d306b) |
| deploy devTeam | [`0x9818af23…`](https://sepolia.etherscan.io/tx/0x9818af2379a861843b833f3fef8c51e986c1e2deb937a7557db23565bc8934d8) |
| deploy sre | [`0xe5c2e5f1…`](https://sepolia.etherscan.io/tx/0xe5c2e5f15fb2f17c8a9c35f9ef940cf39fb186dd71a47e2d3e3c30c975520cbc) |
| deploy security | [`0x32d80362…`](https://sepolia.etherscan.io/tx/0x32d8036225d0b18b6c727a59535dafa17a9de459016e6950210386e87830abfa) |
| usdc approve | [`0x1355bfa3…`](https://sepolia.etherscan.io/tx/0x1355bfa3f38b01178cc2f7ade5ea2ec013f1e299e8f2380c55118d963c27c277) |
| commit | [`0x2bf77109…`](https://sepolia.etherscan.io/tx/0x2bf77109a684412b507f5a08f2ac8bacd0769d7bbe375871d5bbe3962f400887) |
| register acme-labs.eth | [`0xde950126…`](https://sepolia.etherscan.io/tx/0xde95012637af5c19639293b7c1341738bac183136ca66622027e6575b4263d54) |
| org setParent | [`0xfd535694…`](https://sepolia.etherscan.io/tx/0xfd5356946fa0bf49ee34c44fa6a79d731a2af7e1c58b09fde29adf0159369e38) |
| register platform | [`0x14c72132…`](https://sepolia.etherscan.io/tx/0x14c72132d1a2ec2e001f6d3d543e113cc446d24e11f01ab35555a910e01104c3) |
| v2 setParent | [`0x40e34046…`](https://sepolia.etherscan.io/tx/0x40e34046ad3b2be15fcfc72d4d3c404110b94dab3b83204e69ff701ddab61c09) |
| v2 addTeam dev-team | [`0xeacd9729…`](https://sepolia.etherscan.io/tx/0xeacd972913969b6d6a9301ed9bb659d4370a926447a8bd9c64af99966519da84) |
| v2 addTeam security | [`0xc0f7a303…`](https://sepolia.etherscan.io/tx/0xc0f7a303e2662cc7fc13d37e58fd75d6967de850abb27b6277bbb29db1cd4fff) |
| v2 setDepth 2 | [`0xa401b030…`](https://sepolia.etherscan.io/tx/0xa401b030418e34c45618ce65cf6ed87a8edc84f5b21caba9c27d1fd8bf39552d) |
| security addSubTeam sre | [`0x4bc119b5…`](https://sepolia.etherscan.io/tx/0x4bc119b590fb10876528672c3d5fe314a70518249dcac05428c7bba3ded0c518) |
| grant dev-team on platform | [`0x1e28610d…`](https://sepolia.etherscan.io/tx/0x1e28610d0a4090690b1a9c85710f752731b929713ceb6c46003e14390e2d3cfa) |
| grant security on acme-labs.eth | [`0x66c758a6…`](https://sepolia.etherscan.io/tx/0x66c758a6f18482241b2aab9e47360ffe7fb492e1e7a1a94601c26b58f673e21a) |
| register svc-api | [`0xa141e292…`](https://sepolia.etherscan.io/tx/0xa141e2926a5acaf08c6aabb638929a7f8d69145604eca0e1cfe7d70af136861b) |

**Deploy 1 — smoke run** (`npm run smoke:v2`): outsider refused both roles → joined dev-team → `setSubregistry` allowed via level 1, `setResolver` still refused → joined sre → `setResolver` allowed via security two levels up → operator's native write → left both → refused again.

| Step | Tx |
|---|---|
| dev-team add outsider | [`0x5fc185bc…`](https://sepolia.etherscan.io/tx/0x5fc185bcc3889e18729aa6cb25751b22bf93a5266a73d7c3abab24ec0881bc5d) |
| outsider setSubregistry (via dev-team) | [`0x27648c97…`](https://sepolia.etherscan.io/tx/0x27648c9712405c6eced91efb0a1022c723fe50170b68fb053d0ecd10f5ec86f0) |
| sre add outsider | [`0xe2827ec4…`](https://sepolia.etherscan.io/tx/0xe2827ec4645584316ef4f1a846763971a480911672bca0ccabc241b153e211c0) |
| outsider setResolver (via security ⊃ sre, two levels up) | [`0x69f1d9e0…`](https://sepolia.etherscan.io/tx/0x69f1d9e0617899357fe6b6ccdde5864e5592055a7d887fd71063acb4d85f3968) |
| operator setSubregistry (native) | [`0x9c3fa106…`](https://sepolia.etherscan.io/tx/0x9c3fa106a2114e7db4a50f2c2d72c86f5fcad9afe4f863fcb5d6a67c2032eafc) |
| dev-team remove outsider | [`0x36cf8f52…`](https://sepolia.etherscan.io/tx/0x36cf8f52acf8afb8af0a2c9054992b7a254bee973224417c20bf81b71e9a90dd) |
| sre remove outsider | [`0x1b9f66d7…`](https://sepolia.etherscan.io/tx/0x1b9f66d718ecdbd063b7fb70c36c5856fb4edf09594d0c48a65e2bc8b91f59c9) |

**Browser run** (the drive's API on Sepolia, 2026-09-26): refused write before joining; dev-team → `SET_SUBREGISTRY` at level 1; sre → `SET_RESOLVER` at level 2; **depth 1 → `SET_RESOLVER` gone and the write mined as refused; depth 2 → back, write succeeded**; new file; the attack (outsider `addTeam`) refused with `EACUnauthorizedAccountRoles`; Start over. Trace of the level-2 write: `setResolver → AcmeLabsRegistry.getSubregistry → getParent → decodeParent → EthRegistry.getSubregistry → AcmeLabsRegistry.roles → EthRegistry.roles → DevTeam.isMember → … → SecurityTeam.isMember → SreTeam.isMember`.

**Deploy 2 — the lazy check** (`npm run setup:v2 -- --write --redeploy`, rehearsed on a fresh fork, then `npm run smoke:v2`): a new `CascadeSubregistryV2` under the same `platform` name; teams, grants and depth carried over. The smoke run starts by removing the outsider from any team the browser demo left them in, then repeats every check — all passed.

| Step | Tx |
|---|---|
| deploy cascade | [`0x053fa6ab…`](https://sepolia.etherscan.io/tx/0x053fa6abaeeb60bad519629a5660866a4a688e1de9d5ca7330dd9bd2cbec10b7) |
| repoint platform subregistry | [`0x881658dc…`](https://sepolia.etherscan.io/tx/0x881658dc33e229baa77ea96b2edf2c5c7e84e44c8c5d3323d05e50b5c89177da) |
| v2 setParent | [`0x3cd29c28…`](https://sepolia.etherscan.io/tx/0x3cd29c28845166f81c64041451b32121e3a08cba46f243adee902ec8cb22dc76) |
| v2 addTeam dev-team | [`0x2de7b532…`](https://sepolia.etherscan.io/tx/0x2de7b532831769aeb7d72ada9f6ec444edd3de47946d8a055a9e5b675c5dfbe6) |
| v2 addTeam security | [`0xae07c49d…`](https://sepolia.etherscan.io/tx/0xae07c49d758459ff22411f23fff88ccac73f6336a275f8393e57301d3e8c44dd) |
| v2 setDepth 2 | [`0x331176c5…`](https://sepolia.etherscan.io/tx/0x331176c51a1db057a37bfb0dfaf1b2a9c8690bd23bc28cdf92e4cdfb40e68e69) |
| register svc-api | [`0x77d08283…`](https://sepolia.etherscan.io/tx/0x77d082831671ff6f86d5e2fb115f84297c8b4929af3848c523693a5a3cabff99) |
| smoke — dev-team remove outsider (clean start) | [`0x9e67a262…`](https://sepolia.etherscan.io/tx/0x9e67a262266b76d144aa838d8332deb5c88514fac9c027513d06c5b44615cd88) |
| smoke — sre remove outsider (clean start) | [`0x4df5b598…`](https://sepolia.etherscan.io/tx/0x4df5b598a2e72b665415d70c0c39584ecfaf4c0d3eafe52e04ab3bb40733e372) |
| smoke — dev-team add outsider | [`0xfe8c45e5…`](https://sepolia.etherscan.io/tx/0xfe8c45e53ddf63d47d367b43771b9a298a9bf1a8671fda7b205a8bf78fd4e27d) |
| smoke — outsider setSubregistry (via dev-team) | [`0x1fa202f0…`](https://sepolia.etherscan.io/tx/0x1fa202f029e51ecc866e7a7e8134861e43f07b1d60bc29cd4fd3ea275da67e1c) |
| smoke — sre add outsider | [`0x53737b6f…`](https://sepolia.etherscan.io/tx/0x53737b6f8eca181dd4dc9153a6319c5e8995a2c27112af6c5224b9f449422ee7) |
| smoke — outsider setResolver (via security ⊃ sre, two levels up) | [`0x40ae7391…`](https://sepolia.etherscan.io/tx/0x40ae7391c4805e7ab8eded10767de2d5867b14f3c44ea48768a58a84f6f274ab) |
| smoke — operator setSubregistry (native) | [`0x841d898c…`](https://sepolia.etherscan.io/tx/0x841d898cf644e03f169a5cc5b9a154a4cc7d59cc56b7c78b8ab128c9678ffc0a) |
| smoke — dev-team remove outsider | [`0xedc5ecb7…`](https://sepolia.etherscan.io/tx/0xedc5ecb7976803d8ccc659b1026ca7b2b1fcd35f5f980d9099c888260bcb9138) |
| smoke — sre remove outsider | [`0xcc886209…`](https://sepolia.etherscan.io/tx/0xcc886209b0e01e1d2c6dd7249edf9478003f09cb5155d7d073603ad82f0bfa14) |

After all of the above, the v1 demo on Sepolia was unchanged (team pointer, `SET_SUBREGISTRY` grant on `devops`, outsider not in the v1 team).

## 6. Gas

**The lazy check (deploy 2) vs the full-union check (deploy 1)** — Sepolia, whole transaction, same actions via `npm run smoke:v2`:

| | Deploy 1 | Deploy 2 | Change |
|---|---|---|---|
| Outsider write via level 1 (dev-team) | 165,723 | 97,665 | −41% (v1 one-hop member write: 91,946) |
| Outsider write via level 2 through the nested team | 148,473 | 138,289 | −7% |
| Native owner write | 36,959 | 36,971 | unchanged (fast path in both) |

**Local benchmark** (`contracts/test/CascadeV2Gas.t.sol`, gas used inside the call, cold; tree: dev-team `SET_SUBREGISTRY` at level 1, sec `SET_RESOLVER` at level 2, depth 2):

| Scenario | Before | After | Change |
|---|---|---|---|
| owner `setSubregistry` | 63,957 | 63,969 | — |
| dev member `setSubregistry` (level 1) | 160,223 | 104,763 | −35% |
| member of both, `setSubregistry` (level 1) | 160,235 | 104,763 | −35% |
| 4 teams, depth 3, dev member `setSubregistry` (level 1) | 207,284 | 100,260 | −52% |
| sec member `setResolver` (level 2) | 143,100 | 132,928 | −7% |
| dev member `setResolver` — denied | 138,125 | 128,028 | −7% |
| non-member `setSubregistry` — denied | 138,159 | 120,367 | −13% |

Where the savings come from: a level-1 answer no longer walks to level 2 (`getParent`, the decode self-call, the second link check and every level-2 grant read), and teams whose grants can't supply the missing role are never asked about membership. Level-2 writes save less because the walk is still needed; denied checks still have to rule out every path, but skip irrelevant membership calls.

Unchanged: the worst-case bound (~553k per lookup with 4 looping teams at depth 3, capped); views pay the full union.

## 7. Tests

`contracts/test/CascadeV2.t.sol`: 18 v2 tests (default depth behaves like v1; teams with different roles; guards; multi-hop with depth, broken links, lying parent pointers, re-issue and expiry at the top; root/admin never inherited; a hostile-ancestor fuzz; gas bounds; fast path makes no lookups for owners, members still look up), 9 team tests (nesting, depth limit, cycles, broken sub-teams, Hats over-cap eligibility, Safe owners), and an invariant over teams × levels against an independent model of the tree. Mutation-checked: removing the link check, the ROOT early return or the admin mask each fails the suite.  The lazy check adds `CascadeV2LazyCheckTest`: a differential fuzz (random teams, memberships, grants at both levels, native roles, depth and multi-role requests including admin bits) asserting the write check always equals the full union, plus two pruning tests (an irrelevant team isn't asked; level 2 isn't read when level 1 covers). The invariant's actors now also try `setResolver` and `renew`, each compared with `hasRoles`. Mutation-checked: answering yes after the first member team, skipping the link check, or skipping membership each fails the suite; removing the admin-bit early exit does not, because it is only a shortcut — grants are already masked to regular bits, so admin bits can never be covered. `contracts/test/CascadeGaps.t.sol` (pitch-3 test gaps, each run on v1 and v2): an operator approved by a member gets nothing; an operator approved by an owner gets only the owner's stored roles, never inherited ones; members can't revoke or transfer; members can unregister only if the parent grants the team `UNREGISTER` (inheritance passes on whatever regular roles the parent grants, destructive ones included); no writes on an expired name; the 15-member cap on `TeamRegistry` and `NestedTeam`; an expired parent ends inheritance in both; and a **v1-vs-v2 equivalence invariant** — the same random actions (joins, grants, native grants, re-issues, time up to 90 days per step, writes of four kinds) on a v1 and a v2 tree must give the same roles and the same write outcomes. The v2 invariant now also warps time, renews, re-registers the file, approves operators, and has actors try `unregister`, `revokeRoles` and transfers. The equivalence holds for honest trees only: v1 trusts its parent pointer, v2 also checks that the parent points back (the mutation removing that check survives the equivalence invariant, as expected, and is caught by the v2 unit tests). Whole repo: 71 Foundry tests pass (2 of them are the opt-in fork tests, which skip offline), plus 3 Halmos proofs.

**Formal verification (Halmos 0.3.3, `npm run prove`, `contracts/test/CascadeSymbolic.t.sol`).** Every argument symbolic — proven for all values, with the parent registries and teams replaced by mocks whose answers are themselves symbolic:

| Property | Result |
|---|---|
| v1: `roles = member ? grant & regular bits : 0`; never an admin bit; nothing inherited at root | **Proven** |
| v2: the lazy write check succeeds exactly when the full union covers the requested roles (2 teams × 2 levels, any grants, memberships and requested bitmap; 22 paths) | **Proven** |
| v2: a parent that doesn't point back down contributes nothing | **Proven** |
| v2: `roles()` equals the union formula | **Inconclusive** — Halmos reports counterexamples (always grants in the top role bits, 2^124–2^127) that pass when replayed concretely on the EVM; not the gas-capped calls or the return-data helper (both checked in isolation). Covered by the fuzz and invariant suites instead; the attempt is kept in the file under an `inconclusive_` prefix. |

Scope of the proofs: the shapes above (bounded loops, mocked neighbours), not the whole system; no external audit.

## 8. Limits

- **Union only.** A subname can't opt out of a grant made above it (Google shared drives behave the same). An opt-out would be a deny rule and would break "inheritance only adds" — deliberately not built.
- Inherited lookups cost more with every team and level; owners don't pay thanks to the fast path, members do.
- Views (`hasRoles`, `roles`) always compute the full answer, so on-chain callers of views pay the full lookup.
- Hats / Safe adapters are not deployed; they are proven against the real Hats v1 and Safe 1.4.1 on a fork (membership lookups 17,420 and 11,273 gas, well under the 100k cap).
- Same limits as v1 otherwise: inherited roles emit no events; ENSv2 beta, not audited.

## 9. The demo tree: orbit-dao.eth

The Cascade tab now runs on its own tree, `npm run setup:v2 -- --write --tree orbit` — a fictional DAO, so the story reads the way web3 judges know it: `orbit-dao.eth` (security-council, which includes the auditors, can edit and set resolvers) › `protocol` (core-devs can edit) › `vault`, `oracle`, `bridge`. Same contracts, same rule, fresh deployment; the `acme-labs.eth` tree above is untouched. Members have their own names in the DAO: `alex.orbit-dao.eth` (the hosted demo's account) and `alex-dev.orbit-dao.eth` (the local one) — ordinary subnames owned by those accounts, which the UI checks on-chain before showing.

| Contract | Address |
|---|---|
| OrgRegistry (`orbit-dao.eth`) | [`0x6e1d2249483700697eb92f959f629fc2ebd6fc48`](https://sepolia.etherscan.io/address/0x6e1d2249483700697eb92f959f629fc2ebd6fc48) |
| CascadeSubregistryV2 (`protocol.orbit-dao.eth`) | [`0x7aa120442ccb9df297d81cd88975e4d9b129d0a3`](https://sepolia.etherscan.io/address/0x7aa120442ccb9df297d81cd88975e4d9b129d0a3) |
| core-devs (TeamRegistry) | [`0x170943bc913b250cb16d3e2720d0d4852e91adb0`](https://sepolia.etherscan.io/address/0x170943bc913b250cb16d3e2720d0d4852e91adb0) |
| security-council (NestedTeam ⊃ auditors) | [`0xce0bdedf8d6afb19c395f0d242395f62f975acfa`](https://sepolia.etherscan.io/address/0xce0bdedf8d6afb19c395f0d242395f62f975acfa) |
| auditors (TeamRegistry) | [`0x63941f63430acb4af79c33d2eb5d6815683b9b62`](https://sepolia.etherscan.io/address/0x63941f63430acb4af79c33d2eb5d6815683b9b62) |

Rehearsed on a fork, then set up and smoke-tested on Sepolia (every check passed):

| Step | Tx |
|---|---|
| deploy org | [`0x11757f8f…`](https://sepolia.etherscan.io/tx/0x11757f8f2649c492ee3ae1167860291fb8c7ecba3544ab23444f9c660cd49f94) |
| deploy cascade | [`0x5cef6324…`](https://sepolia.etherscan.io/tx/0x5cef63244142c4df3b1eedeb40e0c11380c6af569c06084b577e5c223f3fdac9) |
| deploy devTeam | [`0x1493eb00…`](https://sepolia.etherscan.io/tx/0x1493eb00e0b68b1e81ff9914ed4f4a8c27d4716e05fd4288a840b75b5741b642) |
| deploy sre | [`0x97f00d77…`](https://sepolia.etherscan.io/tx/0x97f00d7746c859e14f4030cdf81268cf2a4236893bc7bfcba1d6d14e283e05ad) |
| deploy security | [`0x6099d580…`](https://sepolia.etherscan.io/tx/0x6099d580322f30420504f7b4c70403b1f9285bbf62302b21c54aeb6e77414d8b) |
| usdc approve | [`0x43a36d45…`](https://sepolia.etherscan.io/tx/0x43a36d45919ed0137b20798cd329ee02e83a97db8e684e937553e9eaf6d6ccde) |
| commit | [`0x0be1224e…`](https://sepolia.etherscan.io/tx/0x0be1224ecb872469351ec849c300281a8cc385590c5ece3f7148d34fe3c0b174) |
| register orbit-dao.eth | [`0x0679f921…`](https://sepolia.etherscan.io/tx/0x0679f9210bd4607520ed8a1e997545080ac25fb9caa56b5a99312ddaff6aaa6f) |
| org setParent | [`0xc9fd2d47…`](https://sepolia.etherscan.io/tx/0xc9fd2d473e11ac3a93335fe9f73d933303531630a5ca51313aabda22a0d3018c) |
| register protocol | [`0x75ae8aab…`](https://sepolia.etherscan.io/tx/0x75ae8aab2dc77db8b3f76d97069925d86a9e4c15b373e603d3416ef40f69e756) |
| v2 setParent | [`0xb2eab300…`](https://sepolia.etherscan.io/tx/0xb2eab300b18d35d8313fb28f43dc8961dcdab13b551045c8017f589629d054de) |
| v2 addTeam core-devs | [`0xe935117d…`](https://sepolia.etherscan.io/tx/0xe935117dc6cb579ee5acd05f4d89f7b3c25f54393a46edd961cd3b21fdb8f8a9) |
| v2 addTeam security-council | [`0x470f35e5…`](https://sepolia.etherscan.io/tx/0x470f35e5c02d9f1e41de15593c817de90ec43a9ffe21cdb3a10e43a18e427de4) |
| v2 setDepth 2 | [`0x8865bc30…`](https://sepolia.etherscan.io/tx/0x8865bc306a5dbb28ab01e5bde2314866faf64b271d9e7c709315ef5ad540aec2) |
| security-council addSubTeam auditors | [`0x739e0a0d…`](https://sepolia.etherscan.io/tx/0x739e0a0de15aad653ca80bb2058bb3b0f6b2f6434f6ddb2b09ebd136e4adc561) |
| grant core-devs on protocol | [`0x86694669…`](https://sepolia.etherscan.io/tx/0x866946692949b059c4435655479f8592e09c9001bad51c92b5884f351922664e) |
| grant security-council on orbit-dao.eth | [`0xe5993652…`](https://sepolia.etherscan.io/tx/0xe5993652d345c568e140d27b458cccc05bd3a4565b2bf813e865ff9f24ea21cc) |
| register vault | [`0xee04983b…`](https://sepolia.etherscan.io/tx/0xee04983be228872c6d70dd8e42df4118e966ba61aca65ac13094bb62e9fec590) |
| register oracle | [`0x4ddc084f…`](https://sepolia.etherscan.io/tx/0x4ddc084fb12eb599f88e8c0c4ba7b15741c7213737d40b12a1aceb575de08a24) |
| register bridge | [`0xf3947dcd…`](https://sepolia.etherscan.io/tx/0xf3947dcd99f68e8ed437579687f6360b3f12a4186aeeba7198dd19e109f1753a) |
| register alex.orbit-dao.eth | [`0x0bc3ca8c…`](https://sepolia.etherscan.io/tx/0x0bc3ca8ceef5c16fec1f8cca6d52719272921f37c10af3ce553b60e8c4bbeda9) |
| register alex-dev.orbit-dao.eth | [`0x0f7ce06f…`](https://sepolia.etherscan.io/tx/0x0f7ce06fd40eafd960bac0b2e4ec3dfd511a3e4dc366f12cbb396e4c2ffbd560) |
| smoke: core-devs add outsider | [`0xcc754467…`](https://sepolia.etherscan.io/tx/0xcc7544678087288b1ce770be3bea24c5e20750e28f843febe4d5b0418db0d6ee) |
| smoke: outsider setSubregistry (via core-devs) | [`0x9100b63e…`](https://sepolia.etherscan.io/tx/0x9100b63e086a80f7dbf2c141e45acfd1405e17b08aa19c35490babe7c932869e) |
| smoke: auditors add outsider | [`0xc4b09b45…`](https://sepolia.etherscan.io/tx/0xc4b09b45040496fce431a91f572e7797ce3513fcd345af344bc836a91e822479) |
| smoke: outsider setResolver (via security-council ⊃ auditors, two levels up) | [`0x13cf1232…`](https://sepolia.etherscan.io/tx/0x13cf1232dffda9986c0a13040a6a2dacd218bfe68caf57c61eeef94772610c7e) |
| smoke: operator setSubregistry (native) | [`0xa93a35bc…`](https://sepolia.etherscan.io/tx/0xa93a35bccb8b4a91502a3af39b85f95cf1dc95aef23a504349eac149705129c1) |
| smoke: core-devs remove outsider | [`0x2e6202c5…`](https://sepolia.etherscan.io/tx/0x2e6202c5c6666f161043acf57a084111dc4159a6a77a72f89b1b50a02b597272) |
| smoke: auditors remove outsider | [`0xc7be2084…`](https://sepolia.etherscan.io/tx/0xc7be208490e152fe460bd55bdaa5d0292a9f2c8752d047fb3e184118b7e4a6c2) |
