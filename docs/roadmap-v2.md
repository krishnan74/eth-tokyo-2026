# Roadmap v2 — many teams, teams of teams, multi-hop names

> Branch `roadmap/full-rebac` only. The submitted demo (`main`, `acme-corp.eth`) is unchanged and still runs v1, the one-hop MVP. Everything here runs on its own name tree, `acme-labs.eth`, deployed from this branch; no transaction touches a v1 contract, name or grant.

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
| **Native-first fast path** in `_checkRoles` | If the caller's stored roles already cover a write, no team or ancestor is consulted. Same outcome (inheritance only adds), no overhead for owners. `hasRoles` isn't `virtual` in `PermissionedRegistry`, so views still compute the full answer. |
| `explain()` reports which team and level supplied a role; `ancestry()` returns the verified path | For the UI and for debugging. |

## 3. Contracts

| Contract | File | Address (Sepolia) |
|---|---|---|
| `CascadeSubregistryV2` for `platform.acme-labs.eth` (depth 2, teams dev-team + security) | `contracts/src/CascadeSubregistryV2.sol` | [`0xa6b159d2e785a6146d9e21a1cc377b781e70a246`](https://sepolia.etherscan.io/address/0xa6b159d2e785a6146d9e21a1cc377b781e70a246) |
| Org registry for `acme-labs.eth` (stock `PermissionedRegistry`, parent = `.eth` registry) | stock ENSv2 | [`0x35888867cc0c37d54ae0f902611ec4a5b8a73beb`](https://sepolia.etherscan.io/address/0x35888867cc0c37d54ae0f902611ec4a5b8a73beb) |
| dev-team (`TeamRegistry`) | `contracts/src/TeamRegistry.sol` | [`0xaa75275e77f89267f28a5bbf2f7f40b920941253`](https://sepolia.etherscan.io/address/0xaa75275e77f89267f28a5bbf2f7f40b920941253) |
| security (`NestedTeam`, contains sre) | `contracts/src/teams/NestedTeam.sol` | [`0x179aa1bac7758557defe517330147afd55f54134`](https://sepolia.etherscan.io/address/0x179aa1bac7758557defe517330147afd55f54134) |
| sre (`TeamRegistry`) | `contracts/src/TeamRegistry.sol` | [`0x2bd2a5bf158ec73ab1c8d1989e4b3b200d055163`](https://sepolia.etherscan.io/address/0x2bd2a5bf158ec73ab1c8d1989e4b3b200d055163) |
| `HatsTeam`, `SafeTeam` | `contracts/src/teams/` | not deployed — tested with mocks; no real hat or Safe to point at yet |

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

**The home page's drive, on this branch** (local only, like the v1 demo's writes; signs with the repo's `.env` keys, which own the v2 tree; `main` and the hosted site keep the v1 drive): two folder levels, `acme-labs.eth` shared with **security** (can set resolvers) and `platform` shared with **dev-team** (can edit); drag the outsider into dev-team, or into **sre** inside security; a switch "sharing on acme-labs.eth reaches platform's files" (`setDepth` 2 / 1); per file, both permissions with "Edit as outsider" / "Set resolver as outsider"; Who has access shows which group and which folder level each permission comes from (`explain()`); an 11-step guide; the attack (outsider `addTeam(AlwaysTrueTeam)`, refused); Start over; and the live `cast run` trace, which for a level-2 write shows the whole walk: link check → `getParent` → link check → grants at both levels → dev-team, then security → sre.

## 5. Evidence (Sepolia)

**Setup** (`npm run setup:v2 -- --write`, after a rehearsal on an anvil fork):

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

**Smoke run** (`npm run smoke:v2`): outsider refused both roles → joined dev-team → `setSubregistry` allowed via level 1, `setResolver` still refused → joined sre → `setResolver` allowed via security two levels up → operator's native write → left both → refused again.

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

After all of the above, the v1 demo on Sepolia was unchanged (team pointer, `SET_SUBREGISTRY` grant on `devops`, outsider not in the v1 team).

## 6. Gas

| | Gas | Where |
|---|---|---|
| Outsider write via level 1 (dev-team) | 165,723 | Sepolia, whole transaction |
| Outsider write via level 2 through the nested team | 148,473 | Sepolia, whole transaction |
| Native owner write (fast path) | 36,959 | Sepolia, whole transaction |
| Native owner `setSubregistry`, 2 teams, depth 1 / depth 3, without → with fast path | 89,355 / 133,017 → 40,293 | local, warm |
| Worst-case inherited lookup, 4 looping teams, depth 3 | ~553k (bounded by caps) | local |

## 7. Tests

`contracts/test/CascadeV2.t.sol`: 18 v2 tests (default depth behaves like v1; teams with different roles; guards; multi-hop with depth, broken links, lying parent pointers, re-issue and expiry at the top; root/admin never inherited; a hostile-ancestor fuzz; gas bounds; fast path makes no lookups for owners, members still look up), 9 team tests (nesting, depth limit, cycles, broken sub-teams, Hats over-cap eligibility, Safe owners), and an invariant over teams × levels against an independent model of the tree. Mutation-checked: removing the link check, the ROOT early return or the admin mask each fails the suite. Whole repo: 51 tests pass.

## 8. Limits

- **Union only.** A subname can't opt out of a grant made above it (Google shared drives behave the same). An opt-out would be a deny rule and would break "inheritance only adds" — deliberately not built.
- Inherited lookups cost more with every team and level; owners don't pay thanks to the fast path, members do.
- Views (`hasRoles`, `roles`) always compute the full answer, so on-chain callers of views pay the full lookup.
- Hats / Safe adapters are not deployed.
- Same limits as v1 otherwise: inherited roles emit no events; ENSv2 beta, not audited.
