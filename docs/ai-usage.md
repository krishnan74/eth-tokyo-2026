# AI usage

ENS Drive was built during the event in a Claude Code session (Anthropic's Claude, model Opus 5.5), directed by the project's author. This page says, as specifically as we can, what the AI produced and what the author did.

## What the AI wrote

- **Contracts and tests:** all of `contracts/src/` (`CascadeSubregistry`, `CascadeSubregistryV2`, `TeamRegistry`, `ITeam`, `NestedTeam`, `HatsTeam`, `SafeTeam`, the `AlwaysTrueTeam` fixture) and all 71 Foundry tests and 3 Halmos proofs in `contracts/test/`, including the security hardening after a review pass (the `_getRoles` move, the pointer guard, gas-capped calls) and the lazy write check after the third ENS pitch.
- **Scripts:** the Sepolia deployment and wiring scripts (`scripts/setup.ts`, `setup-v2.ts`, `setup-hosted.ts`), the terminal demo and smoke run (`scripts/demo.ts`, `scripts/ui.ts`, `smoke-v2.ts`), and the ABI generator.
- **Web UI and hosting:** the Next.js app in `web/` — the cascade and one-folder drives, the server-side signing and `cast run` trace replay, the "On-chain, just now" card, the architecture section — and the Vercel deployment with its rate limits and budget guard.
- **Documentation:** the README and everything in `docs/` except the author's pitch-pattern notes (`pitch-drafting-guide-for-finalist`), including the submission copy, the architecture docs, the study material and the pitch scripts.
- **Research:** reading the ENS track requirements, past ENS winners and related projects (EthDrive, Nymspace, Hats Protocol) through web search and a page-fetching sub-agent; summaries are in the conversation, sources are cited where used.

## What the author did

- Supplied the starting plan (`plan.md`) and prior hands-on notes on the ENSv2 beta from an earlier project, which set the deployment addresses and pitfalls.
- Made the product and scope decisions: the team-pointer design over the alternatives, the neutral `acme-corp.eth` name, keeping the MVP to one hop, the shared-drive framing, the rename to ENS Drive, the order of the roadmap steps, merging v2 into the main demo, the fictional `orbit-dao.eth` and the Alex persona, hosting with dedicated keys, and what the pitch says.
- Wrote or supplied the UI briefs and review specs that drove each UI iteration and the security remediation pass.
- Pitched the project to the ENS team three times during the event and brought back their feedback, which shaped the simpler UI, the contract-level "Behind the scenes" view, the gas work (the lazy check) and the extra access-control tests and proofs. Wrote the finalist pitch-pattern analysis the pitch scripts follow.
- Directed every commit: the AI proposed each commit; the author asked for it to be made.

## How the AI's output was checked

- Contract behaviour is checked by 71 Foundry tests (unit, fuzz, invariants; the invariant suite was mutation-checked: deliberately breaking the ROOT guard or the admin mask makes it fail), 3 Halmos symbolic proofs, and live runs on the ENSv2 beta on Sepolia (transactions in [`evidence.md`](evidence.md) and [`roadmap-v2.md`](roadmap-v2.md)); the UI was driven end to end in a real browser on a fork of Sepolia and checked on the live site after each deploy.
- Bugs caught this way are recorded in [`build-log.md`](build-log.md), for example a `try/catch` that couldn't catch undecodable return data, a drag-and-drop zone hit-test ordering bug, and a trace decoder that mislabelled values as roles.

## Author's own words

*(Left for the author: how much of the code you read or reviewed yourself, and anything you'd like judges to know about how you worked with the AI. Not filled in by the AI.)*
