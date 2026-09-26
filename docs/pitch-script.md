# ENS Drive — pitch script for the ENS team

> **Naming:** *ENS Drive* is the product; *Cascade* is its permission layer — the `CascadeSubregistry` contract and the ReBAC rule it implements. Contract and code names stay `Cascade…`, matching the Sepolia deployment.

About **7 minutes of talking**, then questions. Stage directions are in **[brackets]**; everything else is spoken. The demo sends up to 7 Sepolia transactions (~12 s each) — the lines marked *while it confirms* fill those waits.

**Before you start:** `npm run ui` running · fresh browser window at the top of the page · press **Start over** if the outsider is still in the group · fallback terminal ready (`npm run demo -- --core`).

---

## 0:00 — Opening

**[On the intro: "Share ENS names like a folder."]**

> "Hi — I'm [your name]. This is ENS Drive — you'll recognise the idea from Google Drive.
>
> **[Point at the three-part strip.]** ENSv2 already built the directory tree — every name can have its own registry, so names nest like folders: acme-corp, devops, svc-api. What's missing is the **sharing layer**. Today, EAC grants permissions one address on one name — there's no way to share a folder with a group.
>
> ENS Drive adds that permission layer with Cascade — a relationship-based access control rule: a name trusts a team, and the team's members inherit — checked live, nothing copied. It's built into EAC's own role lookup and replaces nothing. And to be upfront: this MVP is deliberately one hop and one team, to test the rule itself."

---

## 0:50 — The problem, in drive terms

**[Scroll to the two cards.]**

> "Today it's like sharing each file with each person: two people, three names — six separate grants. A new name needs new grants; someone leaves, you hunt down every one.
>
> With Cascade it's like sharing the folder with a group: one grant to the team covers every name under devops, today's and tomorrow's."

---

## 1:20 — Live demo

**[Scroll to Try it. The drive shows the `devops` folder.]**

> "These are real ENSv2 contracts on Sepolia. The `devops` folder is `devops.acme-corp.eth` — a name with its own registry. Files are its subnames. The group is a team contract."

**[Click the "Shared with devops-team · Share" pill.]**

> "Just like Drive's share dialog: this folder is shared with **devops-team**, can edit — and it applies to every file, including new ones. In ENS terms, the parent registry grants the team contract the `SET_SUBREGISTRY` role on devops. **[Click Done.]**"

### Create a file

**[Click "+ New file".]**

> "A brand-new file — a new subname."

*While it confirms:*
> "Notice nobody is given access to it. It's created with no editor at all."

### The outsider tries to edit

**[Click "Edit as outsider".]**

> "Our outsider tries to edit it —"

**[Refused.]**

> "— refused, on-chain. **[Point at Who has access.]** Outsider: no access. Not in the group."

### Drag the outsider into the group *(the key moment)*

**[Drag the outsider chip into devops-team.]**

> "Now I add them to the group. That's one ordinary EAC grant on the team contract — nothing written to any file."

*While it confirms:*
> "Watch who has access on the right."

**[It lands.]**

> "Outsider — **can edit, via devops-team**. And look underneath: *given directly: none*, *via the group: SET_SUBREGISTRY*. Nothing was written to the file. That's Cascade adding to EAC, not replacing it."

### The same edit again

**[Click "Edit as outsider".]**

> "Same file, same person, same call —" **[saved]** "— it works. Only the group changed."

### Drag them out, edit again *(skip if short on time)*

**[Drag the outsider back to People.]**

> "Remove them from the group — one revoke. No cleanup file by file."

**[Click "Edit as outsider".]** "…and it's refused again, immediately."

### The attack

**[Click "As the outsider, change who the folder is shared with".]**

> "The obvious attack: point the folder at a group that says yes to everyone." **[Refused.]** "Refused — only an admin holds the role to change the folder's group."

---

## 4:30 — Behind the scenes

**[Scroll to Behind the scenes.]**

> "Here's what actually ran — replayed from the mined transaction. The outsider called `setSubregistry` on the devops registry. Inside, ENS's own permission check asks one question, and Cascade's override answers it: it reads the parent registry — the team holds `SET_SUBREGISTRY` — then asks the team contract — is this caller a member? Both are read-only, gas-capped calls. Member: allowed. Not a member: reverted with `EACUnauthorizedAccountRoles`."

---

## 5:15 — Under the hood

*If they want the deep version, switch to the full track in [`architecture-talk.md`](architecture-talk.md).*

**[Scroll to Under the hood.]**

> "Three contracts, one overridden function. The parent registry is stock ENSv2. Cascade is ENS's own `PermissionedRegistry` with one function overridden — `_getRoles`, the hook EAC documents for this, and that the stock registry already uses for approved operators. The team is a plain EAC contract.
>
> Every ENS function is unchanged; because `_getRoles` is virtual, every check runs Cascade's version, which runs ENS's first and then adds the team's grant — never admin roles, never registry-wide roles.
>
> What changes, named: views include inherited roles, inherited roles emit no events, and each lookup costs about 2,300 extra gas."

---

## 6:15 — Roadmap, in one breath

**[Point at the "Next — not built yet" note under Folders.]**

> "In Drive, sharing a parent folder cascades into every subfolder — that's the name, and it's the roadmap: multi-level sharing, several groups per folder, groups of groups, and existing rosters like Hats or a Safe as the group. None of that is built yet; today it's one level, deliberately."

---

## 6:40 — The ask

> "So, four questions:
>
> **One** — EAC exposes how many hold a role, not who, so I point at the team and read the parent's grant live. Right shape, or would you rather expose holder enumeration?
>
> **Two** — is `_getRoles` the intended, stable hook for inheriting from another contract?
>
> **Three** — does 'one team roster, shared by many registries' match a need you see, beyond root grants?
>
> **Four** — should team contracts be required to be narrow?
>
> And would agent fleets be where you'd want this?"

**[Stop. Listen. Write down their exact words.]**

---

## Recovery lines

| If… | Say / do |
|---|---|
| A transaction is slow | "Sepolia's taking its time — the drive won't change until the block confirms." Keep talking. |
| The page or RPC fails | "Same sequence from the terminal." Run `npm run demo -- --core`. |
| Behind the scenes says "trace unavailable" | "The free RPC only keeps recent state — here's the transaction on Etherscan instead." |
| The outsider starts in the group | Press **Start over** before you begin. |
| Short on time | Skip "drag them out" and Under the hood. Keep: the drag-in → edit flip, the attack, Behind the scenes, the ask. |
| A question you can't answer | "I don't know yet — can I note it down?" |
