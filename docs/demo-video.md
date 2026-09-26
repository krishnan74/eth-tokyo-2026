# Demo video script — ENS Drive

**Length: 3:00 (ETHGlobal accepts 2–4 minutes; anything outside that is rejected at upload).** Rehearse once against a clock.

Record the **Cascade** tab of https://ens-drive.vercel.app (or `npm run ui` locally) — real transactions on the ENSv2 beta (Sepolia). One continuous path; cut the ~12-second block waits in editing, never cut a failure. Keep the intro under 20 seconds.

**Before recording:** press **Start over** (Alex in no group, sharing flows into subfolders) · light theme · browser zoom so the whole drive fits · an Etherscan tab ready. On the hosted site, record when it's quiet — every visitor shares the same Alex (`alex.orbit-dao.eth`).

**The script is [`pitch-finalist.md` §2](pitch-finalist.md#2-demo-video-300--inside-the-24-minute-limit)** — problem (quantified) → one-sentence solution → one journey → the mechanism made visible → threat and response → proof, next step, invitation; built on the Cannes finalist pattern in [`pitch-drafting-guide-for-finalist`](pitch-drafting-guide-for-finalist). The live 4-minute version and the fallbacks are in §3 of the same file.

## Notes

- **Say where it runs:** the ENSv2 beta on Sepolia, not production ENS; the hosted demo signs with its own limited demo keys.
- **Traces need fresh transactions:** the "On-chain, just now" card and Behind the scenes both come from replaying the latest transaction; record them right after a write.
- **If a transaction fails mid-take,** re-take from the last good beat; don't splice around it.
- **The One folder tab** is the first version (one level, one team) — mention it only if asked.
- **Closing card (optional, ≤3 s):** "ENS Drive · live on the ENSv2 beta (Sepolia) · ens-drive.vercel.app".

## Live finalist demo (4 minutes + 3 minutes of Q&A)

Same path, spoken live from [`pitch-finalist.md` §3](pitch-finalist.md); each click waits one Sepolia block (~12 s), so talk through the waits with the lines written there. The three files (`vault`, `oracle`, `bridge`) are already there, so the demo needs about 7 transactions: join core-devs, edit, move to the auditors, edit, sharing off, edit (refused), sharing on. Fallback: a pre-recorded run of the same path, and `npm run smoke:v2` in a terminal.
