# Demo video script — ENS Drive

**Target length: 3:00. Confirm the event's limit before recording** (ETHGlobal videos are commonly 2–4 minutes; over-length gets truncated or disqualified). Rehearse once against a clock.

Real screen recording of the web UI running locally against **live Sepolia** (`npm run ui`), real voice, one continuous path. Cut out the ~12-second block confirmations if needed — never cut out a failure.

**Before recording:** press **Start over** so the outsider is out of the group · operator funded (check the Contracts popover addresses on Etherscan) · light theme · browser zoom so the whole drive fits · an Etherscan tab ready.

| # | Time | On screen | Said |
|---|---|---|---|
| 1 | 0:00–0:15 | The drive, mid-action: dragging the outsider into devops-team; "Who has access" flips to "Can edit · via devops-team" | "This is ENS Drive — Google Drive–style sharing for ENS names. I just added someone to a team, and every name in this folder became editable by them. Nothing was written to any name." |
| 2 | 0:15–0:40 | Scroll up to the intro strip (tree ✓ · sharing ✗ · ENS Drive adds it) | "ENSv2 already built the directory tree — every name has its own registry, so names nest like folders. What's missing is sharing: ENSv2's access control grants permissions one address on one name. ENS Drive adds that permission layer with relationship-based access control." |
| 3 | 0:40–0:55 | Click the "Shared with devops-team · Share" pill; the Share dialog | "The devops folder is a real ENSv2 name on Sepolia. It's shared with a team contract, which can edit — and that applies to every file, including new ones." Click Done. |
| 4 | 0:55–1:10 | **+ New file** → the new subname appears | "A brand-new subname. Nobody is given any access to it." |
| 5 | 1:10–1:30 | **Edit as outsider** → refused; Who has access: No access | "The outsider tries to edit it — refused, on-chain. They're not in the group." |
| 6 | 1:30–1:55 | Drag the outsider into devops-team → Who has access: "Can edit · via devops-team"; given directly: none | "One ordinary grant on the team contract. Now: can edit, via the group — while access given directly stays empty. That's ENS Drive adding to ENSv2's permissions, not replacing them." |
| 7 | 1:55–2:10 | **Edit as outsider** → saved | "Same file, same person — it works." |
| 8 | 2:10–2:25 | Drag out → **Edit** → refused | "Remove them from the group — one revoke — and access is gone from every file, immediately." |
| 9 | 2:25–2:40 | **"As the outsider, change who the folder is shared with"** → refused | "And the obvious attack — swapping the folder's group for one that says yes to everyone — is refused." |
| 10 | 2:40–3:00 | Scroll to **Behind the scenes** (a write's trace), then **Under the hood** | "Behind the scenes, this is the real call tree: ENS's own permission check, answered by one overridden function that reads the parent's grant and the team's roster. One new contract, built on ENSv2's own registry. Every step you saw is a transaction on the ENSv2 beta on Sepolia." |

## Notes

- **Say where it runs:** the UI is local, the chain is live Sepolia. Don't imply the page is publicly hosted with transactions.
- **Traces need fresh transactions:** record Behind the scenes right after the write, not from an old run.
- **If a transaction fails mid-take**, re-take from the last good beat; don't splice around it.
- **Closing card (optional, ≤3 s):** the three contract addresses and "ENSv2 beta · Sepolia".
