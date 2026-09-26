# Cascade — pitch script for the ENS team

About **9 minutes of talking**, then questions. Stage directions are in **[brackets]**; everything else is spoken. The live demo sends 7 Sepolia transactions (~12 s each) — the lines marked *while it confirms* are there to fill those waits.

**Before you start:** `npm run ui` running · fresh browser window at the top of the page · outsider not in the team · fallback terminal ready (`npm run demo -- --core`).

---

## 0:00 — Opening

**[On the hero: "Roles for teams, not just addresses."]**

> "Hi — I'm [your name]. I've been building on the ENSv2 beta this weekend, specifically on Enhanced Access Control, and I'd love your feedback on one idea.
>
> ENSv2's access control can give a role to an **address**. It can't give one to a **relationship**. Cascade adds one relationship — team membership — as a single extra term inside EAC's own role lookup. So a team can govern every name under a parent, including names created tomorrow, and nothing EAC does today is replaced.
>
> I'll be upfront: this is an MVP, deliberately scoped to **one hop and one team per registry**, so we could test the rule itself. I'll show you the roadmap at the end — and I've got four questions for you that decide where it goes."

**[Point at the facts row.]**

> "These last two numbers are read from Sepolia right now — the parent's grant to the team is live, and our demo outsider is currently outside the team."

---

## 0:45 — The gap

**[Scroll to 01 · The gap.]**

> "Today, every permission in EAC is an address. It answers one question: is the caller's own address listed for this role, on this name?
>
> **[Point at the ledger.]** Here's a team of two managing three service names: that's already six separate grants. Add a person, add a name, it grows. Someone leaves — you revoke on every registry, and if you miss one, access stays behind.
>
> What a team actually needs to say is this: **[point at the quote]** *'Anyone on the devops team may manage every subname under devops — including tomorrow's.'* There's no entry in EAC that means 'members of this team.'
>
> Teams work around it two ways today. Copy every member everywhere — root grants do cover future names, but only inside one registry, and each role caps at 15 holders. Or give the role to one shared contract, like a Safe — which works, but then members stop acting as themselves; everything is routed through the Safe."

---

## 1:45 — The idea

**[Scroll to 02 · The idea — the dark formula band.]**

> "So Cascade adds the relationship and keeps everything else.
>
> **[Read the formula.]** An account's roles on any name under devops are **EAC's own grants** — unchanged, stored and granted exactly as today — **plus the team's grant**, if you're a member. One hop, read live on every check.
>
> Mechanically, it's one contract: a subclass of your own `PermissionedRegistry` that overrides one function, `_getRoles` — the hook EAC documents for exactly this, and that the stock registry already uses for approved operators.
>
> **[Point at the MVP scope line.]** And again — one hop, one team per registry, on purpose for this MVP."

---

## 2:30 — Live demo

**[Scroll to 03 · Live demo. Guided mode is on.]**

> "Let me show it working. These are real contracts on the ENSv2 beta on Sepolia. Every drop and every write here is a transaction, and the board only moves once the chain confirms it.
>
> On the right is `devops.acme-corp.eth`. The org registry above it — which is completely stock — grants the **team contract** its editor role, `SET_SUBREGISTRY`. In the middle is the team roster. On the left is our outsider."

### Step 1 — create a fresh subname

**[Click "+ New subname".]**

> "First, a brand-new service name."

*While it confirms:*
> "Notice what I'm *not* doing: I'm not granting anybody anything on this name. It gets created with nobody holding the editor role on it."

### Step 2 — the outsider tries to write

**[Click "Write" on the new subname.]**

> "Now the outsider tries to repoint it."

*While it confirms:*
> "They're not on the team, and they hold nothing on the name — so EAC should say no."

**[It reverts.]**

> "Reverted, on-chain. **[Point at the checks row.]** You can see the reasoning — direct role: no; the parent does grant the team; but membership: no."

### Step 3 — drag the outsider into the team *(the key moment)*

**[Drag the outsider chip into the team roster.]**

> "Now I add them to the team. This is one ordinary EAC grant on the team contract — nothing Cascade-specific, and nothing written to any name."

*While it confirms:*
> "Watch the subname on the right, and the strip underneath the board."

**[It lands — the lock opens.]**

> "The subname unlocked — and nobody touched it. **[Point at the strip.]** Look at this: *stored in EAC* for the outsider on this name is still **none**. *Effective, with Cascade* now includes `SET_SUBREGISTRY`. That's the whole point: Cascade **adds** to EAC — it doesn't write into it."

### Step 4 — the same write again

**[Click "Write".]**

> "Same name, same address, same call."

**[It succeeds.]**

> "Succeeded. Only the relationship changed."

### Steps 5 and 6 — drag out, write again *(skip if short on time)*

**[Drag the outsider back out to the left.]**

> "And removal is one revoke on the team. No cleanup per name — because nothing was ever stored per name."

**[It lands. Click "Write".]**

> "Same write, a third time…" **[reverts]** "…and it fails immediately. No delay, nothing cached."

### Step 7 — the hijack

**[Drag AlwaysTrueTeam onto the team socket.]**

> "The obvious attack: point Cascade at my own contract that says everyone is a member."

**[It's refused.]**

> "Refused on-chain — `EACUnauthorizedAccountRoles`. Changing the team needs a dedicated root role, the target has to be a contract that declares the team interface, and every change emits an event."

---

## 6:30 — How it fits

**[Scroll to 04 · How it fits.]**

> "Here's where it sits. Registry functions call `_checkRoles`, which reads `_getRoles`, which reads EAC storage. Cascade touches **only** `_getRoles`. Every other layer is stock ENSv2.
>
> What stays the same: storage, grants and revokes; who can grant — admin roles are never inherited; root actions like registering names stay native-only.
>
> And what changes — I want to name these myself. `hasRoles` now includes inherited roles, which keeps views agreeing with writes. Inherited roles emit no events, so indexers should call `hasRoles`. And every role lookup on a subname costs about 2,300 extra gas — native owners included."

---

## 7:15 — Roadmap

**[Scroll to 05 · Roadmap.]**

> "Step zero is what you just saw — one hop. From here, each step widens the relationship, never the trust. Next: several teams per role, so devops can edit and security can revoke. Teams of teams. Multi-hop inheritance up the name tree, with a hard depth cap. And bringing an existing roster — a Hats role or a Safe's owners — in as the team.
>
> The last row depends on you: who-can-access queries, resolver records — which would be a different mechanism, because resolver permissions aren't organised by parent name — and agent fleets as the use case."

---

## 8:00 — The ask

**[Scroll to 06 · The ask.]**

> "Which brings me to why I'm here. Four questions decide whether this is worth taking further:
>
> **One** — EAC exposes how many hold a role, not who, so I used a team pointer and read the parent's grant live. Is that the right shape, or would you rather expose holder enumeration?
>
> **Two** — is overriding `_getRoles` the intended use for inheriting roles from another contract — and is it a stable extension point going forward?
>
> **Three** — root grants already cover future names inside one registry. Does 'one roster shared by many registries' match a need you see?
>
> **Four** — the team contract itself holds a role on devops. Should team contracts be required to be narrow?
>
> And one more: would **agent fleets** be where you'd want this — and would you need it for resolver records too?"

**[Stop. Listen. Write down their exact words.]**

---

## Closing (after the discussion)

> "Thank you — this is exactly what I needed. Everything's on Sepolia with Etherscan links, there's a terminal version of the demo with the edge cases, and I'll build the next step based on what you've said."

---

## Recovery lines

| If… | Say / do |
|---|---|
| A transaction is slow | "Sepolia's taking its time — the board won't move until the block confirms, which is the point." Keep talking through the next line. |
| The page or RPC fails | "Let me show the same sequence from the terminal." Run `npm run demo -- --core`. |
| Something unexpected happens | Say what you see, plainly. Don't guess. Open the Activity log's Etherscan link. |
| You're running out of time | Skip steps 5–6 and section 04. Keep: the join → write flip, the hijack, the roadmap line, the ask. |
| They ask something you don't know | "I don't know yet — that's a great one to test. Can I note it down?" |
