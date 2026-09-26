# ENS team feedback — pitch 3 (2026-09-26)

The third pitch to the ENS team, on the roadmap work (`CascadeSubregistryV2`, branch `roadmap/full-rebac`). **Relayed from the presenter's memory after the conversation, not a transcript**; the presenter noted they may have missed parts of the context. The ENS team member framed both suggestions as ideas to discuss, not settled answers: "it might be a solution", but they hadn't thought it through yet. Everything under "what we infer" is our analysis, not theirs.

---

## 1. What was said (as relayed)

- They still like the idea and find it very interesting.
- The main discussion was about **the gas cost of v2**.
- **Suggestion A:** add "another union" to the permission check, so that recursive paths can be eliminated once part of the path has already settled the permission.
- **Suggestion B:** instead of extending `PermissionedRegistry` and adding a separate team contract (devops-team), could the team's permission just be a bitmap `R1 | R2 | … | RN`, kept as the devops team's permission for that resource?
  - The presenter answered that this works if everything is managed in a single registry, but fails when multiple registries are involved.
- **Question C:** does every subname need to be a token, or can it just be resolver data?
- **Question D:** have all possible tests and checks been done on the system's access control?

---

## 2. The gas problem being discussed (our records)

**Root cause.** ENSv2 answers every permission check through `_getRoles(resource, account)`, which asks "what are **all** this caller's roles here?" and is **not told which role is being checked**. So Cascade must compute the caller's full inherited role set on every check. In v1 that is two external reads (the parent's grant, one membership check). In v2 it grows with **teams × levels**:

1. The ancestor walk: a `getSubregistry` link check per level, plus `getParent` and a decode self-call for each level above the first.
2. Every team's grant at every level: `T × D` calls to `ancestor.roles(label, team)`.
3. Membership for each team whose grant would add any new bit — even bits unrelated to the check.
4. Nothing is cached; all of it repeats on every check.

Visible in the Sepolia trace of a level-2 `setResolver`: `DevTeam.isMember` is called although dev-team's grant (`SET_SUBREGISTRY`) can't help with `SET_RESOLVER`.

| Case | Gas | Where |
|---|---|---|
| v1 member write (one hop, one team) | 91,946 | Sepolia, whole tx |
| v2 member write via level 1 (dev-team) | 165,723 | Sepolia, whole tx |
| v2 member write via level 2 (security ⊃ sre) | 148,473 | Sepolia, whole tx |
| v2 owner write, 2 teams, depth 1 → 3, before the fast path | 89,355 → 133,017 | local, warm |
| v2 owner write with the native-first fast path, any depth | 40,293 | local, warm |
| Worst case, 4 hostile teams, depth 3 | ~553k per lookup (capped) | local |

**Already mitigated:** owners' writes (the native-first fast path in `_checkRoles`), and the worst case (per-call gas caps, at most 4 teams × 3 levels).

**Still open:** members pay the full walk; views (`hasRoles`, `roles`) pay in full because they aren't `virtual` in `PermissionedRegistry`; nothing is cached.

---

## 3. Suggestion A — "another union" to eliminate paths already settled

**Our reading.** Permission is a **union**: native ∪ (team A, level 1) ∪ (team B, level 2) ∪ … . A union only adds, so once the roles gathered so far **cover the role being checked**, every remaining path can be skipped. This generalises the existing owner fast path to every step of the evaluation. It is also how Google's Zanzibar evaluates a union rewrite: it returns on the first positive branch.

**Assessment: sound, and it targets the root cause.** `_getRoles` doesn't know the requested role, but `_checkRoles(resource, roleBitmap, account)` does and is overridable (the fast path already lives there). The check can move there and evaluate lazily, cheapest first:

1. **Native roles** — stop if they cover the check (today's fast path).
2. **Level 1** — walk one level and read each team's grant. **Ask about membership only for teams whose grant includes a still-missing role.** This alone removes the wasted `DevTeam.isMember` call above.
3. **Stop as soon as the role is covered**; walk to level 2 only if still needed.
4. **Optionally, memoise within a transaction** with transient storage (EIP-1153; the build already targets `cancun`): the ancestor walk and membership answers computed once per transaction, not once per check.

**Limits to state upfront:**

- It speeds up **"yes"**. A **denied** check must still rule out every path, so the worst case is unchanged — though role-aware pruning still avoids the expensive membership calls (nested teams, Hats) for teams that can't help.
- **Views still pay in full**, because `hasRoles` can't be overridden. Off-chain reads are free; on-chain callers of views are not.
- **Correctness:** because the union is monotone, stopping early returns the same yes/no as the full computation, so views still agree with writes. The existing invariant (write outcome == `hasRoles`) checks exactly this.

**Expected effect (a guess until measured):** a level-1 member write should move toward v1's cost, since it would skip the level-2 walk and every unrelated team.

---

## 4. Suggestion B — the team's permission as a bitmap `R1 | … | RN`

**Our reading.** The *permission* half already works this way: the parent's grant to the team contract, `parent.roles(devops, TeamRegistry)`, **is** a bitmap `R1 | … | RN`. What the suggestion changes is **where membership lives**: as a "group" role bit inside the registry's own EAC table (for example `DEVOPS_MEMBER`, mapped to `R1 | … | RN`), instead of in a separate team contract.

**Is the presenter's answer right? Mostly yes, with one nuance.**

- **Within one registry it works, and it is cheaper.** Membership would be a role bit; the lookup would be local storage reads with no external calls; ENSv2's own admin bits would govern who may add members. Limits: **at most 15 members** (ENSv2 stores holder counts in 4 bits per role), only about 20 free regular role slots per registry, and mapping a group bit to a bitmap still needs a hook, which is Cascade's job anyway.
- **Across registries it breaks down, for a structural reason.** In ENSv2 every name has its own registry, so a single registry only ever covers **one level** of names. Any folder tree deeper than one level spans several registries, each with its own separate EAC table. A group bit in one registry means nothing in another, so the options are:
  - **Copy membership into every registry** — N writes per join, the per-name bookkeeping ENS Drive exists to remove; or
  - **Read a shared roster and the parent's grants across contracts** — external calls again, which is exactly what Cascade does.
- **The nuance:** it doesn't simply "fail"; it degrades to one of those two. The bitmap idea is equivalent to Cascade's one-hop case with membership stored locally; it can't express multi-hop names or one team shared across folders without copying or cross-contract reads.

**Worth raising with ENS:** a **hybrid** — keep the shared team contract for anything that spans registries, and let a registry store frequently used memberships locally as a fast path. Suggestion A with memoisation may make this unnecessary.

---

## 5. Question C — must every subname be a token, or can it be resolver data?

**Answer: not in ENS generally; for ENS Drive's current mechanism, yes.**

- **What ENSv2 allows.** A subname can be a **registry entry** (an ERC-1155 token, with owner, expiry, its own EAC resource and optionally its own subregistry — what ENS Drive uses), or **just resolver data**: `PermissionedResolver` supports wildcard resolution (`resolve(bytes,bytes)`), and the Universal Resolver falls back to the parent's resolver when a name has no registry entry. So `svc-api.devops.acme-corp.eth` can exist purely as records in the parent's resolver, with no token.
- **Why ENS Drive's files are tokens today.** The permissions Cascade inherits are **registry roles** (`SET_SUBREGISTRY`, `SET_RESOLVER`) on registry entries, so a file has to be an entry.
- **A resolver-only version.** Files would be record sets in a `PermissionedResolver`, and the permission would be "may write this name's addr/text/data records". The mechanism can port, because `PermissionedResolver` uses the same EAC with the same overridable hook. The difference: resolver permissions are keyed by **`(namehash, part)`**, and a namehash carries no link to its parent name. The resolver has a "specific name" scope and an "any name in this resolver" scope (`resource(0, part)`), but no parent scope. So the inheritance would be "a team gets record rights on every name this resolver serves", not "the parent's grant flows down" — this is roadmap step 5's "resolver records need a second mechanism".

| | Subname as token (today) | Subname as resolver data |
|---|---|---|
| Creating one | Mints a token (~165k gas for "+ New file") | Writes records only; much cheaper |
| Ownership, transfer, expiry | Yes | No — data inside the parent's resolver |
| Can nest further (own subregistry) | Yes | No |
| What Cascade inherits | Registry roles, from the parent's grant | Record roles, scoped per resolver, not per parent |

**Worth proposing:** tokens for **"folders"** (names that need owners or nesting) and resolver data for **"files"** (leaf records). That split may be what the question was pointing at, and it would cut the cost of creating files.

---

## 6. Question D — have all access-control tests and checks been done?

**Answer: no, and "every possible" can't honestly be claimed. What is covered, and the concrete gaps.**

**Covered:**

- **v1 (live demo):** 17 unit tests (the deny → grant → allow → revoke → deny sequence, views agreeing with writes, admin bits masked, nothing inherited at root, members unable to register or grant, the team-pointer guard, hostile teams that say yes to everyone, loop forever or return garbage, gas caps, parent re-issue/expiry/transfer); 5 fuzz tests (arbitrary team and parent return data, arbitrary role bitmaps); 5 invariants over random action sequences.
- **v2 (roadmap branch):** 18 unit tests (including a hostile-ancestor fuzz), 9 team tests, and an invariant over teams × levels against an independent model of the tree.
- **Mutation checks:** removing the ROOT guard, the admin mask or the link check makes the suites fail.
- **Live runs on Sepolia** of every demo path, including the refused attacks.

**Gaps:**

1. **Approved operators.** Stock ENSv2 lets an approved operator act with the name owner's roles; that path combined with inherited roles is untested (only one test touches transfers).
2. **Actions the random actors never try:** `setResolver`, `unregister`, `renew`, `revokeRoles`, transferring a subname, approvals. (Root-level actions are covered indirectly by "nothing inherited at root".)
3. **Subname expiry** isn't in the random runs (no time warps, no renewals); there is no test that a member can't act on an expired child.
4. **Roster limits:** no test for the 16th member hitting the 15-holder cap.
5. **v1 vs v2 equivalence:** no differential test that v2 with one team at depth 1 behaves exactly like v1 for every sequence.
6. **Real rosters:** the Hats and Safe adapters are tested against mocks only, not against the real Hats and Safe contracts (for example on a fork).
7. **Formal verification:** the rule is tested, not proven. A symbolic tool (Halmos, Certora) could prove "roles = native ∪ inherited, never admin or root" for all inputs.
8. **No external audit.**

Items 1–5 are about a day of test work; item 6 is fork tests; items 7–8 are separate efforts.

---

## 7. Questions to take back to the ENS team

1. **Suggestion A:** is short-circuiting inside `_checkRoles` (knowing the requested role) acceptable as the extension point, alongside `_getRoles`? Would ENS consider making `hasRoles` `virtual` so views can short-circuit too?
2. **Suggestion B:** did you mean membership stored as a group role bit inside one registry? If so, is the one-level limit acceptable for your use case, or is the multi-registry case the one that matters?
3. **Question C:** would "tokens for folders, resolver data for files" match what you had in mind? Is a resolver-scoped permission (every name this resolver serves) enough, or do you need parent-scoped record rights?
4. **Question D:** which gaps matter most to you — approvals, expiry, a v1/v2 equivalence proof, or formal verification?

---

## 8. Proposed next steps (not started; pending the presenter's decision)

- **Prototype Suggestion A** on `roadmap/full-rebac`: move v2's evaluation into `_checkRoles` with early exit and role-aware pruning, plus an optional per-transaction memo; extend the invariants to prove it matches the full computation; measure against today's v2 numbers (locally and on Sepolia).
- **Close test gaps 1–5**: widen the random actions, add time warps and approvals, the 15-member cap test, and a v1 vs v2 differential test.
- **Scope a resolver-data "files" variant** (roadmap step 5) only after ENS answers question 3.
