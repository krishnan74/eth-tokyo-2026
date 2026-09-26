# What to say when explaining the technical architecture

The ENS team asked to see "how this is actually happening behind the scenes, as a complete smart-contract-level architecture". This is the spoken track for that — three lengths, the screens to point at, and answers to the follow-ups. It follows the live page's cascade demo (`CascadeSubregistryV2` on `protocol.orbit-dao.eth`); details behind every sentence are in [`architecture.md`](architecture.md) (§7 for the cascade) and [`contracts-explained.md`](contracts-explained.md).

---

## The 30-second version

> "ENS Drive's permission layer is one contract, Cascade. It's your own `PermissionedRegistry`, with the role lookup overridden: `_getRoles`, the hook EAC documents for adding role logic, which the stock registry already uses for approved operators, and `_checkRoles` for writes.
>
> Every permission check in ENS asks 'what roles does this caller have here?'. Cascade answers with the caller's own grants, plus whatever the folders above grant a team the caller is in, up to three folders up, through teams inside teams. Read-only calls, gas-capped, checked live, and it stops as soon as the answer is yes. Nothing is copied onto names, and no ENS code is modified."

---

## The full walkthrough (about 3 minutes)

Follow the page: **Behind the scenes** first (it's real), then **Under the hood** (it's the map).

### 1. Start from a real transaction — *Behind the scenes*

**[Point at the trace of the last edit by Alex, in the auditors.]**

> "This is replayed from the mined transaction with Foundry's `cast run` — the EVM's own call tree, not a drawing.
>
> Alex called `setSubregistry` on `vault`, in the protocol registry. Inside it, every outside call is read-only:
> first, does the orbit-dao registry really point down to protocol? Yes. What does it grant core-devs on protocol? Edit. Is Alex in core-devs? No.
> Then one folder up: does the .eth registry point down to orbit-dao? Yes. What does it grant the security council on orbit-dao? Edit. Is Alex in the security council? It asks the auditors, the team inside it: yes.
> Covered, so it stops, the write lands, and `SubregistryUpdated` is emitted. If nothing covered it, it would revert with your own `EACUnauthorizedAccountRoles`."

The small "On-chain, just now" card beside the drive says the same thing in plain words; point at it if the trace is too dense for the room.

### 2. The contracts — *Under the hood, top row*

**[Point at the three cards.]**

> "Three kinds of contract, and only one has new logic.
> The **orbit-dao.eth registry** is stock `PermissionedRegistry`. It holds the name `protocol` and one ordinary grant: core-devs can edit on protocol. Above it, your .eth registry holds the security council's grant on orbit-dao itself. That's sharing a folder with a group, twice.
> **CascadeSubregistryV2** is protocol's registry: the files `vault`, `oracle`, `bridge`, its teams, and how many folders up sharing flows.
> **The teams** are plain EAC: one `MEMBER` bit per account. The security council is a `NestedTeam`: a member is anyone in it or in a team inside it. Joining is one ordinary `grantRoles` on the team."

### 3. What happens on a write — *the six steps*

**[Point at the numbered path; steps 3–5 are highlighted.]**

> "Alex calls your stock `setSubregistry`. Your code checks the name exists and hasn't expired, then runs `_checkRoles`.
>
> The important part: **Cascade doesn't add a check — it changes the answer.** There's still exactly one check, yours. Cascade looks at Alex's own roles first — an owner stops right there, no outside calls. Then one folder at a time: does the folder point back down, what does it grant each team, and only if that grant could help, is Alex a member. The moment the role is covered, it stops."

### 4. How the override reaches your code — *the inheritance column*

**[Point at EAC → PermissionedRegistry → CascadeSubregistryV2.]**

> "Both functions are virtual. EAC defines them, `PermissionedRegistry` already overrides `_getRoles` for approved operators, and Cascade overrides them once more. Because they're virtual, every call from inside your unmodified code runs Cascade's version, which runs yours first. Views use `_getRoles`, which computes the full answer; writes use the lazy `_checkRoles`. Because inheritance only ever adds roles, the two always agree — we fuzz that, and proved it with a symbolic checker."

### 5. Why it's safe — say these unprompted

> "Five properties.
> **One:** admin bits are masked off, so members can use a role but never grant it.
> **Two:** nothing is inherited at `ROOT_RESOURCE`, so registry-wide powers — registering, upgrading, adding a team, changing the depth — are never inherited. That's why the attack you saw fails.
> **Three:** each folder counts only if the one above points back down to it, so a registry can't adopt a parent that doesn't claim it.
> **Four:** every outside call is a STATICCALL with a gas cap and a bounded, length-checked return — a broken or hostile team or parent means *no* inherited roles, never extra ones, and the name's owner is never locked out.
> **Five:** grants are read against each folder's *current* registration, so re-issuing or letting a name above expire ends its teams' authority automatically, like any native grant."

### 6. The trade-offs — say them before they're found

> "It's union only: a name can't opt out of a grant from above, same as Google shared drives. Members pay more with each team and level — about 98k gas for a level-one write on Sepolia, 138k two levels up through the nested team; owners pay nothing extra. Views pay the full lookup, because `hasRoles` isn't virtual. `hasRoles` reports true for a member on an unregistered label, where writes still revert. Inherited roles emit no events, so an indexer should call `hasRoles`. And a team contract also holds its role in the folder's registry, so team contracts should be narrow."

### 7. Hand it back

> "That's the whole mechanism: the lookup overridden, read-only calls up the tree, and every fact must hold — the folder's grant, the link back down, and membership. Cut any one and access ends. Where would you push on it?"

---

## Follow-up questions and answers

| They ask | You say |
|---|---|
| **Why `_getRoles` and a lazy `_checkRoles`?** | "`_getRoles` feeds writes *and* the public views, so what the chain reports matches what it enforces — our first version overrode only `_checkRoles` and views disagreed, so we moved it. After your feedback on gas, `_checkRoles` got a lazy version that knows which role it needs and stops early. Same yes/no by monotonicity, checked by a fuzz test and a Halmos proof." |
| **Why pointers to teams instead of finding the holder?** | "EAC exposes how many hold a role, not who. So the registry names its candidate teams and reads the folders' grants to them live. The grants are the authority; a pointer alone grants nothing." |
| **How does it find the folder above?** | "Your stock `getParent`. But a registry can claim any parent, so each level must also point back down: the parent's `getSubregistry(label)` has to return the child. Otherwise that level and everything above it count for nothing." |
| **What stops someone adding their own team?** | "`addTeam` needs our own root role, `ROLE_SET_TEAM`; the target must be a contract declaring the team interface via ERC-165; every change emits `TeamAdded`. And a team only gets what a folder above grants it — a new team with no grant gets nothing." |
| **Can a hostile team contract grief the registry?** | "No — it's read with a STATICCALL, capped at 100k gas, and a short or garbled reply counts as 'not a member'. We found this the hard way: `try/catch` doesn't catch undecodable returns, so a 1-byte reply would have reverted every check. The test for it is in the suite." |
| **Reentrancy?** | "Every outside call happens in view context, so they're STATICCALLs — the callee can't change any state — and all checks run before the write." |
| **What about a name above being transferred?** | "A transfer keeps third-party grants in stock ENSv2 — for every delegate, not just us. The new owner can revoke the team in one call. Re-issue or expiry, on the other hand, ends it automatically." |
| **How is this tested?** | "71 Foundry tests: unit tests with the same shape as Sepolia, fake teams and parents that lie, loop forever, or return garbage; re-issue, expiry, transfer, approvals, the 15-member cap; invariants that run random action sequences and check the rule after every step, including one that v2 at depth one behaves exactly like v1. Plus 3 Halmos proofs for all inputs. We checked the suite catches bugs by breaking the ROOT guard and the admin mask on purpose — both fail it. Not audited." |
| **Is it ReBAC or just group RBAC?** | "It's one relationship rule applied along the name tree: a name inherits what a folder above grants a team, for the team's members, and teams can contain teams. That's Zanzibar's parent-inheritance and group-nesting shape, bounded to three levels, inside EAC. Not a general engine." |
| **Is the trace real?** | "Yes — `cast run` re-executes the mined transaction and prints the EVM's call tree. It only works for fresh transactions because free RPCs prune old state." |
| **Why is there a One folder tab?** | "That's the first version: one parent, one team, `_getRoles` only. It's still live, and the cascade is the same idea generalised." |

---

## Words to avoid

- "Cascade adds a second check" — it doesn't; it changes the answer to the one check.
- "Zanzibar for ENS" without "bounded" and "one rule".
- "No changes to EAC" — say "no changes to EAC's storage or grant rules; views now include inherited roles."
- "Audited" or "production" — it's on the ENSv2 beta, not audited.
