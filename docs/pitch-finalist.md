# ENS Drive — finalist video and pitch, built on the Cannes pattern

Reference: [`pitch-drafting-guide-for-finalist`](pitch-drafting-guide-for-finalist) — an analysis of the ETHGlobal Cannes finalists' pitches from the closing-ceremony transcript. This file applies it to ENS Drive, section by section. Where the guide says something, we follow it; where it only describes one team, it's used as a lesson, not a rule. Judging format (ETHGlobal): 4 minutes of demo + 3 minutes of Q&A live; the submission video must be 2–4 minutes.

---

## The setup, in one breath (say it before the first click)

What's already on-chain when the demo starts — the judges need this map before the clicks mean anything:

- **Folders:** `acme-labs.eth` (a real ENSv2 name) and `platform` inside it (`platform.acme-labs.eth`, its own registry). The file `svc-api` is in `platform`.
- **Sharing (two grants, made once by the owner):** `platform` is shared with **dev-team** — "can edit". `acme-labs.eth` is shared with **security** — "can edit" (and "can set resolver").
- **Teams:** **dev-team** is a roster; **security** is a team that includes another team, **sre**.
- **The switch:** "Sharing flows into subfolders" is on — the folder above counts.
- **Alex** — a new teammate (the demo's one account) — starts in no team. Everything in the demo is moving Alex between teams; no name is touched. On the page, three names sit in `platform` (`svc-api`, `svc-db`, `svc-web`), so every change visibly reaches all of them at once.

## 1. The formula, mapped to ENS Drive

The guide's finalist formula has three ingredients (§4) inside a five-beat sequence (§2).

| Guide beat | ENS Drive | Source in the guide |
|---|---|---|
| **Name the problem** — specific, quantitative if credible | A team of 5 managing 20 ENS names across 3 folders needs **300 separate grants**; someone leaving means **60 revokes**. (ENSv2's registry-wide grants cut that to 15 — but every join or leave still touches every folder.) | ALMA: "use a quantitative problem statement" |
| **Start from something familiar and its limit** | Google Drive: you share a folder, not each file with each person. ENS has the folders — it doesn't have the sharing. | DIVE: "a comparison to an existing product can quickly establish why your solution matters" |
| **One-sentence solution, with a product identity** | "ENS Drive is Google Drive–style sharing for ENS names: share a name with a team, and everyone in it can manage every name below." | §2: "a product identity and a simple explanation" |
| **One complete user journey, action → observable result** | The outsider is refused → dragged into a team → can edit → moved to a team inside a team shared *one folder up* → still can edit → cascade switched off → refused. | Défi, Corpus: "one coherent scenario from setup to outcome" |
| **Technical differentiator, visible** | The "On-chain, just now" card (bottom-right, after every action) and *Behind the scenes*: ENS's own permission check, answered by one overridden lookup that walks up the folders — checking each really contains the next — and stops as soon as access is proven. | Maki: "make [the mechanism] visible"; npmguard: "a straightforward user workflow followed by a deeper explanation of the machinery" |
| **Show the threat and the response** | The attack: the outsider tries to add a group that says yes to everyone → refused on-chain, with the reason. | ENShell: "show the threat, the detection and the response" |
| **Proof and a working result** | Live on the ENSv2 beta; 71 tests, 3 symbolic proofs; a member's edit costs about the same as the one-folder version. | EVM PORST: "the demo should validate the implementation" |
| **One realistic next step** | Per-record rights in the resolver (text/addr), after ENS's feedback. | §6 template: "the next step is [one realistic next milestone]" |
| **Invite the audience in** | "It's live — open ens-drive.vercel.app and you're the outsider." | PaintGlobal: "inviting the audience to try the product" |

**What we must not do** (from the guide):

- **Overload the journey** (Veil): every extra feature must earn its time. The resolver permission, nested-team detail, new files and the one-folder tab stay *off* the main path — mentioned in one sentence, shown only if asked.
- **Blur real and illustrative** (ALMA's placeholder APY): say plainly it's the ENSv2 **beta** on **Sepolia**, the numbers in the problem are a worked example, and the hosted demo shares one outsider account.
- **Let a failure eat the slot** (Maki): have the fallback ready and switch without apology.
- **Explain a complex protocol by listing parts** (DIVE, Corpus): one scenario, start to finish; the architecture comes after, briefly.

---

## 2. Demo video (3:00 — inside the 2–4 minute limit)

Follows the guide's §6 timing template. Record the **Cascade** tab of the live site; cut the ~12-second block waits in editing, never a failure.

| Time | Beat | On screen | Said |
|---|---|---|---|
| 0:00–0:20 | **Problem** (specific user, quantified, and why ENSv2 makes it worse) | The hero, then the strip's "Missing" cell with the numbers | "Imagine you lead a team of five that manages twenty ENS names — one per service — across three folders. In ENSv2 every folder is its own registry with its own permission list, and every permission is one address on one name: three hundred grants, and when someone leaves, sixty revokes. We built ENS Drive to fix that." |
| 0:20–0:35 | **Solution** (one sentence + the familiar comparison) | The three-part strip | "ENS Drive is Google Drive–style sharing for ENS names. ENSv2 already nests names like folders; we add the sharing: share a name with a team, and everyone in it can manage every name below — including folders further down." |
| 0:35–0:50 | **The setup** (what's already in place) | The drive: point at the folders, then the groups | "Here's the setup — it's written on screen, under the path. Two folders: acme-labs.eth, and platform inside it, with three service names. platform is shared with dev-team; acme-labs.eth, the folder above, is shared with security — and security includes another team, sre. That's the whole admin work: two shares, done once. Everything after this is just who's in which team." |
| 0:50–1:02 | **Demo — first action and response** | Edit as Alex → refused | "Alex just joined. Alex tries to edit svc-api — refused, on-chain. Nobody shared anything with them." |
| 1:02–1:15 | | Drag Alex into dev-team → **all three badges flip to "can edit"** → edit → saved | "One drag into dev-team — and all three names flip to editable at once. The edit works. Nothing was written to any of them: one action, every name." |
| 1:15–1:38 | **Demo — the central technical action** | Drag Alex to sre → edit → saved; "via security · shared on acme-labs.eth, one folder up" | "Now move Alex into sre, inside security. security isn't shared on platform at all — it's shared on the folder *above*. Still editable: sharing flows down, through a team inside a team." |
| 1:38–1:50 | **Demo — the verifiable result** | Switch off → edit → refused → switch on | "Turn the cascade off — gone. On — back. It's checked live on every write, never copied." |
| 1:50–2:25 | **Technical differentiator** (make the mechanism visible) | The "On-chain, just now" card beside the drive, then Behind the scenes | "Here's how. Instead of a new permission system, we override one lookup inside ENSv2's own access control. Every write still goes through ENS's own check; our version walks up the folders, confirms each really contains the next, asks only the teams that could help, and stops as soon as access is proven. That's what you're seeing in the real call tree from the mined transaction." |
| 2:25–2:40 | **Threat → response** | Try an attack → refused | "And the obvious attack — adding a group that says yes to everyone — is refused. Members can use access; they can never grant it." |
| 2:40–3:00 | **Proof, next step, invitation** | Under the hood → the live URL | "We built this during the hackathon, live on the ENSv2 beta on Sepolia: two versions, seventy-one tests, and symbolic proofs that it only ever adds the access the folders grant. Next: rights on individual records. It's live — open ens-drive.vercel.app, and you're the outsider." |

---

## 3. Live finalist pitch (4:00 demo + 3:00 Q&A)

Same beats as the video, spoken live. Every click waits for a Sepolia block (~12 s): talk through the waits — they are where the explanation goes.

| Time | Beat | Do | Say (short form — expand from §2) |
|---|---|---|---|
| 0:00–0:20 | Problem | Hero on screen | The 5 × 20 × 3 = 300 grants line. |
| 0:20–0:35 | Solution | Strip | "Google Drive–style sharing for ENS names." |
| 0:35–0:50 | The setup | Point at the setup line under the path, then the folders and groups | "acme-labs.eth shared with security (which includes sre), platform shared with dev-team — two shares, done once; the rest is who's in which team. Alex is a new teammate." |
| 0:50–2:15 | One journey (≈7 transactions) | Steps 1–8 of the guide bar; press **Start over** before you go on stage | Narrate each wait: *what just happened on-chain* while the next block comes. |
| 2:15–3:10 | Differentiator | The "On-chain, just now" card → Behind the scenes | "One override, inside ENS's own check; walks up, verifies, stops early." |
| 3:10–3:30 | Threat → response | Attack | "Refused — members use access, never grant it." |
| 3:30–4:00 | Proof + next + invite | URL on screen | Tests, proofs, live on Sepolia; next: per-record rights; "you're the outsider." |

**Fallbacks (Maki's lesson — switch, don't apologise):**

1. Sepolia slow or the page stalls → a pre-recorded run of the same journey (the video), continue narrating over it.
2. Browser dead → terminal: `npm run smoke:v2` runs the same journey and prints each step with Etherscan links.
3. Both → the result screenshots and the Etherscan links in `docs/roadmap-v2.md` §5.

**Q&A — answers ready** (full list in [`architecture-talk.md`](architecture-talk.md) and [`qa.md`](qa.md)):

- *"Why not ENSv2's registry-wide grants?"* — They cover future names inside one registry, but a team spanning folders needs a grant in every registry and every join touches all of them; with ENS Drive a join is one transaction. (Say this honestly — it's in the problem statement too.)
- *"What does access mean — text records?"* — Registry permissions on each name (`SET_SUBREGISTRY`, `SET_RESOLVER`), not records; per-record rights are the next step.
- *"Gas?"* — Owners pay nothing extra; a member's edit via its own folder ≈ the one-folder version (≈97.7k vs ≈91.9k on Sepolia).
- *"Is it safe?"* — Only adds access, never admin or registry-wide roles; every outside call capped and fails closed; proven symbolically for all inputs; not audited.

---

## 4. What this means for the UI

The guide is about pitches, but three of its lessons point at the page itself — judges open the live link.

| Lesson | Change | Status |
|---|---|---|
| ALMA — a quantitative problem statement | Put the 300-grants line (with the honest registry-wide caveat) on the page, next to the "In ENS today" card or in the strip's "Missing" cell, so the problem in the video is visible on screen. | Proposed |
| PaintGlobal — invite people to try it | "Try it live ↓" in the hero already; add "you're the outsider — every click is a real transaction" on the first guide step. | Proposed |
| Maki / npmguard — make the mechanism visible | The "On-chain, just now" card — each contract call in plain words, bottom-right while you use the drive — and the full Behind the scenes tree below it. | Done |
| Défi — intuitive picture before the stack | Drive metaphor first; ENS terms in one muted line under the drive; architecture after the demo. | Done |
| Veil — each feature must earn its time | One verb on the main path; resolver right, new file, attack and the one-folder tab one step off it. | Done |
| ALMA — separate real from illustrative | "Live · Sepolia" badge, "ENSv2 beta" wording; the problem's numbers labelled as a worked example. | Partly (label the numbers) |
| Corpus — one scenario, setup to outcome | The 8-step guide bar is exactly one scenario; the last step's message closes it ("That's the cascade"). | Done |
