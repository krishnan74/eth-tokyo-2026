# ENS Drive (powered by Cascade) — working notes for Claude

A one-hop EAC fallthrough for ENSv2 subnames: `CascadeSubregistry` overrides EAC's `_getRoles` hook so that, on any subname, an account also holds the regular roles the parent grants a team contract — if the account is a member of that team. Built at ETHGlobal Tokyo 2026 (Sept 25–27): pitched twice to the ENS team, now being submitted to the ENS track (Best Use of ENSv2) — the draft form copy is [`docs/submission.md`](docs/submission.md). **Naming:** the product is *ENS Drive*; *Cascade* is the permission mechanism — keep `Cascade…` for contracts and code identifiers (they match the Sepolia deployment); use "ENS Drive" in user-facing product text.

Read [`docs/plan.md`](docs/plan.md) first — it opens with a status table.

## Working agreements

- **Ask before every `git commit`.** Show the diff and proposed message; the user reviews first.
- Commit at the granularity of a change. Docs in separate commits from code.
- Commits end with the `Co-Authored-By: Claude …` trailer from the session's attribution reminder.
- **Never hard-wrap prose in markdown.** One paragraph or bullet = one line.
- Keep `docs/build-log.md` current. First-hand only.
- `CascadeSubregistry.sol` and `TeamRegistry.sol` are deployed on Sepolia; editing them means the source no longer matches the deployment until `setup` is re-run with a fresh book.

## Toolchain — not on PATH by default

```bash
export PATH="$HOME/.foundry/bin:$PATH"
```

## Commands

```bash
forge build && npm test                            # 17 unit + 5 fuzz + 5 invariants (local EVM, ~8 s)
anvil --fork-url https://ethereum-sepolia-rpc.publicnode.com   # fork for rehearsal
npm run setup -- --rpc http://127.0.0.1:8545       # rehearse wiring on the fork (writes deployments/fork.json)
npm run setup                                      # Sepolia, simulate only
npm run setup -- --write                           # Sepolia, send (idempotent)
npm run setup -- --write --redeploy                # replace CascadeSubregistry + TeamRegistry under the same devops
npm run demo                                       # the eight-step sequence, live on Sepolia (--core: steps 1–5)
npm run demo -- --step                             # presenting: wait for Enter between steps (--fast: no pacing, --json: receipt line)
npm run demo -- --recap                            # replay last recorded run (evidence/last-run.json); sends and reads nothing
npm run gen                                        # regenerate core/cascade/generated.ts (ABIs + Sepolia addresses) after forge build / redeploy
npm run ui                                         # Next.js UI on :3000 (Sepolia); NEXT_PUBLIC_RPC_URL + CASCADE_RPC_URL=http://127.0.0.1:8545 for a fork
npm run ui:build                                   # production build (type-checks the UI)
npm run setup:v2 -- --write                         # roadmap branch: deploy/wire CascadeSubregistryV2 on acme-labs.eth (idempotent; book: deployments/sepolia-v2.json)
npm run smoke:v2                                   # roadmap branch: live check of many teams, nested team, multi-hop, fast path (cleans up after itself)
npm run test:fork                                  # roadmap branch: HatsTeam / SafeTeam against the real Hats v1 and Safe 1.4.1 on a Sepolia fork (network; skipped in npm test)
npm run prove                                      # roadmap branch: Halmos symbolic proofs (pip install halmos; tested 0.3.3). Halmos needs `forge build --ast`: without the AST it silently skips contracts
npm run ui:start                                   # serve the production build (read-only unless CASCADE_UI_WRITES=1)
```

## Environment

- Root `.env` (gitignored): `SEPOLIA_RPC_URL`, `OPERATOR_PRIVATE_KEY` (same key as Perjury's operator in `~/Documents/eth-online-2026`), `OUTSIDER_PRIVATE_KEY` (fresh key generated for this project). Keys accepted with or without `0x`.
- Never print private keys. Derive addresses with `cast wallet address $KEY`.
- The UI's server reads the same root `.env` (`web/lib/cascade/server.ts`); keys never go to the browser. Writes are enabled only under `next dev` or with `CASCADE_UI_WRITES=1` — do not deploy with writes on.
- UI env: `NEXT_PUBLIC_RPC_URL` (browser reads), `CASCADE_RPC_URL` (server signing). Both default to Sepolia publicnode.

## Live (Sepolia, ENSv2 beta deployment)

| | |
|---|---|
| Operator | `0xDcbe075a907960951Cd4df379BB21461097eEa91` |
| Outsider | `0xF4ff37B96BF5474F8d2F58ABfB9F61F5A9629Fa8` |
| Org registry (`acme-corp.eth`) | `0xa27742aead8ca8baa8ff0a97754ac1736741e126` |
| `CascadeSubregistry` (`devops.acme-corp.eth`) | `0x2f15c12d21d7561433ddc6f7b856e9f0e4455e13` |
| `TeamRegistry` | `0x11ddfcb62670f0608d7cbc5b61e4470e0c7472bb` |
| `AlwaysTrueTeam` (demo fixture) | `0xaa735fc88e25f7d846010469ee75f287c8ec20c1` |

Roadmap branch only, separate tree `acme-labs.eth` (never touches the v1 demo): OrgRegistry v2 `0x35888867cc0c37d54ae0f902611ec4a5b8a73beb` · CascadeSubregistryV2 (`platform.acme-labs.eth`, depth 2, lazy check) `0x1c361c62e2ea3330790f1d6c17e42b873081ddc8` (retired: `0xa6b159d2e785a6146d9e21a1cc377b781e70a246`, the full-union version) · dev-team `0xaa75275e77f89267f28a5bbf2f7f40b920941253` · security (NestedTeam ⊃ sre) `0x179aa1bac7758557defe517330147afd55f54134` · sre `0x2bd2a5bf158ec73ab1c8d1989e4b3b200d055163`.

Retired: CascadeSubregistry `0xa6e5…3b22`, TeamRegistry `0x1a3d…b881` (see `deployments/sepolia.json`).

ENS beta addresses are in `scripts/lib.ts`. See also `~/Documents/ensv2-insights.md`.

## Facts learned the hard way

- EAC exposes holder *counts* (`roleCount`, `getAssigneeCount`), not holder *identities*. "Who holds role X on the parent" is not answerable on-chain.
- `PermissionedRegistry.hasRoles` takes an **anyId** and converts it to a resource; inside a subclass, `_checkRoles` / `_getRoles` receive a **resource**. `super._getRoles` is the native-only view.
- `try/catch` does NOT catch undecodable return data — a callee returning 1 byte reverts the caller. Use low-level `staticcall` + length check for untrusted callees.
- Names only receive admin role bits at registration; `grantRoles` on a name resource can grant regular roles only (`_getSettableRoles` returns `>> 128`).
- Token IDs regenerate on every grant/revoke (`tokenVersionId`); the EAC resource (`eacVersionId`) only changes on unregister/expiry. Transfers keep third-party grants.
- The demo's step 8 unregisters and re-registers `devops`, then restores the team grant; a crash mid-step 8 leaves the grant missing — rerun `npm run setup -- --write` to restore.
- Next 16 (Turbopack) bundles the whole repo into server output if a route touches `fs` with a dynamic path — the `.env` lookup in `server.ts` carries `/*turbopackIgnore: true*/` for that reason. Check `web/.next` for keys after changing it.
- A sticky column taller than the viewport inside a shared grid slides over later rows; the UI's side column has its own grid and `max-h` + `overflow-y-auto`.
- Drag-and-drop drop zones are hit-tested by rectangle; if one zone ever sits inside another, test the smaller one first (a real bug the drag test caught in the earlier board, where the team socket sat inside the roster).
- Public Sepolia RPCs do not serve debug_traceTransaction; traces come from `cast run` replaying fresh txs (old txs fail: historical state pruned). Full replay can fail intermittently re-executing the block's earlier txs, hence the `--quick` fallback.
- Trace decoding must be context-aware: only decode role names for `roles()` returns and EAC revert roles — a label hash or timestamp decoded as a bitmap reads as nonsense roles.
- An expired name's EAC resource is `eacVersionId + 1` (`_constructResource`), so every grant on it reads as 0 until it is re-registered — `parent.roles(label, team)` returns 0 the moment the parent expires. That, not v2's link check, is what ends inheritance on expiry.
- Deploy scripts read bytecode from `out/`, which can be stale — a mutation test once left a mutant build there and it was deployed to a fork (caught by the smoke test). After mutation tests, rebuild; `setup:v2` now runs `forge build` itself. Restore mutated files from a copy, never `git checkout`, when the change isn't committed.
- `next dev` writes `web/AGENTS.md` / `web/CLAUDE.md` (Next's own agent notes). Commit them as-is.
- `vm.prank` is consumed by the first external call — including a view call used as an argument (`team.grantRoles(team.TEAM_RESOURCE(), …)`). Cache constants before pranking.
- `cast wallet new --json` output shape varies by version; regex the 64-hex key instead of indexing.
- A fork of Sepolia already contains the real deployment, so a fresh fork starts from `deployments/sepolia.json`; fork writes go to `deployments/fork.json` (gitignored). Setting up from scratch on a fork fails because `acme-corp.eth` is already registered on Sepolia.
- Subnames with no resolver resolve through the parent's (Universal Resolver `findResolver` offset > 0). That is inheritance, not proof the child exists — check `getSubregistry` along the chain.

## Layout

```
contracts/src/       CascadeSubregistry, TeamRegistry, ITeam (deployed); CascadeSubregistryV2 (roadmap 1+3: many teams, multi-hop — not deployed)
contracts/src/teams/ NestedTeam (roadmap 2, live on Sepolia as `security`), HatsTeam + SafeTeam (roadmap 4) — adapters not deployed
core/cascade/v2.ts   roadmap names/roles; generated-v2.ts (ABIs + v2 addresses) written by `npm run gen` from deployments/sepolia-v2.json
web/components/drive/DriveDemoV2.tsx  roadmap branch: the home page's drive runs on CascadeSubregistryV2 (acme-labs.eth › platform, dev-team + security ⊃ sre, cascade switch = setDepth); state/actions via lib/cascade/v2hooks.ts → app/api/v2/{state,action} (lib/cascade/v2server.ts) — local-only writes, main .env keys. main keeps the v1 drive (DriveDemo.tsx).
contracts/src/demo/  AlwaysTrueTeam — the attacker's contract for demo step 6 (fixture, not product)
contracts/test/      Cascade.t.sol — 17 tests: sequence, hook agreement, pointer guard, validation, bad teams, gas caps, parent re-issue/expiry/transfer; CascadeV2.t.sol — v2 + team contracts: unit tests, hostile-ancestor fuzz, gas bounds, and an invariant over teams × levels; CascadeInvariant.t.sol — the step-0 rule as 5 invariants (random action sequences via a Handler) + 5 fuzz tests (arbitrary team/parent return data, arbitrary role bitmaps)
core/cascade/        SHARED by terminal + UI: contracts.ts (addresses, roles), explain.ts (three-check chain), cost.ts, generated.ts (ABIs + addresses, from `npm run gen`)
scripts/             lib.ts (env, clients, book), setup.ts (deploy/wire, --redeploy), demo.ts (8 steps, --recap), ui.ts (terminal rendering), gen-core.ts
web/                 Next.js 16 app (deps in the root package.json): app/page.tsx, app/api/{action,actors}, lib/cascade/{hooks,server,wagmi}.ts; components/drive/DriveDemo (the shared-drive demo: folder = devops, files = subnames, group = TeamRegistry; drag-and-drop, who-has-access, attack); components/simple/: Intro, TracePanel (live cast-run trace), Architecture, MoreDetail; components/pitch/: Sections (gap, fit, roadmap, ask — inside More detail), Reveal, SmoothScroll; components/cascade/: TopBar (with theme toggle), Activity, Context, primitives, steps.ts (action labels); lib/cascade/trace.ts (cast run replay + context-aware decoding), app/api/trace
docs/                plan (status), architecture + architecture-talk (the spoken track), contracts-explained, decisions, evidence (tx hashes), build-log, remediation, pitch-script, qa, study-guide, quiz, project-explainer, showcase; submission pack: submission, demo-video, ai-usage; feedback/ens.md (partner + developer feedback)
deployments/         sepolia.json — current + retired addresses, setup tx hashes (written by setup.ts)
evidence/            raw demo logs; last-run.json feeds --recap
lib/               contracts-v2@48b3e2d, openzeppelin-contracts, forge-std (submodules)
```

## Status

`_getRoles` version built, 17 unit tests + 5 fuzz tests + 5 invariants passing (mutation-checked: dropping the ROOT early return or the admin mask fails them), deployed and demoed live on Sepolia (all eight terminal steps mined, every outcome as expected). Audit remediation recorded in `docs/remediation.md`. Next.js UI (shared-drive demo, light theme by default with a toggle, live `cast run` traces, Start over reset) built on the shared core; the drive UI has been clicked through end to end on a fork — a full run on live Sepolia is still to do (it will be the video recording). A fresh clone builds, tests and runs `ui:build` with no `.env`.

Submission (first draft, docs committed): blockers are the repo going public (the ENS track requires open source — it is private; keep it private until the user says otherwise), a live demo link (plan: hosted read-only UI, writes off), the demo video, the real form limits/deadline, and the author's section of `docs/ai-usage.md` (the user writes it, not Claude). Form picks: category Infrastructure, emoji 📂. Still open: Etherscan source verification; a native-owner gas baseline on Sepolia; ENS team answers to the README's design questions.
