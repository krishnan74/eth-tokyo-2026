# ENS Drive — finalist video and pitch, built on the Cannes pattern

Reference: [`pitch-drafting-guide-for-finalist`](pitch-drafting-guide-for-finalist) — an analysis of the ETHGlobal Cannes finalists' pitches from the closing-ceremony transcript. This file applies it to ENS Drive, section by section. Where the guide says something, we follow it; where it only describes one team, it's used as a lesson, not a rule. Judging format (ETHGlobal): 4 minutes of demo + 3 minutes of Q&A live; the submission video must be 2–4 minutes.

---

## The setup, in one breath (say it before the first click)

What's already on-chain when the demo starts — the judges need this map before the clicks mean anything:

- **Folders:** `orbit-dao.eth` (a real ENSv2 name on the beta — a fictional DAO) and `protocol` inside it (`protocol.orbit-dao.eth`, its own registry), holding three contract names: `vault`, `oracle`, `bridge`.
- **Sharing (two grants, made once by the owner):** `protocol` is shared with **core-devs** — "can edit". `orbit-dao.eth` is shared with the **security-council** — "can edit" (and "can set resolver").
- **Teams:** **core-devs** is a roster; the **security-council** is a team that includes another team, the **auditors**.
- **The switch:** "Sharing flows into subfolders" is on — the folder above counts.
- **Alex** — a new contributor, with their own name `alex.orbit-dao.eth` (owned by the demo's account; `alex-dev.orbit-dao.eth` when run locally) — starts in no team. Everything in the demo is moving Alex between teams; no name is touched, and every change visibly reaches all three contract names at once.

## Is "Imagine you lead a web3 organization that uses ENS for its names" right for this project?

Yes — checked against the guide and against what we can back up:

- **It's what the guide asks for** (§6 template: "Imagine you're [specific user] trying to [specific task]"; Défi: an intuitive picture before the stack). A web3 organization is the specific user; managing who can change its names is the task.
- **It fits the audience.** ENS judges and web3 finalist judges recognise a DAO with contracts, a core team and a security council with auditors — more than a generic company.
- **It's framed as "imagine", with a worked example.** We don't claim a real DAO has this exact problem at this scale; the 300-grants figure is labelled as a worked example on the page, and the registry-wide-grant caveat is stated (ALMA's lesson: separate real from illustrative).
- **Keep two honesty points in the words:** it runs on the **ENSv2 beta on Sepolia** (ENSv2 isn't on mainnet yet), and **orbit-dao is fictional** — never name a real DAO (it would read as an endorsement).
- **"uses ENS for its names — its contracts, its services, its people"** is a fair general description of how organizations use ENS subnames; say it as the scenario, not as a statistic.

## 1. The formula, mapped to ENS Drive

The guide's finalist formula has three ingredients (§4) inside a five-beat sequence (§2).

| Guide beat | ENS Drive | Source in the guide |
|---|---|---|
| **Name the problem** — specific, quantitative if credible | A web3 organization's team of 5 managing 20 ENS names across 3 folders needs **300 separate grants**; someone leaving means **60 revokes**. (ENSv2's registry-wide grants cut that to 15 — but every join or leave still touches every folder.) | ALMA: "use a quantitative problem statement" |
| **Start from something familiar and its limit** | Google Drive: you share a folder, not each file with each person. ENS has the folders — it doesn't have the sharing. | DIVE: "a comparison to an existing product can quickly establish why your solution matters" |
| **One-sentence solution, with a product identity** | "ENS Drive is Google Drive–style sharing for ENS names: share a name with a team, and everyone in it can manage every name below." | §2: "a product identity and a simple explanation" |
| **One complete user journey, action → observable result** | Alex (alex.orbit-dao.eth) is refused → dragged into core-devs → all three contract names become editable → moved into the auditors, a team inside the security council shared *one folder up* → still can edit → cascade switched off → refused. | Défi, Corpus: "one coherent scenario from setup to outcome" |
| **Technical differentiator, visible** | The "On-chain, just now" card (bottom-right, after every action) and *Behind the scenes*: ENS's own permission check, answered by one overridden lookup that walks up the folders — checking each really contains the next — and stops as soon as access is proven. | Maki: "make [the mechanism] visible"; npmguard: "a straightforward user workflow followed by a deeper explanation of the machinery" |
| **Show the threat and the response** | The attack: Alex tries to add a group that says yes to everyone → refused on-chain, with the reason. | ENShell: "show the threat, the detection and the response" |
| **Proof and a working result** | Live on the ENSv2 beta; 71 tests, 3 symbolic proofs; a member's edit costs about the same as the one-folder version. | EVM PORST: "the demo should validate the implementation" |
| **One realistic next step** | Per-record rights in the resolver (text/addr), after ENS's feedback. | §6 template: "the next step is [one realistic next milestone]" |
| **Invite the audience in** | "It's live at ens-drive.vercel.app, and when you open it, you get to be Alex." | PaintGlobal: "inviting the audience to try the product" |

**What we must not do** (from the guide):

- **Overload the journey** (Veil): every extra feature must earn its time. The resolver permission, nested-team detail, new files and the one-folder tab stay *off* the main path — mentioned in one sentence, shown only if asked.
- **Blur real and illustrative** (ALMA's placeholder APY): say plainly it's the ENSv2 **beta** on **Sepolia**, the numbers in the problem are a worked example, orbit-dao is fictional, and every visitor to the hosted demo shares the same Alex.
- **Let a failure eat the slot** (Maki): have the fallback ready and switch without apology.
- **Explain a complex protocol by listing parts** (DIVE, Corpus): one scenario, start to finish; the architecture comes after, briefly.

---

## 2. Demo video (about 3:00, inside the 2 to 4 minute limit)

Record the **Cascade** tab of https://ens-drive.vercel.app, starting from **Start over**. Cut the block waits (about 12 seconds each) in editing, never a failure. Things in [brackets] are what's on screen; everything else is what you say, in your own voice. Names are written the way you say them.

**0:00 · The problem** [the hero, then the numbers in the “Missing” card]

> Imagine you lead a web3 organization that uses ENS for its names. Your contracts, your services, your people.
>
> Say a team of five looks after twenty of those names, spread across three folders. In ENSv2 every folder is its own registry, with its own permission list, and every permission is one address on one name. That's three hundred grants. And when someone leaves, it's sixty revokes.
>
> We built ENS Drive to fix that.

**0:20 · The idea** [the three part strip]

> ENS Drive is Google Drive style sharing for ENS names. ENSv2 already lets names nest like folders. What it doesn't have is sharing. So we added it: you share a name with a team, and everyone in that team can manage every name below it, even in the folders further down.

**0:35 · The setup** [the drive, the setup line under the path, then the folders and the teams]

> Here's our DAO, orbit dao dot eth. It's a real ENSv2 name on the beta. Inside it there's a protocol folder with three contract names: vault, oracle and bridge.
>
> The protocol folder is shared with the core devs. And orbit dao itself, the folder above, is shared with the security council, which has the auditors inside it.
>
> That's all the admin work there is. Two shares, done once. Everything from here on is just who's in which team.

**0:50 · Refused** [click Edit as Alex on vault; the red result]

> This is Alex. Alex just joined as a contributor, and has their own name in the DAO, alex dot orbit dao dot eth. Alex tries to edit the vault, and it's refused, on chain. Nobody has shared anything with them yet.

**1:02 · One drag** [drag Alex into core devs; the chip moves straight away while it confirms; then all three badges turn to “can edit”; click Edit]

> Now I drag Alex into the core devs. And look at the files. Vault, oracle and bridge all become editable, at the same time. The edit goes through.
>
> Nothing was written to any of those names. One change to the team, and it reaches every name in the folder.

**1:15 · The cascade** [drag Alex from core devs into the auditors; click Edit; “via auditors → security council”]

> Now let's move Alex to the auditors, inside the security council. The council isn't shared on the protocol folder at all. It's shared on orbit dao, one folder up. And Alex can still edit. The sharing flows down, and it even works through a team inside a team.

**1:38 · Off and on** [turn off “Sharing flows into subfolders”, Edit is refused, turn it back on]

> If I switch the cascade off, that access is gone. Switch it back on, and it's back. Nothing is ever copied. It's checked live, on every single write.

**1:50 · How it works** [the “On-chain, just now” card, then scroll to Behind the scenes]

> So how does this work? We didn't build a new permission system. We changed one lookup inside ENSv2's own access control.
>
> Every write still goes through the check ENS already does. Our version just walks up the folders, makes sure each one really contains the next, asks only the teams that could actually help, and stops the moment access is proven. What you're seeing here is the real list of contract calls, straight from the mined transaction.

**2:25 · The attack** [click Try an attack; refused]

> And the obvious attack, where Alex tries to add a group that says yes to everyone, is refused. Members can use the access they're given. They can never hand it out.

**2:40 · Close** [Under the hood, then the live link]

> We built all of this during the hackathon, and it's live on the ENSv2 beta on Sepolia. There are two versions, seventy one tests, and symbolic proofs that it only ever adds the access the folders give. Next, we want to bring the same idea to individual records.
>
> It's live right now at ens drive dot vercel dot app, and when you open it, you get to be Alex. Thank you.

---

## 3. Live finalist pitch (4 minutes of demo, then 3 minutes of questions)

Same story as the video, spoken live. Press **Start over** before you go on stage. Each click waits about 12 seconds for a Sepolia block, so use the waits to explain what just happened. The lines below are written for exactly those waits.

**The problem** (about 20 seconds) [hero]

> Imagine you lead a web3 organization that uses ENS for its names. A team of five, twenty names, three folders. In ENSv2 that's three hundred grants to keep right, and sixty revokes every time someone leaves. ENS Drive fixes that.

**The idea and the setup** (about 30 seconds) [strip, then the drive]

> It's Google Drive style sharing for ENS names. Here's our DAO, orbit dao dot eth. The protocol folder is shared with the core devs, and orbit dao itself is shared with the security council, which has the auditors inside it. Two shares, done once. After that it's only about who's in which team. And this is Alex, a new contributor, alex dot orbit dao dot eth.

**The journey** (about 1:30, around seven transactions)

> [Edit as Alex] Alex tries to edit the vault.
>
> *While it confirms:* Nobody has shared anything with Alex yet, so ENS's own check should say no.
>
> [refused] Refused, on chain.
>
> [drag into core devs] Now I add Alex to the core devs.
>
> *While it confirms:* That's one ordinary change to the team. I'm not touching any of the names.
>
> [badges flip] And all three names are editable now. [Edit] The edit goes through.
>
> [drag to auditors] Now I move Alex to the auditors, inside the security council.
>
> *While it confirms:* The council is shared one folder up, on orbit dao itself, not on protocol.
>
> [Edit] And Alex can still edit. The sharing flows down, through a team inside a team.
>
> [switch off, Edit] If I turn the cascade off, it's refused. [switch on] And on again, it's back.

**How it works** (about 45 seconds) [the “On-chain, just now” card, then Behind the scenes]

> Under the hood there's no new permission system. We changed one lookup inside ENSv2's own access control. It walks up the folders, checks each one really contains the next, asks only the teams that could help, and stops as soon as access is proven. These are the real contract calls from that transaction.

**The attack and the close** (about 35 seconds)

> [attack] If Alex tries to add a group that says yes to everyone, it's refused. Members can use access, never give it out.
>
> It's live on the ENSv2 beta, with seventy one tests and symbolic proofs behind it. Next we want the same thing for individual records. Open ens drive dot vercel dot app and you can be Alex yourself. Thank you.

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
| ALMA — a quantitative problem statement | The 300-grants line (with the honest registry-wide caveat, labelled a worked example) is in the strip's "Missing" card, so the problem in the video is on screen. | Done |
| PaintGlobal — invite people to try it | "Try it live ↓" in the hero; the first guide step says every click is a real transaction; the close invites people to be Alex. | Done |
| Maki / npmguard — make the mechanism visible | The "On-chain, just now" card — each contract call in plain words, bottom-right while you use the drive — and the full Behind the scenes tree below it. | Done |
| Défi — intuitive picture before the stack | Drive metaphor first; ENS terms in one muted line under the drive; architecture after the demo. | Done |
| Veil — each feature must earn its time | One verb on the main path; resolver right, new file, attack and the one-folder tab one step off it. | Done |
| ALMA — separate real from illustrative | "Live · Sepolia" badge, "ENSv2 beta" wording, the problem's numbers labelled as a worked example, orbit-dao fictional. | Done |
| Corpus — one scenario, setup to outcome | The 8-step guide bar is exactly one scenario; the last step's message closes it ("That's the cascade"). | Done |
