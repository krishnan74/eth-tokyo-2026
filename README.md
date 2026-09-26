# ENS Drive — Google Drive–style sharing for ENS names

Built at ETHGlobal Tokyo 2026 on the ENSv2 beta deployment on Sepolia. *ENS Drive* is the product; *Cascade* is its permission layer — `CascadeSubregistryV2` (the cascade: several teams, teams of teams, sharing that flows down the tree) and the first, one-folder version `CascadeSubregistry`. **Live demo: https://ens-drive.vercel.app** · everything about the cascade version: [`docs/roadmap-v2.md`](docs/roadmap-v2.md) · submission copy: [`docs/submission.md`](docs/submission.md).

**ENSv2 already built the directory tree:** every name can have its own registry, so names nest like folders (`orbit-dao.eth › protocol › vault`). **What's missing is the permission layer:** Enhanced Access Control grants roles one address on one name, in each folder's own registry, so there's no way to share a folder with a group. **ENS Drive adds that layer with Cascade, a relationship-based access control (ReBAC) rule inside EAC:** a name grants a role to a team contract, and the team's members inherit it on every name below it — current and future, up to three folders down, through teams inside teams — checked live, with nothing copied onto the names. One role write to join or leave; nothing EAC does today is replaced.

## What is new, and what is stock ENSv2

| Piece | Code |
|---|---|
| `orbit-dao.eth` registration (commit–reveal via the beta `ETHRegistrar`), its org registry, and the grants to teams | stock `PermissionedRegistry` (`contracts-v2@48b3e2d`), ordinary `grantRoles` calls |
| **`CascadeSubregistryV2`** — `PermissionedRegistry` overriding EAC's `_getRoles` hook (full union, for views) and `_checkRoles` (lazy, for writes); up to 4 teams, depth 1–3, a link check at each level, `explain()` | [`CascadeSubregistryV2.sol`](contracts/src/CascadeSubregistryV2.sol) — **the contribution** |
| Teams: `TeamRegistry` (a roster in native EAC), `NestedTeam` (teams of teams), `HatsTeam` / `SafeTeam` (bring your own roster) — anything with `isMember` and ERC-165 | [`TeamRegistry.sol`](contracts/src/TeamRegistry.sol), [`teams/`](contracts/src/teams/) |
| `CascadeSubregistry` — the first version: one parent, one team, `_getRoles` only | [`CascadeSubregistry.sol`](contracts/src/CascadeSubregistry.sol) |

## The demo (live on Sepolia)

**The cascade drive** (the live site's default tab), on a fictional DAO: `orbit-dao.eth` is shared with the **security-council** (a `NestedTeam` that includes the **auditors**) for edit and set-resolver; its folder `protocol` is shared with **core-devs** for edit; `protocol` holds three contract names, `vault`, `oracle` and `bridge`.

1. Alex (`alex.orbit-dao.eth`, a new contributor) tries to edit `vault` → **reverted on-chain**.
2. Alex is added to core-devs (one role write on the team) → all three names are editable at once.
3. Alex moves to the auditors → still editable: the security council's grant on `orbit-dao.eth` flows two folders down, through the team inside the team.
4. "Sharing flows into subfolders" off (`setDepth(1)`) → **reverted**; on again → allowed.
5. Alex tries to add an always-yes group (`addTeam`) → **reverted** (`EACUnauthorizedAccountRoles`).

Addresses and every setup and smoke transaction: [`docs/roadmap-v2.md` §9](docs/roadmap-v2.md#9-the-demo-tree-orbit-daoeth).

**The one-folder version** (second tab, and the eight-step terminal demo) on `devops.acme-corp.eth`: the parent grants `TeamRegistry` a role on `devops`; an outsider is refused on a brand-new `svc-…` name, allowed once added to the team, refused again once removed; the always-true team pointer is refused, a wallet as the team is refused (`TeamNotContract`), and re-issuing `devops` ends the team's grant. Every step has a tx hash in [`docs/evidence.md`](docs/evidence.md).

Clone with `--recurse-submodules` (ENSv2's `contracts-v2` is a pinned submodule; Foundry and Node are needed). `npm test` and the UI build need no keys; for anything that sends transactions, `cp .env.example .env` and fill in a Sepolia RPC URL and the two demo keys.

```bash
npm install && forge build
npm test                              # 71 Foundry tests: unit, fuzz, invariants, gaps, gas (2 fork tests opt-in)
npm run prove                         # 3 Halmos symbolic proofs (pip install halmos)
npm run test:fork                     # HatsTeam / SafeTeam against the real Hats v1 and Safe 1.4.1 on a Sepolia fork
npm run smoke:v2                      # the cascade checks, live on Sepolia (orbit-dao.eth)
npm run setup:v2 -- --write           # deploy/wire the cascade tree (idempotent; already done)
npm run demo                          # the one-folder eight steps, live on Sepolia (--step to present, --recap to replay)
```

## Web UI

**Hosted:** https://ens-drive.vercel.app — the full demo, same as local: real Sepolia transactions and live `cast run` traces. It signs with its own least-privilege keys (see below), so every visitor shares one Alex and one set of teams.

A deliberately simple page, shaped by ENS team feedback, that frames Cascade like a shared drive. In order: the hero, the problem ("In ENS today / With ENS Drive"), **Try it**, **Behind the scenes**, **Under the hood** (the contracts and the path of a two-level write), and a collapsed **More detail** (why not root grants, how it fits, limits, transaction history). A link-preview image is generated for sharing. Light theme by default, with a toggle.

- **Cascade** tab (default, `CascadeSubregistryV2` on `orbit-dao.eth`): an 8-step guide from the DAO lead's side, with a one-line setup ("orbit-dao.eth is shared with the security council, protocol with core-devs"). Drag Alex into a team: the chip moves at once while the transaction confirms (optimistic), and the three names flip to "can edit" when it lands. Off the main path: the security council's extra "set resolver" permission, + New file, the attack, Start over.
- **One folder** tab (`CascadeSubregistry` on `devops.acme-corp.eth`): the original one-level drive, unchanged.

After each action the result bar shows the block, the time it took and an Etherscan link, and a small **"On-chain, just now"** card appears bottom-right — each contract call in plain words ("Is this person in core-devs?"), closable. **Behind the scenes** below replays the mined transaction with Foundry's `cast run` and shows the EVM's own call tree — `setSubregistry` → `getSubregistry` (does the folder above point back down?) → `roles(protocol, core-devs)` → `isMember(alex)` → … → emit or revert — with gas, return values and revert reasons decoded into names. If the full replay isn't available from the RPC it falls back to `cast run --quick`, labelled as such.

The contract-level architecture, with diagrams and the exact function chain, is in [`docs/architecture.md`](docs/architecture.md); what to say when walking someone through it is in [`docs/architecture-talk.md`](docs/architecture-talk.md); the pitch is in [`docs/pitch-finalist.md`](docs/pitch-finalist.md).

```bash
npm run ui                             # http://localhost:3000 — reads Sepolia live, sends real transactions
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545 CASCADE_RPC_URL=http://127.0.0.1:8545 npm run ui   # rehearse on an anvil fork
```

- **Who signs:** the keys stay in the repo's `.env` and sign on the Next.js server (`web/lib/cascade/server.ts`, `v2server.ts`), exactly as the terminal scripts do. The browser never sees a key; nothing is shown as landed before its receipt.
- **Transactions are on only for a local dev server** (or with `CASCADE_UI_WRITES=1`). A public deployment would otherwise let anyone spend the operator's Sepolia ETH; without writes, the page still reads everything live.
- **The hosted copy** (Vercel, project `ens-drive`) signs with **dedicated keys**, not the main operator's: `npm run setup:hosted -- --write` gives the hosted operator only what the buttons need — `ROLE_REGISTRAR` and `ROLE_SET_TEAM` on the cascade registries and `ROLE_MEMBER_ADMIN` on the teams — and funds it with a fixed budget (default 0.2 Sepolia ETH). It can't touch the org names, the folders or the grants to teams. Keys live in `.env.hosted` locally (never committed or uploaded; `.vercelignore` excludes `.env*`) and as sensitive Vercel env vars with `CASCADE_UI_WRITES=1`. Abuse limits: per-visitor rate limits (20 transactions and 60 traces per hour, 300 transactions per day per server instance — best-effort, in memory), a balance guard that stops sending under 0.01 ETH, one transaction at a time per instance, and traces only for the demo's own transactions. Traces use a pinned, checksum-verified Linux `cast` fetched at build time (`scripts/fetch-cast.sh`). Deploy with `npx vercel deploy --prod` from the repo root.
- **Shared core:** addresses, ABIs, the three-check chain and the cost numbers live in [`core/cascade/`](core/cascade/), imported by the scripts and the UI, so they cannot disagree. After a contract change or redeploy: `forge build && npm run gen` (`CASCADE_TREE=orbit|acme` picks the v2 tree; default orbit).

## How the cascade works

EAC documents `_getRoles(resource, account)` as the hook for injecting role logic at read time; `PermissionedRegistry` already uses it to give ERC1155-approved operators the owner's roles. `CascadeSubregistryV2` overrides it, and the write-side `_checkRoles`:

- For any **non-root** resource, an account's roles are its own roles, plus, for each of the registry's teams (up to 4) that the account is a member of, the **regular** roles each ancestor registry (up to `depth` 1–3 levels up, via stock `getParent`) grants that team on the path down.
- **Each level must point back down:** an ancestor counts only if its `getSubregistry(label)` returns the child below it, so a registry can't adopt a parent that doesn't claim it.
- **Writes are lazy:** own roles first (an owner pays no external call), then one level at a time; a team's membership is asked only if its grants cover a still-missing role; stop when covered. Same yes/no as the full union because inheritance only adds roles — checked by a differential fuzz test and a Halmos proof. Views (`hasRoles`, `roles`, `explain`) compute the full union, since `hasRoles` isn't virtual.
- **Admin bits are masked off**, so members can never grant or revoke. **Root is never inherited**, so register, setParent, addTeam, setDepth and upgrades stay native-only.
- Every external call is a STATICCALL (view context, so a callback cannot change state) with a fixed gas cap (`isMember` 100k, parent `roles` and link checks 50k) and bounded return data. Malformed data, reverts and gas exhaustion all fail closed without affecting native holders.

The **teams** need `ROLE_SET_TEAM` on root to add or remove, must be contracts declaring `ITeam` via ERC-165, and every change emits an event. The deliberate trust assumption: whoever holds `ROLE_SET_TEAM` is trusted to add genuine team contracts — a contract can lie about ERC-165.

**Invalidation** needs no extra code: inherited roles are read live from each ancestor's *current* EAC resource, so unregistering, expiry, or re-registration of an ancestor name ends the team's authority exactly as it ends every native grant on it (tests; the one-folder demo's step 8). A **transfer** keeps third-party grants in place — stock ENSv2 behaviour for every delegate; the new owner can revoke in one call.

The one-folder `CascadeSubregistry` is the same rule with one parent, one team (`setTeam`), `_getRoles` only, and caps of 30k / 50k.

**Gas (Sepolia):** a member's write through one level costs 97,665 (the first, full-union v2: 165,723; the one-folder version: 91,946), through two levels and the nested team 138,289; an owner's write 36,971. Details: [`docs/roadmap-v2.md` §6](docs/roadmap-v2.md#6-gas).

## Design questions for the ENS team

1. **Holder discovery.** EAC exposes holder *counts* (`roleCount`, `getAssigneeCount`), not holder *identities*, so Cascade stores team pointers and reads the grants to them live. Is that the right shape, or would you rather see holder enumeration?
2. **Extension points.** Is overriding `_getRoles` (and a lazy `_checkRoles` that knows the requested role) the intended use for cross-contract inheritance? Would ENS make `hasRoles` `virtual`, so views can short-circuit too?
3. **Is this worth it over root grants?** Root grants already cover new subnames in one registry. Cascade's case is one roster shared by many registries and many levels, and separating team admins from namespace admins.
4. **The team's role on the folder itself.** A team contract also holds its role in the parent registry. `TeamRegistry` and `NestedTeam` have no function that could exercise it; a team contract that could make arbitrary calls would be able to repoint the namespace.

Rehearsed answers to the questions this usually raises are in [`docs/qa.md`](docs/qa.md); the third pitch's feedback and what was built from it in [`docs/feedback/ens-pitch-3.md`](docs/feedback/ens-pitch-3.md); the audit items and how each was resolved in [`docs/remediation.md`](docs/remediation.md).

## Roadmap

Steps 0–4 are built (status in [`docs/plan.md`](docs/plan.md#roadmap-from-the-mvp-rule-to-full-rebac)): one hop (live), many teams per role, teams of teams and multi-hop names (live on Sepolia, the cascade demo), bring-your-own roster (Hats / Safe adapters, fork-tested against the real contracts, not deployed). Next, after ENS feedback: who-can-access queries, resolver-record relations (a separate mechanism), agent fleets as the use case, and wallet connection so visitors can be Alex themselves.

## Honest limits

- **Union only.** A name can't opt out of a grant made above it (deliberate: a deny rule would break "inheritance only adds").
- **Bounded:** up to 4 teams per registry, 3 levels up, 3 levels of team nesting. Members pay more with each team and level; owners don't.
- **Views pay the full lookup** (`hasRoles` isn't virtual); for a member they also report the role on unregistered labels (writes there still revert).
- **No off-chain computation, proof, or relayer.** Everything is on-chain view calls. Inherited roles emit no events; indexers should call `hasRoles()`.
- **`TeamRegistry` inherits EAC's 15-assignees-per-role cap.** A small team, not an org chart (nest teams for more).
- **Not a tokenized subname.** The child's ERC1155 never moves; membership is a role write on a team.
- **Beta deployment, not production ENS; not audited; not source-verified on Etherscan.** ENS addresses are in [`scripts/lib.ts`](scripts/lib.ts), verified behaviourally on 2026-09-26.
