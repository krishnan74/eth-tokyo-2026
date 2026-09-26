# ENS Drive quiz

> **Naming:** *ENS Drive* is the product; *Cascade* is its permission layer — the `CascadeSubregistry` contract and the ReBAC rule it implements. Contract and code names stay `Cascade…`, matching the Sepolia deployment.

36 questions in 10 sections, from the basics up to pitch scenarios. Answer each one before scrolling to the **answer key** at the bottom — every answer comes with a one-line explanation. Aim for 30+ before pitching.

---

## A. Prerequisites

**1.** In ENS, each name in a `PermissionedRegistry` is a token under which standard, and how many owners can one name have?
- a) ERC-20, many owners
- b) ERC-721, one owner
- c) ERC-1155, exactly one owner
- d) ERC-1155, up to 15 owners

**2.** What is the value of `1 << 20` in hex?
- a) `0x20`
- b) `0x100000`
- c) `0x1000000`
- d) `0x14`

**3.** `0b1000 | 0b0010` equals:
- a) `0b0000`
- b) `0b1010`
- c) `0b1000`
- d) `0b0010`

**4.** Which expression checks whether a bitmap `b` has role `r` switched on?
- a) `b | r == r`
- b) `(b & r) == r`
- c) `b << r`
- d) `b == r`

**5.** How does ENS turn a label like `"svc-api"` into a number contracts can use?

---

## B. ENSv2 basics

**6.** What is the key structural change in ENSv2 compared with a single global registry?

**7.** What does a name's **subregistry** point to, and what does its **resolver** point to?

**8.** Why does `.eth` registration use commit–reveal, and how long is the wait between commit and reveal?

**9.** What is the Universal Resolver, and what trap did we hit with it in viem?

---

## C. Enhanced Access Control (EAC)

**10.** In one sentence, what is a **resource**?

**11.** What is `ROOT_RESOURCE`, and what does a role granted there mean?

**12.** When EAC checks a role for an account on a name, which two places does it combine?

**13.** A role bitmap is 256 bits. What does the **upper half** (bits 128–255) hold?

**14.** How is the admin role for `SET_SUBREGISTRY` written in code, and what does holding it let you do?

**15.** Why does EAC allow at most **15** holders per role — and what does that tell you about what EAC can and can't report?

**16.** Which function do you use to grant a role on the **root** resource, and what happens if you call plain `grantRoles` with resource 0?

**17.** What is `_getRoles`, and who already overrides it in stock ENSv2 (before Cascade)?

---

## D. Registry vs resolver, token ID vs resource

**18.** Give one example each of a **registry** role and a **resolver** role.

**19.** Resolver permissions are organised by **record type**, not by name. Why does that stop Cascade's rule from simply being applied to resolver records?

**20.** A name's **token ID** changes on which events? Its **resource** changes on which events?

**21.** Why does ENS change the token ID when permissions change?

---

## E. The Cascade mechanism

**22.** State the Cascade rule in one sentence.

**23.** In this code, what does each line do?
```solidity
roleBitmap = super._getRoles(resource, account);
if (resource == ROOT_RESOURCE) return roleBitmap;
uint256 granted = _teamGrant();
if (granted != 0 && _isMember(account)) roleBitmap |= granted;
```

**24.** Why does Cascade use a stored `team` pointer instead of asking the parent "who holds this role?"

**25.** Name the three facts that must all be true for a team member to act, and where each one lives.

**26.** Which two kinds of roles can a team member **never** inherit, and why does each matter?

**27.** What four checks or effects does `setTeam` apply?

**28.** Why are the external calls made as low-level STATICCALLs with a length check instead of `try/catch`?

**29.** If `devops` is unregistered and re-registered, does the team keep its access? Why or why not? And what happens on a **transfer** of `devops`?

---

## F. What changes and the limits

**30.** Name three things that change for users of the registry because of Cascade (named, not hidden).

**31.** For a team member, `hasRoles()` returns **true** on an **unregistered** subname. Why doesn't that let them write to it?

---

## G. Deployment and ENSv2 dependency

**32.** Which exact ENS source commit is Cascade built on, and why that one?

**33.** Name two ENSv2 behaviours Cascade depends on, and what would break if ENS changed each.

---

## H. The demo

**34.** In the drive demo's **Who has access** panel, what do **"given directly"** and **"via the group"** show before and after the outsider joins devops-team — and what does that prove?

**35.** Why does the demo *send* refused writes as real transactions instead of only simulating them?

---

## I–J. Roadmap and pitch scenarios

**36.** An ENS engineer says: *"This is just Zanzibar for ENS."* How do you respond accurately — and what are the next roadmap steps?

---

## Bonus scenario (not scored)

An ENS engineer asks: *"Why wouldn't a DAO just give its Safe the role?"* Answer in two sentences.

---
---

# Answer key

**1. c.** ENS uses ERC-1155 in "singleton" mode: each name ID has exactly one owner, like an NFT.

**2. b.** A 1 moved 20 places left = 2²⁰ = 1,048,576 = `0x100000`. That's `SET_SUBREGISTRY`.

**3. b.** OR switches a bit on if it's on in either number.

**4. b.** AND keeps only the bits on in both; if the result equals `r`, every bit of the role is on.

**5.** It hashes it with keccak256 (the "labelhash"). The same text always gives the same number.

**6.** Every name can have **its own registry**. Resolving a name walks registry → registry down the tree.

**7.** The subregistry is where the name's **children** live (the next registry down). The resolver is where the name's **records** live (addresses, text).

**8.** To prevent **front-running**: committing a hidden hash first means nobody can see and snipe the name. The wait is **60 seconds**.

**9.** The single entry point apps use to resolve any ENS name. viem ships a built-in Universal Resolver address for a **different deployment**, so it must be overridden, or resolution silently targets the wrong ENS.

**10.** The ID of the thing a permission is about — in a registry, one per name.

**11.** Resource ID **0**, meaning the whole registry. A role granted there applies to **every name** in that registry — like a master keycard.

**12.** The account's roles on **the name's resource** and on **`ROOT_RESOURCE`**, combined with OR.

**13.** The **admin** versions of each role.

**14.** `SET_SUBREGISTRY << 128`. Holding it lets you **grant and revoke** `SET_SUBREGISTRY` for other accounts.

**15.** EAC keeps a per-role **count** of holders in 4 bits, and 4 bits can count to 15. So EAC can report **how many** hold a role, but not **who** — it stores no list of holders.

**16.** `grantRootRoles`. Plain `grantRoles` **reverts** on resource 0 (`EACRootResourceNotAllowed`).

**17.** EAC's internal function that returns an account's role bitmap for a resource — its documented hook for adding role logic at read time. Stock `PermissionedRegistry` already overrides it so an **approved operator** gets the token owner's roles.

**18.** Registry: `SET_SUBREGISTRY`, `SET_RESOLVER`, `RENEW`, `REGISTRAR`. Resolver: `SET_ADDRESS`, `SET_TEXT`.

**19.** Cascade inherits from a **parent name**. Resolver permissions aren't organised by name, so there's no parent to walk up to — that needs a different mechanism, which is why it's a roadmap item that depends on ENS feedback.

**20.** Token ID: on every **grant or revoke** (and unregister). Resource: on **unregister / expiry / re-registration**.

**21.** To protect **buyers**: a sale listing is tied to a token ID, so if the seller quietly changes permissions, the old listing no longer matches and can't be filled on stale terms.

**22.** An account's roles on a subname = its own EAC grants **plus** the roles the parent grants the team, **if the account is a member of the team**.

**23.** Line 1: get the account's own stored roles (stock EAC, via `super`). Line 2: if this is about the whole registry (root), stop — nothing is inherited at root. Line 3: ask the parent which roles it grants the team on `devops`, with the admin half stripped. Line 4: if the parent grants anything and the account is a member, **OR** those roles in.

**24.** EAC stores **counts**, not identities, so the parent can't be asked "who holds this role?". Cascade names its candidate (the team) and checks the parent's grant to it live. The **grant is the authority**; the pointer alone grants nothing.

**25.** (1) The parent grants the team the role on `devops` — in the **org registry**. (2) The account is a member — in **TeamRegistry**. (3) Cascade reads this team — the **`team` pointer** in CascadeSubregistry. Cut any one and access ends.

**26.** **Admin roles** — so members can never grant or revoke anything. **Root roles** — so members can never register names, upgrade the registry, or change the team.

**27.** Requires **`ROLE_SET_TEAM`** on root; rejects a **non-contract** (`TeamNotContract`); requires the **`ITeam` interface via ERC-165** (`TeamInterfaceUnsupported`); **emits `TeamPointerUpdated(old, new, by)`**.

**28.** `try/catch` does **not** catch return data it can't decode, so a team returning garbage (e.g. 1 byte) would make every role check revert — including native owners'. The low-level call with a length check **fails closed** instead. The STATICCALL also means the called contract can't change any state.

**29.** **No.** Cascade reads the parent's grant against the parent's **current** resource; re-registration creates a fresh resource without the team's grant, so access ends automatically. On a **transfer**, the grant **stays** (stock ENSv2 keeps third-party grants), and the new owner can revoke it in one call.

**30.** Any three of: `hasRoles()` / `roles()` include inherited roles; inherited roles **emit no events** (indexers should call `hasRoles()`); about **2,300 gas extra per write**, native owners included; a new root role **`ROLE_SET_TEAM`** plus the pointer; `explain()` doesn't check expiry; the team contract holds a latent `SET_SUBREGISTRY` on `devops`.

**31.** Writes check **expiry first**. An unregistered name counts as expired, so the write reverts with `LabelExpired` before roles are even consulted. The quirk affects views only.

**32.** `ensdomains/contracts-v2` at **`48b3e2d`**, because it matches the ENSv2 **beta deployed on Sepolia**, which Cascade's contracts talk to.

**33.** Any two, for example: **`_getRoles` stays overridable and feeds every check** (else Cascade can't hook in, or views would disagree with writes); **`roles()` on the parent reads the current resource** (else the live grant check changes); **grant rights come only from admin bits** (else the no-escalation guarantee must be re-proven); **resource versioning on unregister/expiry** (else automatic invalidation must be re-proven); **`setParent` / `getParent`** (else Cascade needs its own parent pointer).

**34.** "Given directly" (`nativeRoles()`) stays **`none` the whole time**. "Via the group" goes from `none` to **`SET_SUBREGISTRY`** when the outsider joins, and back to `none` when they leave. It proves Cascade **adds to** EAC without writing anything into it.

**35.** A mined **failed transaction** on Etherscan is **evidence**; a simulation is only a claim. The revert reason is decoded from a simulation just before sending, so it comes from the chain, not from the script.

**36.** *"It's the same idea as Zanzibar's parent-inheritance rule, but one hop and one relation, inside EAC — not a general engine."* Next steps: many teams per role, teams of teams, multi-hop names, bring-your-own roster (Hats / Safe). After ENS feedback: who-can-access queries, resolver records, agent fleets.

**Bonus.** *"A Safe works, but every action is routed through the Safe and its signer rules, so members stop acting as themselves. With Cascade, each member signs with their own address and EAC's checks see them directly — and a Safe's owners could even be the team roster, which is a roadmap step."*

---

**Scoring:** 30–36: ready to pitch · 24–29: reread sections E–G of [`study-guide.md`](study-guide.md) · under 24: start with the prerequisites and [`contracts-explained.md`](contracts-explained.md).
