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
