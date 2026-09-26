# ENS Drive — Google Drive–style sharing for ENS names

Built at ETHGlobal Tokyo 2026 on the ENSv2 beta deployment on Sepolia. *ENS Drive* is the product; *Cascade* is its permission layer — `CascadeSubregistryV2` (the cascade: several teams, teams of teams, sharing that flows down the tree) and the first, one-folder version `CascadeSubregistry`. **Live demo: https://ens-drive.vercel.app** · everything about the cascade version: [`docs/roadmap-v2.md`](docs/roadmap-v2.md).

**ENSv2 already built the directory tree:** every name can have its own registry, so names nest like folders (`acme-corp.eth › devops › svc-api`). **What's missing is the permission layer:** Enhanced Access Control grants roles one address on one name, so there's no way to share a folder with a group. **ENS Drive adds that layer with Cascade, a relationship-based access control (ReBAC) rule inside EAC:** a parent name grants a role to a team contract, and the team's members inherit it on every subname under it — current and future — checked live, with nothing copied onto the names. One role write to join or leave; nothing EAC does today is replaced.

## What is new, and what is stock ENSv2

| Piece | Code |
|---|---|
| `acme-corp.eth` registration (commit–reveal via the beta `ETHRegistrar`) | stock |
| Org registry for `acme-corp.eth` | stock `PermissionedRegistry` (`contracts-v2@48b3e2d`), unmodified |
| Granting `TeamRegistry` `ROLE_SET_SUBREGISTRY` on `devops` | one ordinary `grantRoles` call |
| `TeamRegistry` — roster in native EAC, plus `isMember` and ERC-165 | [`TeamRegistry.sol`](contracts/src/TeamRegistry.sol) |
| **`CascadeSubregistry`** — `PermissionedRegistry` overriding EAC's `_getRoles` hook, a validated `team` pointer, `explain()` | [`CascadeSubregistry.sol`](contracts/src/CascadeSubregistry.sol) — **the only real contribution** |

## The demo (live on Sepolia — every step has a tx hash in [`docs/evidence.md`](docs/evidence.md))

1. The org registry grants `TeamRegistry` `ROLE_SET_SUBREGISTRY` on `devops`. Native EAC.
2. A brand-new `svc-….devops.acme-corp.eth` is registered. An outsider calls `setSubregistry` on it → **reverted on-chain**.
3. The outsider is granted `MEMBER` on `TeamRegistry`.
4. Same write → **succeeds**, on a name that did not exist when anyone was granted anything. The stock `hasRoles()` now reports the role too.
5. `MEMBER` revoked → same write **reverted**, immediately.
6. The outsider tries to point the fallthrough at an attacker's always-true team contract → **reverted** (`EACUnauthorizedAccountRoles`: no `ROLE_SET_TEAM`).
7. The operator, who holds `ROLE_SET_TEAM`, tries to set a plain wallet as the team → **reverted** (`TeamNotContract`).
8. The parent re-issues `devops` (unregister + register). Same pointer, same member → write **reverted**: the team's grant was scoped to the old registration.

Clone with `--recurse-submodules` (ENSv2's `contracts-v2` is a pinned submodule; Foundry and Node are needed). `npm test` and the UI build need no keys; for anything that sends transactions, `cp .env.example .env` and fill in a Sepolia RPC URL and the two demo keys.

```bash
npm install && forge build
npm test                              # 17 unit tests + 5 fuzz + 5 invariants
npm run demo                          # the eight steps, live on Sepolia (setup already done)
npm run demo -- --step                # same, waits for Enter between steps — for presenting
npm run demo -- --core                # steps 1–5 only
npm run demo -- --recap               # replay the last run's visuals (no transactions)
npm run setup -- --rpc http://127.0.0.1:8545   # rehearse on `anvil --fork-url $SEPOLIA_RPC_URL`
```

## Web UI

**Hosted:** https://ens-drive.vercel.app — the full demo, same as local: real Sepolia transactions and live `cast run` traces. It signs with its own least-privilege keys (see below), so every visitor shares one outsider and one team.

A deliberately simple page, shaped by ENS team feedback, that frames Cascade like a shared drive. The **Try it** section has two tabs:

- **Cascade** (default, `CascadeSubregistryV2` on `acme-labs.eth`): two folder levels — `acme-labs.eth` shared with **security**, `platform` shared with **dev-team**, both "can edit". An 8-step guide: the outsider is refused, is dragged into dev-team and can edit, is dragged into **sre** (a team inside security) and can still edit because sharing on the folder above flows down, then the "Sharing flows into subfolders" switch (`setDepth` 2/1) turns that off and on. Who can edit shows which group and which folder each permission comes from (`explain()`). One step off the main path: security's extra "set resolver" permission (each team gets its own roles), + New file, and the attack (outsider `addTeam(AlwaysTrueTeam)`, refused). A file (`svc-api`) is there from the start, so the first click is already the demo.
- **One folder** (`CascadeSubregistry` on `devops.acme-corp.eth`): the original one-level drive, unchanged.

After each action the result bar shows the block, the time it took and an Etherscan link, and a small **"On-chain, just now"** card appears bottom-right — each contract call in plain words, outside the drive and closable; **Behind the scenes** below shows the full `cast run` call tree. The problem ("In ENS today / With ENS Drive") sits right before the demo, then **Under the hood** (the contracts and the path of a two-level write) and a collapsed **More detail** (workarounds, how it fits, roadmap, questions for ENS, limits, transaction history). A link-preview image is generated for sharing.

**Behind the scenes, live:** after each action the server replays the mined transaction with Foundry's `cast run` and the page shows the EVM's own call tree — `setSubregistry` → `OrgRegistry.roles(devops, TeamRegistry)` → `TeamRegistry.isMember(outsider)` → emit or revert — with gas, return values and revert reasons decoded into names. If the full replay isn't available from the RPC it falls back to `cast run --quick`, labelled as such. Needs Foundry on the machine running the UI (the same local-only setup as its transactions). "Start over" removes the outsider from the team if a previous run left them in. Light theme by default, with a toggle.

The contract-level architecture, with diagrams and the exact function chain, is in [`docs/architecture.md`](docs/architecture.md); what to say when walking someone through it is in [`docs/architecture-talk.md`](docs/architecture-talk.md).

```bash
npm run ui                             # http://localhost:3000 — reads Sepolia live, sends real transactions
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545 CASCADE_RPC_URL=http://127.0.0.1:8545 npm run ui   # rehearse on an anvil fork
```

- **Who signs:** the operator and outsider keys stay in the repo's `.env` and sign on the Next.js server (`web/lib/cascade/server.ts`), exactly as the terminal demo does. The browser reads the chain through wagmi and waits for every receipt itself; nothing is shown as landed before it has.
- **Transactions are on only for a local dev server** (or with `CASCADE_UI_WRITES=1`). A public deployment would otherwise let anyone spend the operator's Sepolia ETH; without writes, the page still reads everything live.
- **The hosted copy** (Vercel, project `ens-drive`) signs with **dedicated keys**, not the main operator's: `npm run setup:hosted -- --write` gives the hosted operator only `ROLE_REGISTRAR` on CascadeSubregistry (for "+ New file") and `ROLE_MEMBER_ADMIN` on TeamRegistry (for adding/removing members) and funds it with a fixed budget (default 0.2 Sepolia ETH) — it can't touch `acme-corp.eth`, `devops`, the team pointer or the parent's grant. Keys live in `.env.hosted` locally (never committed or uploaded; `.vercelignore` excludes `.env*`) and as sensitive Vercel env vars with `CASCADE_UI_WRITES=1`. Abuse limits: per-visitor rate limits (20 transactions and 60 traces per hour, 300 transactions per day per server instance — best-effort, in memory), a balance guard that stops sending under 0.01 ETH, one transaction at a time per instance, and traces only for the demo's own transactions. Traces use a pinned, checksum-verified Linux `cast` fetched at build time (`scripts/fetch-cast.sh`). Deploy with `npx vercel deploy --prod` from the repo root.
- **Shared core:** addresses, ABIs, the three-check chain and the cost numbers live in [`core/cascade/`](core/cascade/), imported by both `scripts/demo.ts` and the UI, so the two cannot disagree. After a contract change or redeploy: `forge build && npm run gen`.
- The terminal demo is unchanged in behaviour and also covers the wallet-as-team and parent re-issue edge cases, which the UI leaves out.

## How the fallthrough works

EAC documents `_getRoles(resource, account)` as the hook for injecting role logic at read time; `PermissionedRegistry` already uses it to give ERC1155-approved operators the owner's roles. `CascadeSubregistry` overrides the same hook:

- For any **non-root** resource, an account's roles are its own roles, plus — if `team.isMember(account)` — the **regular** roles the parent currently grants `team` on this registry's label (`parent.roles(label, team)`).
- **Admin bits are masked off**, so members can never grant or revoke. **Root is never inherited**, so register, setParent, setTeam and upgrades stay native-only.
- Because it is the hook, everything agrees: writes (`_checkRoles`), the public `hasRoles` / `roles` views, and `explain()`. `nativeRoles()` exposes the stock-only view.
- Both external calls are STATICCALLs (they run in view context, so a callback cannot change state) with fixed gas caps (`isMember` 30k, parent `roles` 50k). Malformed return data, reverts, and gas exhaustion all fail closed without affecting native holders.

The **`team` pointer** needs `ROLE_SET_TEAM` on root, must be a contract, must declare `ITeam` via ERC-165, and every change emits `TeamPointerUpdated(old, new, by)`. The deliberate trust assumption: whoever holds `ROLE_SET_TEAM` is trusted to point it at a genuine team contract — a contract can lie about ERC-165.

**Invalidation** needs no extra code: the inherited roles are read live from the parent's *current* EAC resource for the label, so unregistering, expiry, or re-registration of the parent name ends the team's authority exactly as it ends every native grant on it (demo step 8; tests). A parent **transfer** keeps third-party grants in place — stock ENSv2 behaviour for every delegate, not specific to Cascade; the new owner can revoke in one call.

## Design questions for the ENS team

1. **Holder discovery.** The plan was to "look up who holds the role on the parent". EAC exposes holder *counts* (`roleCount`, `getAssigneeCount`), not holder *identities*, so `CascadeSubregistry` stores a `team` pointer and reads the parent's grant to it live. Is that the right shape, or would you rather see holder enumeration?
2. **Is overriding `_getRoles` the intended use of the hook for cross-contract inheritance?** It makes `hasRoles` truthful, but every non-root role lookup on this registry now makes up to two external calls — including for native owners (≈2.3k gas extra per write, measured locally).
3. **Is this worth it over root grants?** Root grants already cover new subnames in one registry. Cascade's case is one roster shared by many registries, and separating team admins from namespace admins.
4. **`ROLE_SET_SUBREGISTRY` on `devops` itself.** The team contract also holds it in the parent. `TeamRegistry` has no function that could exercise it; a team contract that could make arbitrary calls would be able to repoint the namespace.

Rehearsed answers to the questions this usually raises (root grants, a compromised team contract, what `explain()` proves, token-ID mutation) are in [`docs/qa.md`](docs/qa.md). The audit items and how each was resolved are in [`docs/remediation.md`](docs/remediation.md).

## Roadmap

The MVP is deliberately **one hop and one team per registry**. Planned next, in this hackathon: many teams per role, teams of teams, bounded multi-hop inheritance up the name tree, and bring-your-own roster (Hats / Safe) behind `isMember()`. After ENS feedback: who-can-access queries, resolver-record relations (a separate mechanism), and agent fleets as the use case. Details and status in [`docs/plan.md`](docs/plan.md#roadmap-from-the-mvp-rule-to-full-rebac).

**On this branch (`roadmap/full-rebac`), steps 1–4 are built:** `CascadeSubregistryV2` (up to 4 teams, inheritance up to 3 levels with a link check at each level, a native-first fast path for owners), `NestedTeam` (teams of teams), and `HatsTeam` / `SafeTeam` roster adapters. Steps 1–3 are live on Sepolia on a separate tree, `acme-labs.eth`, which never touches the demo's `acme-corp.eth`; the adapters are tested with mocks only. Try it with `npm run ui` — on this branch the home page's drive runs on v2 (two folder levels, two groups, a cascade switch) — or `npm run smoke:v2` in the terminal. Everything about v2 — rule, contracts, addresses, evidence, gas, limits — is in [`docs/roadmap-v2.md`](docs/roadmap-v2.md). The submitted demo on `main` is unchanged.

## Honest limits

- **One hop only.** A grant two levels above the new subname is not found. A deeper tree needs a `CascadeSubregistry`, with its own team and parent, at each level that should inherit.
- **No off-chain computation, proof, or relayer.** Everything is on-chain view calls.
- **`TeamRegistry` inherits EAC's 15-assignees-per-role cap.** A small team, not an org chart.
- **Not a tokenized subname.** The child's ERC1155 never moves; membership is a role write on `TeamRegistry`.
- **Beta deployment, not production ENS.** Addresses are in [`scripts/lib.ts`](scripts/lib.ts), verified behaviourally on 2026-09-26.
- **`explain().allowed` does not check expiry.** The write path rejects an expired name first; `explain()` reports roles only.
