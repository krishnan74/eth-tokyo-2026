# What to say when explaining the technical architecture

The ENS team asked to see "how this is actually happening behind the scenes, as a complete smart-contract-level architecture". This is the spoken track for that — three lengths, the screens to point at, and answers to the follow-ups. Details behind every sentence are in [`architecture.md`](architecture.md) and [`contracts-explained.md`](contracts-explained.md).

---

## The 30-second version

> "ENS Drive's permission layer is one contract, Cascade. It's your own `PermissionedRegistry`, with exactly one function overridden: `_getRoles`, the hook EAC documents for adding role logic, which the stock registry already uses for approved operators.
>
> Every permission check in ENS asks that function 'what roles does this caller have here?'. Cascade answers with the caller's own grants, plus — if the parent registry grants a team contract a role on this name, and the caller is a member of that team — that role. Two read-only calls, gas-capped, checked live. Nothing is copied onto names, and no ENS code is modified."

---

## The full walkthrough (about 3 minutes)

Follow the page: **Behind the scenes** first (it's real), then **Under the hood** (it's the map).

### 1. Start from a real transaction — *Behind the scenes*

**[Point at the trace of the last "Edit as outsider".]**

> "This is replayed from the mined transaction with Foundry's `cast run` — the EVM's own call tree, not a drawing.
>
> The outsider called `setSubregistry` on the devops registry. Inside it you see exactly two outside calls, both read-only:
> first, `OrgRegistry.roles(devops, TeamRegistry)` — the parent registry answers `SET_SUBREGISTRY`;
> then `TeamRegistry.isMember(outsider)` — true or false.
> Member: the write lands and `SubregistryUpdated` is emitted. Not a member: it reverts with your own `EACUnauthorizedAccountRoles`."

### 2. The three contracts — *Under the hood, top row*

**[Point at the three cards.]**

> "Three contracts, and only one has new logic.
> **OrgRegistry** is `acme-corp.eth`'s registry — stock `PermissionedRegistry`. It holds the name `devops`, and one ordinary grant: TeamRegistry holds `SET_SUBREGISTRY` on devops. That's the folder being shared with the group.
> **CascadeSubregistry** is devops's registry — it holds the subnames, a pointer to the team, and its parent, set with your own `setParent`.
> **TeamRegistry** is plain EAC: one `MEMBER` bit per account, and an admin who can flip it. Joining the group is one ordinary `grantRoles`."

### 3. What happens on a write — *the six steps*

**[Point at the numbered path; steps 4–5 are highlighted.]**

> "The outsider calls your stock `setSubregistry`. Your code checks expiry, then runs your normal `_checkRoles`, which asks `hasRoles`, which asks `_getRoles`.
>
> The important part: **Cascade doesn't add a check — it changes the answer.** There's still exactly one check, yours. Cascade's `_getRoles` returns the caller's stored roles — none — plus the team's grant, because the parent grants it and the caller is a member. Your check sees `SET_SUBREGISTRY` and passes."

### 4. How the override reaches your code — *the inheritance column*

**[Point at EAC → PermissionedRegistry → CascadeSubregistry.]**

> "`_getRoles` is virtual. EAC defines it, `PermissionedRegistry` already overrides it for approved operators, and Cascade overrides it once more. Because it's virtual, every call to it from inside your unmodified code — `_checkRoles`, `hasRoles`, `roles`, the grant rules — runs Cascade's version, which calls `super` first. So your logic runs untouched, and the team's grant is added on top."

### 5. Why it's safe — say these unprompted

> "Four properties.
> **One:** admin bits are masked off, so members can use the role but never grant it.
> **Two:** Cascade adds nothing at `ROOT_RESOURCE`, so registry-wide powers — registering, upgrading, changing the team — are never inherited. That's why the attack you saw fails.
> **Three:** both calls are STATICCALLs with gas caps and length-checked returns — a broken or hostile team contract means *no* inherited roles, never extra ones, and the name's owner is never locked out.
> **Four:** the parent's grant is read against devops's *current* registration, so re-issuing the parent ends the team's authority automatically, like any native grant."

### 6. The trade-offs — say them before they're found

> "What changes: `hasRoles` and `roles` now include inherited roles — that's what keeps views agreeing with writes, but it also means they report true for a member on an unregistered label, where writes still revert. Inherited roles emit no events, so an indexer should call `hasRoles`. Every lookup on a subname costs about 2,300 extra gas, native owners included. And the team contract itself holds `SET_SUBREGISTRY` on devops, so team contracts should be narrow."

### 7. Hand it back

> "That's the whole mechanism: one override, two reads, three facts that must all hold — the parent's grant, membership, and the pointer. Cut any one and access ends. Where would you push on it?"

---

## Follow-up questions and answers

| They ask | You say |
|---|---|
| **Why `_getRoles` and not `_checkRoles`?** | "`_checkRoles` only covers writes. `_getRoles` feeds writes *and* the public views, so what the chain reports matches what it enforces. Our first version did override `_checkRoles` — views disagreed with writes, so we moved it." |
| **Why a pointer to the team instead of finding the holder?** | "EAC exposes how many hold a role, not who. So the registry names its candidate and reads the parent's grant live. The grant is the authority; the pointer alone grants nothing." |
| **What exactly does `_teamGrant()` return?** | "One bitmap: `parent.roles(labelhash("devops"), team)` with the admin half masked. Same for every caller and name; zero if anything's wrong or the grant's gone. If it's zero, we don't even ask about membership." |
| **What stops someone swapping the team?** | "`setTeam` needs our own root role, `ROLE_SET_TEAM`; the target must be a contract declaring the team interface via ERC-165; and every change emits `TeamPointerUpdated(old, new, by)`. The role holder is the trust anchor, like any namespace admin." |
| **Can a hostile team contract grief the registry?** | "No — it's read with a STATICCALL, capped at 30k gas, and a short or garbled reply counts as 'not a member'. We found this the hard way: `try/catch` doesn't catch undecodable returns, so a 1-byte reply would have reverted every check. The test for it is in the suite." |
| **Reentrancy?** | "Both calls happen inside view functions, so they're STATICCALLs — the callee can't change any state — and all checks run before the write." |
| **What about the parent name being transferred?** | "A transfer keeps third-party grants in stock ENSv2 — for every delegate, not just us. The new owner can revoke the team in one call. Re-issue or expiry, on the other hand, ends it automatically." |
| **How is this tested?** | "17 Foundry tests with the same shape as Sepolia, including fake teams that lie, loop forever, or return garbage; parent re-issue, expiry and transfer; masked admin bits. Invariant fuzzing is the first roadmap step." |
| **Is it ReBAC or just group RBAC?** | "It's one relationship rule: a subname inherits the role its parent grants a team, for the team's members. That's Zanzibar's parent-inheritance shape — one hop, one relation, inside EAC. Not a general engine." |
| **Is the trace real?** | "Yes — `cast run` re-executes the mined transaction and prints the EVM's call tree. It only works for fresh transactions because free RPCs prune old state." |

---

## Words to avoid

- "Cascade adds a second check" — it doesn't; it changes the answer to the one check.
- "Zanzibar for ENS" without "one hop".
- "No changes to EAC" — say "no changes to EAC's storage or grant rules; views now include inherited roles."
- "Audited" or "production" — it's an MVP on the ENSv2 beta.
