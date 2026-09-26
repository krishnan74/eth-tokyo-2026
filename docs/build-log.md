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

## 2026-09-26 (later) — Next.js UI

- Extracted `core/cascade/` (addresses, generated ABIs, three-check chain, cost numbers); switched `demo.ts` to it and re-ran the full 8-step terminal demo on a fork: every outcome as expected.
- Built the Next.js 16 UI in `web/` (wagmi 3, Tailwind 4, Framer Motion), deps in the root package.
- Turbopack warned that the `.env` lookup would trace the whole repo (including `.env`) into server output; excluded it and confirmed no key in `web/.next`.
- Drove the API through the full sequence on a fork, then clicked the guided walkthrough in headless Chrome on the fork and on Sepolia: all 7 steps as expected, no console errors, no horizontal overflow at 400px.
- Screenshot review caught a sticky side column sliding over the limits section and a truncated node name; both fixed and re-checked.

## 2026-09-26 (later) — UI makeover

- Replaced ten stacked cards with one "player": a single stage merging the relationship chain, the name tree and the computed-access line; the three checks as a one-line pipeline with inline "was ✓/✗" and details on demand; one primary action at a time (Guided) or a compact Manual toolbar; Activity as a side column with state chips; limits and cost below as quiet sections. Same hooks, same live reads and real transactions.
- Clicked through all seven steps twice on a fork (every outcome as expected, no console errors, no overflow at 400px, dark mode checked). Fixed ENS names breaking mid-label (now wrap only after dots) and step-4 copy that still referred to the old side-by-side checks. Not re-run on Sepolia after the makeover; the network path is unchanged from the earlier Sepolia click-through.

## 2026-09-26 (later) — framing the gap and the layering

- Added a "gap" section (what EAC stores, what a team needs to say, today's two workarounds, and Cascade's one extra term), a live "stored in EAC vs effective with Cascade" strip read from `nativeRoles()` and `roles()`, and a "layered on EAC" section (the four-layer stack, what stays the same, what changes — including that inherited roles emit no events). Role bitmaps decode through a shared `roleNames()` in the core.
- Fork click-through logged the strip at every step: stored stayed `none` throughout; effective gained `SET_SUBREGISTRY` on join and lost it on leave. The user's own dev server was running on :3000 (Sepolia), so the test used a separate production build on :3100 against a fork; the normal build was restored afterwards.

## 2026-09-26 (later) — pitch page and drag-and-drop board

- Rebuilt the UI as an MVP pitch for the ENS team (via the top-design skill): Instrument Serif display over IBM Plex, one owned teal accent on mineral paper, staggered hero reveal, scroll reveals with custom easing, Lenis smooth scroll (skipped under reduced motion). Chapters: gap, idea, live demo, how it fits, the ask, fine print.
- The demo became a drag-and-drop board: drag the outsider into/out of the roster (grant/revoke), Write per subname, drop the attacker's contract on the team socket (hijack). Chip positions come from the live membership read; a ghost chip waits during confirmation. Per-subname access is read live for every subname.
- Real-mouse Playwright run on a fork caught a genuine bug: the socket is nested in the roster and the roster was hit-tested first, so hijack drops were swallowed. Fixed (smallest zone first). Final run: all seven steps as expected; stored roles `none` throughout, effective roles gained/lost SET_SUBREGISTRY on join/leave; no console errors; no overflow at 400px. Not re-run on Sepolia after this change.

## 2026-09-26 (later) — simpler UI and behind-the-scenes traces, after ENS feedback

- ENS feedback (pitch 2): liked it, MVP is a strong implementation, wants the contract-level "behind the scenes" and a much simpler UI. Recorded in `docs/feedback/ens.md`.
- Public RPCs don't serve `debug_traceTransaction`; `cast run` replays a fresh transaction and prints the EVM call tree. `--decode-internal` didn't surface internal functions, so internal steps are shown separately, labelled as from source.
- First decoding pass decoded label hashes and timestamps as role lists — misleading; rewrote it to decode by context. Full replay failed once on live Sepolia (re-executing the block's earlier txs); added a labelled `--quick` fallback.
- Page reduced to problem / try it / under the hood, plus a collapsed "More detail". Added `docs/architecture.md` (Mermaid) and a Reset demo action; used it on Sepolia to take the outsider out of the team left over from the pitch run.
- Fork click-through: all seven steps as expected, every step's trace decoded correctly, no console errors, no overflow at 400px.

## 2026-09-26 (later) — shared-drive demo

- The presenter pitched Cascade to ENS as "Google Drive for names", so the demo became a minimal shared-drive view: the `devops` folder (a name with its own registry), files (subnames), the `devops-team` group (TeamRegistry), and a "Who has access" panel showing the outsider's access *via devops-team* next to *given directly: none*. Drag-and-drop kept for joining/leaving the group; the attack is a button. No Google branding.
- Light theme is now the default regardless of system setting, with a toggle applied before paint. Removed the old board, coach, roles strip and checks components.
- Fork click-through (system set to dark): page loaded light; all seven actions as expected; who-has-access flipped correctly; every trace decoded; theme toggle works; no console errors; no overflow at 400px. Not yet re-run on live Sepolia.

## 2026-09-26 (later) — EthDrive-inspired framing

- Read EthDrive (Superhack 2024 finalist, "Google Drive for your assets"; no ENS, no sharing). Took: the "Drive for X" hook, drag-and-drop as the core interaction, and the observation that ENS already is the directory — what's missing is Drive's sharing. Did not take: its breadth-of-integrations strategy or organise-only framing.
- Added the core message to the intro and README: ENSv2 already built the directory tree; the permission layer is missing; Cascade adds it with ReBAC. Added a read-only Share dialog behind the folder's "Shared with devops-team" pill, a Folders tree (`acme-corp.eth › devops`) with the parent-folder cascade marked "Next — not built yet", `docs/showcase.md` (tagline, problem, what it does, how it's made), and rewrote the pitch script for the drive flow.
- Fork check: intro strip, Share dialog (Esc closes), folder tree and the refused first edit render and behave as intended; no console errors.

## 2026-09-26 (later) — renamed to ENS Drive

- Product renamed to **ENS Drive**; **Cascade** stays the name of the permission layer (the `CascadeSubregistry` contract and the ReBAC rule), so contract and code names still match the Sepolia deployment. Updated the UI wordmark, page title, intro and footer, the README, CLAUDE.md, the showcase copy, the pitch script, the study docs' titles and the terminal demo's header. Historical entries (this log, feedback, decisions) keep their original wording. No affiliation disclaimer added, at the presenter's choice.

## 2026-09-26 (later) — docs brought to the latest state

- Replaced stale references to the old drag board, coach, "socket" and roles strip across the explainer, contracts doc, quiz, study guide, plan and CLAUDE.md with the shared-drive UI and trace panel.
- `architecture.md` gains the exact function chain for a write, why `_getRoles` is also asked about `ROOT`, what `_teamGrant()` returns, and why trace gas differs from Etherscan gas.
- Evidence records the live Sepolia reset (`0x24e1f9c4…`) and that the full drive click-through has only been run on a fork. Decisions 9–11 record the trace approach, the drive framing and the naming split.
- Added `docs/architecture-talk.md`: the spoken technical walkthrough ENS asked for, at 30 seconds and ~3 minutes, with follow-up answers.

## 2026-09-26 (later) — invariant and fuzz tests (roadmap step 0 safety net)

- Added `contracts/test/CascadeInvariant.t.sol`: a Handler drives random sequences of join/leave, parent grant/revoke, parent re-issue, team swaps (second roster, always-yes, misbehaving), new subnames, native grants/revokes, and outsider writes, grants, registrations and `setTeam` attempts. Five invariants after every step: roles equal native ∪ (parent grant & regular bits, if a member); stored roles unchanged; no admin bit inherited; nothing inherited at root; write outcomes match `hasRoles` and no view reverts. Five fuzz tests: arbitrary team `isMember` return data, arbitrary parent `roles` return data, arbitrary parent bitmaps (admin masking, root never inherited), non-members get nothing.
- First run passed vacuously: every `join`/`leave` reverted because `vm.prank` was consumed by the `TEAM_RESOURCE()` view call (the same pitfall as earlier). Caught from the handler's revert table; fixed with literal constants and an `afterInvariant` check that someone actually joined.
- Mutation check: removing the ROOT early return, or the admin-bit mask, in `CascadeSubregistry` makes the new suite fail (both restored from git; contract unchanged).
- Runs in ~8 s (64 runs × depth 100). Full suite: 17 unit + 5 fuzz + 5 invariants, all passing.

## 2026-09-26 (later) — roadmap steps 1–4 on `roadmap/full-rebac` (not deployed)

- `CascadeSubregistryV2`: up to 4 teams (`addTeam`/`removeTeam`, same guards as `setTeam`) and inheritance up to 3 levels (`setDepth`, default 1 = v1 behaviour). Each level comes from stock `getParent()` and counts only if the ancestor's `getSubregistry(label)` points back down, which also cuts inheritance when any name on the path expires. Membership is asked only when a team's grant would add something. `explain()` reports which team and level supplied a role; `ancestry()` shows the verified path.
- `NestedTeam` (teams of teams, 4 sub-teams, 3 levels, depth passed down so cycles end), `HatsTeam`, `SafeTeam`. Cascade needs no change for these; its member-call cap went from 30k to 100k so nesting and Hats eligibility fit.
- Lint flagged return bombs: v2 and `NestedTeam` now copy at most one word (or a size-checked `getParent` reply) from untrusted callees. v1 has the same pattern, bounded by its gas caps; left unchanged because it is deployed.
- `getParent()` returns a string, so a hostile ancestor could send undecodable data; it is decoded in a self-call inside try/catch so it can only end the walk.
- Tests: `CascadeV2.t.sol` — 16 v2 tests (incl. a hostile-ancestor fuzz), 9 team tests (nesting, depth limit, cycles, broken sub-teams, Hats over-cap eligibility, Safe owners), and an invariant over teams × levels with an independent model of the tree. 49 tests pass overall.
- Mutation checks, one at a time: removing the link check, the ROOT early return, or the admin mask each fails the v2 suite. First attempt at this used `git checkout` to restore an untracked file, which silently did nothing, so mutations stacked; caught from the results, restored by hand, re-run individually.
- The "someone joined" guard in both invariant suites was flaky (a run can have no join by chance, and Forge replays saved failures). Replaced with a deterministic check: joins/leaves are try/caught and any failure is an invariant violation; confirmed it catches the consumed-prank bug.
- Gas (local, warm): native owner `setSubregistry` 73,091 on v1 → 89,355 on v2 (2 teams, depth 1) → 133,017 (depth 3). Worst case, 4 looping teams at depth 3: ~553k per lookup. Native-first fast path proposed, not built.
- Native-first fast path (approved): `CascadeSubregistryV2._checkRoles` returns early when the caller's stored roles cover the check. `hasRoles` in `PermissionedRegistry` is not `virtual`, so this covers writes only; views still compute the full answer, and the invariant that write outcomes match `hasRoles` still holds. Owner `setSubregistry` (2 teams): 89,355 → 40,293 gas at depth 1, 133,017 → 40,293 at depth 3 (local, warm). Two tests: an owner write makes no call to any ancestor or team (`vm.expectCall` count 0), and a member's write still asks the team. 51 tests pass.

## 2026-09-26 (later) — roadmap deployed on Sepolia, isolated from the demo

- `scripts/setup-v2.ts`: registers its own name, `acme-labs.eth` (commit–reveal), and deploys a fresh tree — OrgRegistry v2 (stock) → `platform` → `CascadeSubregistryV2` (depth 2) with teams dev-team (TeamRegistry) and security (NestedTeam ⊃ sre). Grants: dev-team `SET_SUBREGISTRY` on `platform` (level 1); security `SET_RESOLVER` on `acme-labs.eth` in the `.eth` registry (level 2; the registrar gives owners `SET_RESOLVER_ADMIN`, so this is an ordinary grant). Book in `deployments/sepolia-v2.json`; the v1 book, names and contracts are never read for writing.
- Rehearsed on an anvil fork (setup, smoke, idempotent re-run), confirmed the v1 state on the fork matched Sepolia afterwards, then ran both on Sepolia. All transactions in `deployments/sepolia-v2.json`.
- `scripts/smoke-v2.ts` on Sepolia: outsider refused both roles; joined dev-team → `setSubregistry` allowed via level 1 (`explain`: dev-team, level 1, `platform`), `setResolver` still refused; joined sre → `setResolver` allowed via security two levels up (`explain`: level 2, `acme-labs`, the `.eth` registry); operator's native write took the fast path; left both → refused again. Gas: outsider write via level 1 165,723; via level 2 through the nested team 148,473; native owner write 36,959 (whole transaction).
- After the run, v1 on Sepolia unchanged: team pointer, `SET_SUBREGISTRY` grant on `devops`, outsider not in the v1 team.
- Hats/Safe adapters not deployed (no real hat or Safe to point at yet).

## 2026-09-26 (later) — the `/roadmap` page

- Added a browser page for v2 on the branch: `web/app/roadmap` + `app/api/v2/{state,action}` (server reads/writes in `lib/cascade/v2server.ts`), `core/cascade/v2.ts`, and `npm run gen` now also writes `core/cascade/generated-v2.ts`. The trace names now include the v2 contracts, and the trace panel has notes for the multi-hop calls.
- The web build caught two type errors the root `tsc` doesn't cover (it excludes `web/`): the trace state updater and a spread of a `never`-cast request. Fixed.
- Could not start a second dev server (Next allows one per project dir; the author's own `next dev` was running on :3000 and hot-reloaded the branch), so tested against live Sepolia through it. Every button behaved as expected, including depth 1 → `SET_RESOLVER` gone and the write refused on-chain, depth 2 → back. **Bug found:** Start over sent up to three transactions back to back and the second failed ("Missing or invalid parameters") — a reused nonce on the public RPC. Fixed by mining each before sending the next; re-ran it (cleaned up, then reported a no-op).
- Added `docs/roadmap-v2.md` (rule, contract changes, addresses, evidence generated from the book, gas, tests, limits) and pointed README, architecture, contracts-explained, project-explainer, evidence and decisions (12–17) at it. Pitch and submission docs are left describing the submitted MVP.
- Replaced the separate `/roadmap` page with a v2 version of the home page's drive (user feedback: the v2 behaviour belongs in the demo itself, on the branch only). `DriveDemoV2`: two folder levels, dev-team on `platform`, security ⊃ sre on `acme-labs.eth`, drag-and-drop into either group, a cascade switch (depth 2 / 1) where the "Next — not built yet" note was, both permissions per file with the group and level they come from, an 11-step guide, and the attack as `addTeam(AlwaysTrueTeam)` (refused on Sepolia with `EACUnauthorizedAccountRoles`). The v1 drive and `main`/Vercel are unchanged. Loading state first showed the cascade as "off" before the chain read arrived; now shows "…".

## 2026-09-27 — pitch-3 follow-ups: precise wording, lazy check

- Item 8: our written material never claimed text records (that was said aloud in pitch 1), but two passages described resolver permissions imprecisely ("by record type"); corrected to `(namehash, record part)` and added an explicit "what access means" line to the explainer, Q&A, pitch script and study guide — on both `main` and the roadmap branch.
- Items 1 + 2 + 4: wrote the gas benchmark first and ran it on the full-union version (before), then made `_checkRoles` lazy and role-aware (after): level-1 member write −35% locally, 4 teams at depth 3 −52%, level-2 −7%, denied −7–13%. Added a differential fuzz (lazy check == full union for any state and multi-role request, admin bits included) and two pruning tests; widened the invariant's writes to `setResolver` and `renew`. Mutation-checked; the one surviving mutant (removing the admin-bit early exit) is equivalent — grants are masked to regular bits, so admin bits can never be covered.
- **Mistake caught:** after the mutation run I restored the source from a copy but didn't rebuild, so `out/` still held the last mutant ("never ask membership"). `setup:v2 --redeploy` deployed it to a fork, and the smoke test failed ("expected setSubregistry to be refused"). A trace showed no `isMember` call. Nothing reached Sepolia. `setup:v2` now runs `forge build` before deploying.
- The smoke test also failed at first because the browser demo had left the outsider in both teams on Sepolia; it now starts by removing them.
- Redeployed v2 on Sepolia (deploy 2, same `platform` name, teams and grants carried over; book entries tagged `[deploy 2]` so deploy 1's evidence stays). Smoke on Sepolia: every check passed; level-1 member write 165,723 → 97,665, level-2 148,473 → 138,289, owner unchanged.
- Item 5 (test gaps 1–5): `CascadeGaps.t.sol` runs each scenario on v1 and v2 — approved operators (member's operator gets nothing; owner's operator gets only stored roles), members revoking/transferring (refused), unregistering (only if the parent grants `UNREGISTER`), expiry, the 15-member cap, an expired parent, and a v1-vs-v2 equivalence invariant. Widened the v2 invariant with time warps, renewals, file re-registration, operator approvals and member revoke/transfer/unregister attempts.
- The widened invariant failed first: the model kept an actor's stored grants after the actor unregistered the file, but unregistering moves the file to a new EAC resource. Reproduced in a scratch test (contract right, model wrong), fixed the model.
- Found while checking the equivalence test's power: ENSv2 already hides grants on an expired name (its resource becomes `eacVersionId + 1`), so v1 stops inheriting from an expired parent without a link check. Corrected decision 13, which had credited expiry to v2's link check. The link check's real role — rejecting parent pointers that don't point back — is also a genuine v1/v2 difference; the equivalence claim is scoped to honest trees. 69 tests pass.
- Item 3 (per-transaction memo): checked before building — a `view` function can't `tstore` (compiled a probe: error 8961), and ENSv2's `_checkRoles`/`_getRoles` are `view`. Also unsafe without invalidation within a transaction. Not built; decision 19.
- Item 6: `RosterFork.t.sol` on a Sepolia fork — created a top hat and a hat on the real Hats Protocol v1, and a real Safe 1.4.1 proxy through its factory; both adapters behave as with the mocks (hat worn/renounced, owner added/removed). Opt-in (`FORK_TESTS=1`, `npm run test:fork`) so `npm test` stays offline; without the flag the tests return immediately.
- Item 7 (formal verification trial, Halmos 0.3.3): proven for all inputs — the v1 rule (roles = member ? grant & regular : 0, no admin bits, nothing at root), v2 lazy check == full union (2 teams × 2 levels, any requested bitmap), and a parent not pointing back contributes nothing. v2 `roles()` == union formula came back with counterexamples (grants in bits 124–127) that pass when replayed on the EVM; ruled out gas-capped calls and the return-data helper with isolated probes, didn't find the Halmos-side cause in the time box — left as inconclusive, covered by fuzz/invariants. Gotcha: Halmos silently skips contracts whose artifacts lack an AST (a plain `forge build` / `forge test` leaves them without one); `npm run prove` runs `forge build --ast` first.
## 2026-09-26 (later) — hosted read-only demo on Vercel

- Deployed `main`'s UI to https://ens-drive.vercel.app (project `ens-drive`). Production builds already disable writes; added a fallback so `/api/actors` returns the two public demo addresses from env vars when no keys are present, and made `/api/trace` local-only like writes (it runs `cast`).
- `.vercelignore` keeps `.env`/`.env.local` and non-UI folders out of the upload. First deploy failed: an unanchored `lib/` also excluded `web/lib`; anchored every pattern. `vercel link` added `.env*` to `.gitignore`, which would also have hidden `.env.example`; narrowed to `.env.local`.
- Checked before and after deploying: neither private key appears in the local build output; live `/api/action` and `/api/trace` return 403; `/.env` and `/.env.local` return 404; `/api/actors` returns the right addresses with `writesEnabled: false`; the page renders live Sepolia state in headless Chrome.
- Changed to a fully working hosted demo (user decision: dedicated keys, rate limits). Generated two fresh keys into `.env.hosted` (0600, gitignored); `scripts/setup-hosted.ts` had the main operator grant the hosted operator only `ROLE_REGISTRAR` (cascade root) and `ROLE_MEMBER_ADMIN` (team root) and fund it 0.2 Sepolia ETH. Server: per-IP rate limits, a daily cap, a balance guard, one transaction at a time per instance, traces only for the demo's own transactions. Traces on Vercel: `scripts/fetch-cast.sh` downloads Foundry v1.8.1 (Alpine, static) at build time and checks its SHA-256; the trace route bundles it via `outputFileTracingIncludes`.
- The first build with the bundled `cast` warned "Dynamic filesystem access causes tracing of the whole project" — the same pitfall as the `.env` lookup; added `turbopackIgnore` to the new paths and confirmed none of the four keys (main and hosted) appears in `web/.next`.
- Rehearsed the production server locally on a Sepolia fork with the hosted keys: create, refused write (mined as failed, outsider auto-funded), grant, allowed write, full trace, revoke, refused hijack, reset; a foreign transaction's trace was refused; the 9th action in an hour with the limit set to 8 got a 429.
- Live on https://ens-drive.vercel.app against Sepolia: the same sequence, every outcome as expected, and the trace ran on Vercel (`setSubregistry → OrgRegistry.roles → TeamRegistry.isMember`). The hosted outsider was left out of the team; hosted operator balance afterwards 0.1947 ETH.

## 2026-09-27 — orbit-dao.eth, Alex's name, optimistic drag (local branch `orbit-dao`, not deployed)

- `setup:v2` now builds either tree (`--tree acme|orbit`, own book each) so the live site's acme tree stays untouched while the new one is built. Deployed `orbit-dao.eth` (fictional DAO) › `protocol` › `vault`, `oracle`, `bridge` with core-devs and security-council ⊃ auditors; rehearsed on a Tenderly-backed fork (the public RPCs were rate-limiting), then on Sepolia; smoke passed. Log and book entries first used the acme wording ("grant dev-team on platform") — caught on the fork, fixed to per-tree names before Sepolia.
- Alex's own name: `alex.orbit-dao.eth` (hosted outsider) and `alex-dev.orbit-dao.eth` (local outsider), registered as subnames owned by those accounts; the server checks ownership on-chain and the UI shows the name.
- Optimistic drag: the chip moves into the target team at once, dashed and "joining · confirming on Sepolia"; access badges only show confirmed state. The hook now refreshes state before clearing the pending flag so the chip never flashes back.
- Found while renaming: the v2 action endpoint only accepted `svc-…` labels, so editing `vault` would have been rejected — widened to a plain lowercase-label pattern (and the trace route's label filter).
- Pitch script: opens with "Imagine you lead a web3 organization that uses ENS for its names" (checked against the Cannes guide; framed as a scenario, orbit-dao fictional, ENSv2 beta stated).

## 2026-09-27 (later) — orbit-dao live, pitch scripts, More detail trimmed, docs refreshed

- Deployed the `orbit-dao` work to https://ens-drive.vercel.app on the user's go-ahead: re-ran `setup:hosted` so the hosted operator also holds the orbit tree's roles, regenerated the core for `CASCADE_TREE=orbit`, deployed. On the live site: Alex joining core-devs flipped all three files, the trace replayed on Vercel, Start over left the tree clean.
- Rewrote the video and live pitch scripts (`pitch-finalist.md`) in a natural speaking voice at the user's request: names spoken as said aloud ("orbit dao dot eth"), no dashes in spoken lines, lines to fill each block wait.
- Removed Roadmap and Questions for the ENS team from More detail (user request); both still live in the README and `docs/`. Pushed and deployed; checked live.
- Refreshed every doc to the current state, starting with the submission form copy (`submission.md`, now re-pasteable for the cascade version with a pinned v2 code link). v1-first explainers keep their line-by-line v1 walkthroughs and gained cascade sections; `pitch-script.md` is marked superseded by `pitch-finalist.md`. Caught while writing: the first draft described the Halmos proofs as "only adds / admin bits / root"; the actual three proofs are the v1 rule, lazy == full union, and a broken link contributing nothing — corrected before commit.
