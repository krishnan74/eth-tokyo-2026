# ENS Drive — Google Drive–style sharing for ENS names

A feedback demo for the ENS team, on the ENSv2 beta deployment on Sepolia. *ENS Drive* is the product; *Cascade* is its permission layer (the `CascadeSubregistry` contract).

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

```bash
npm install && forge build
npm test                              # 17 Foundry tests
npm run demo                          # the eight steps, live on Sepolia (setup already done)
npm run demo -- --step                # same, waits for Enter between steps — for presenting
npm run demo -- --core                # steps 1–5 only
npm run demo -- --recap               # replay the last run's visuals (no transactions)
npm run setup -- --rpc http://127.0.0.1:8545   # rehearse on `anvil --fork-url $SEPOLIA_RPC_URL`
```

## Web UI

A deliberately simple page, shaped by ENS team feedback, that frames Cascade like a shared drive: **the problem** (in ENS today it is like sharing each file with each person; with Cascade you share the folder with a group), **try it** (a minimal shared-drive view on real Sepolia contracts — the `devops` folder is a name with its own registry, files are subnames, the `devops-team` group is TeamRegistry; drag the outsider into the group and every file becomes editable, with a "Who has access · via devops-team" panel), and **under the hood** (the three contracts, what each stores, the path of a write, and how the override reaches ENS's own code). Everything else — workarounds, how it fits, roadmap, questions for ENS, limits, transaction history — sits in a collapsed "More detail" section.

**Behind the scenes, live:** after each action the server replays the mined transaction with Foundry's `cast run` and the page shows the EVM's own call tree — `setSubregistry` → `OrgRegistry.roles(devops, TeamRegistry)` → `TeamRegistry.isMember(outsider)` → emit or revert — with gas, return values and revert reasons decoded into names. If the full replay isn't available from the RPC it falls back to `cast run --quick`, labelled as such. Needs Foundry on the machine running the UI (the same local-only setup as its transactions). "Start over" removes the outsider from the team if a previous run left them in. Light theme by default, with a toggle.

The contract-level architecture, with diagrams and the exact function chain, is in [`docs/architecture.md`](docs/architecture.md); what to say when walking someone through it is in [`docs/architecture-talk.md`](docs/architecture-talk.md).

```bash
npm run ui                             # http://localhost:3000 — reads Sepolia live, sends real transactions
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545 CASCADE_RPC_URL=http://127.0.0.1:8545 npm run ui   # rehearse on an anvil fork
```

- **Who signs:** the operator and outsider keys stay in the repo's `.env` and sign on the Next.js server (`web/lib/cascade/server.ts`), exactly as the terminal demo does. The browser reads the chain through wagmi and waits for every receipt itself; nothing is shown as landed before it has.
- **Transactions are on only for a local dev server** (or with `CASCADE_UI_WRITES=1`). A public deployment would otherwise let anyone spend the operator's Sepolia ETH; without writes, the page still reads everything live.
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

The MVP is deliberately **one hop and one team per registry**. Planned next, in this hackathon: many teams per role, teams of teams, bounded multi-hop inheritance up the name tree, and bring-your-own roster (Hats / Safe) behind `isMember()`. After ENS feedback: who-can-access queries, resolver-record relations (a separate mechanism), and agent fleets as the use case. Details and status in [`docs/plan.md`](docs/plan.md#roadmap-from-the-mvp-rule-to-full-rebac). None of these are built yet.

## Honest limits

- **One hop only.** A grant two levels above the new subname is not found. A deeper tree needs a `CascadeSubregistry`, with its own team and parent, at each level that should inherit.
- **No off-chain computation, proof, or relayer.** Everything is on-chain view calls.
- **`TeamRegistry` inherits EAC's 15-assignees-per-role cap.** A small team, not an org chart.
- **Not a tokenized subname.** The child's ERC1155 never moves; membership is a role write on `TeamRegistry`.
- **Beta deployment, not production ENS.** Addresses are in [`scripts/lib.ts`](scripts/lib.ts), verified behaviourally on 2026-09-26.
- **`explain().allowed` does not check expiry.** The write path rejects an expired name first; `explain()` reports roles only.
