# ENS team feedback

First-hand notes from pitches to the ENS team. Their words as relayed, then what we take from them. Nothing here changes the roadmap by itself.

## Pitch 2 — 2026-09-26

**What they said (as relayed by the presenter):**

- They liked the idea and found it interesting.
- They want to see **how it actually happens behind the scenes** — a complete, smart-contract-level technical architecture.
- They said **the current MVP is itself a really great implementation** of the theory.
- They want the **UI to be very simple**, explaining the project very clearly and **what it actually solves in the ENS space**.

**What we take from it:**

- The MVP scope (one hop, one team per registry) stands on its own; the roadmap stays as is for now.
- The next deliverable is legibility, not features: a contract-level view of what happens on each action, and a simpler UI centred on the problem in ENS and the fix.

**Open:** the four questions from the Ask section (holder discovery, `_getRoles` as the hook, value over root grants, narrow team contracts) and the agent-fleet question were not reported as answered in this pitch.

## Developer feedback on ENSv2 (from building ENS Drive)

First-hand friction from building on the ENSv2 beta this weekend, each with where we hit it and a concrete suggestion.

1. **EAC exposes role holder counts, not identities.** `roleCount` / `getAssigneeCount` say how many accounts hold a role on a resource, but nothing says which. A contract that wants to act on "whoever holds this role on the parent" can't. *Where:* `EnhancedAccessControl` in `contracts-v2@48b3e2d`; our workaround is a stored team pointer (decision 1). *Suggestion:* either an optional enumerable-holders extension, or a documented pattern for "delegate a role to a contract and let it vouch for members".
2. **`_getRoles` is the right hook, but its stability isn't stated.** The source comments describe it as the place to add role logic, and `PermissionedRegistry` overrides it for approved operators — but it's `internal`, and nothing says whether registries built on it will keep working across ENSv2 releases. *Where:* our only override. *Suggestion:* state which internal hooks are a supported extension surface.
3. **Two ID conventions inside one call path.** Public `hasRoles` / `roles` / `grantRoles` on `PermissionedRegistry` take an *anyId* (label hash or token ID) and convert it, while internal `_checkRoles` / `_getRoles` receive a *resource*. Easy to mix up when subclassing. *Suggestion:* one paragraph in the contract-developer guide on anyId vs token ID vs resource.
4. **Token IDs change on every grant or revoke.** Granting our team a role on `devops` regenerated `devops`'s token ID (`TokenRegenerated`), while EAC resources only change on unregister/expiry. It's a deliberate buyer protection, but surprising for integrators who store token IDs. *Suggestion:* call it out in the registry docs next to the resource/version explanation.
5. **Admin bits can only be given to a name at registration.** Later `grantRoles` on a name resource can only add regular roles (`_getSettableRoles` returns `>> 128`). We relied on it, but only found it by reading the source. *Suggestion:* document it with the role model.
6. **Which source commit matches the beta deployment wasn't obvious.** We pinned `contracts-v2@48b3e2d` and confirmed the match behaviourally (e.g. `LABEL_STORE()` answering on the deployed `UserRegistry`). *Suggestion:* publish the commit hash alongside the beta addresses.
7. **viem's built-in Universal Resolver address targets a different deployment** (carried over from the author's earlier ENSv2 project; still true here — `scripts/lib.ts` and the UI's server-side client override it). *Suggestion:* note the override in the beta docs.
