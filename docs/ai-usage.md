# AI usage

ENS Drive was built during the event in a Claude Code session (Anthropic's Claude, model Opus 5.5), directed by the project's author. This page says, as specifically as we can, what the AI produced and what the author did.

## What the AI wrote

- **Contracts and tests:** all of `contracts/src/` (`CascadeSubregistry`, `TeamRegistry`, `ITeam`, the `AlwaysTrueTeam` fixture) the 17 Foundry tests in `contracts/test/Cascade.t.sol` and the invariant and fuzz tests in `contracts/test/CascadeInvariant.t.sol`, including the security hardening after a review pass (the `_getRoles` move, the pointer guard, gas-capped calls).
- **Scripts:** the Sepolia deployment and wiring script (`scripts/setup.ts`), the terminal demo (`scripts/demo.ts`, `scripts/ui.ts`), and the ABI generator.
- **Web UI:** the Next.js app in `web/` — the shared-drive demo, the server-side signing and `cast run` trace replay, the architecture section.
- **Documentation:** the README and everything in `docs/`, including this submission copy, the architecture docs, the study material and the pitch script.
- **Research:** reading the ENS track requirements, past ENS winners and related projects (EthDrive, Nymspace, Hats Protocol) through web search and a page-fetching sub-agent; summaries are in the conversation, sources are cited where used.

## What the author did

- Supplied the starting plan (`plan.md`) and prior hands-on notes on the ENSv2 beta from an earlier project, which set the deployment addresses and pitfalls.
- Made the product and scope decisions: the team-pointer design over the alternatives, the neutral `acme-corp.eth` name, keeping the MVP to one hop, the shared-drive framing, and the rename to ENS Drive.
- Wrote or supplied the UI briefs and review specs that drove each UI iteration and the security remediation pass.
- Pitched the project to the ENS team twice during the event and brought back their feedback, which shaped the simpler UI and the contract-level "Behind the scenes" view.
- Directed every commit: the AI proposed each commit; the author asked for it to be made.

## How the AI's output was checked

- Contract behaviour is checked by the 17 unit tests, 5 fuzz tests and 5 invariants (the invariant suite was mutation-checked: deliberately breaking the ROOT guard or the admin mask makes it fail) and by live runs on the ENSv2 beta on Sepolia (transactions in [`evidence.md`](evidence.md)); the UI was driven end to end in a real browser on a fork of Sepolia.
- Bugs caught this way are recorded in [`build-log.md`](build-log.md), for example a `try/catch` that couldn't catch undecodable return data, a drag-and-drop zone hit-test ordering bug, and a trace decoder that mislabelled values as roles.

## Author's own words

*(Left for the author: how much of the code you read or reviewed yourself, and anything you'd like judges to know about how you worked with the AI. Not filled in by the AI.)*
