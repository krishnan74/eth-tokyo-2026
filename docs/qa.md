# Rehearsed answers

Say these as written. Each has been checked against the code or a test; the source is named after each answer. The live demo is the cascade version (`CascadeSubregistryV2` on `protocol.orbit-dao.eth`); answers about the pointer, `explain()` and demo step 8 are about the first, one-folder version (`CascadeSubregistry` on `devops.acme-corp.eth`), and say so.

## "Why not just grant the team a role on `ROOT_RESOURCE`?"

Root grants genuinely solve future subnames within one registry, no argument there. What they don't solve is a team that spans several registries: without Cascade that's a separate root grant per person per registry, so a team of five across three registries is fifteen grants, and every join or leave has to touch all three. With Cascade, membership lives once in `TeamRegistry`, every registry that grants the team a role reads from that same roster, and a join or leave is one transaction however many registries there are. It also separates who manages the team from who administers each namespace. And root grants stop at one registry: in the cascade demo the security council is shared on `orbit-dao.eth`, two registries above the files, which no root grant in `protocol`'s registry can express.

*Source: the cost aside printed by `npm run demo` (5 people, 3 registries: 15 root grants vs 5 memberships + 3 parent grants).*

## "What if a team contract is compromised or misconfigured?"

A compromised team admin can add any address as a member, and that address gets exactly the regular roles the names above granted the team — in the one-folder demo, `SET_SUBREGISTRY` on subnames of `devops` — and nothing else: it cannot register or unregister names, change resolvers, grant or revoke roles, or touch `devops` itself; and the owner of `devops` can shut the whole path off with one transaction by revoking the parent's grant to the team.

Supporting detail, if asked:

- **What a rogue member can actually do:** repoint the subregistry of any existing `*.devops.acme-corp.eth` name, which means controlling whatever sits beneath that subname. That is the real blast radius, bounded by the roles the parent chose to grant. *(Tests: `test_onlyTheRoleTheTeamHolds`, `test_memberCannotRegisterOrGrant`, `test_adminBitsOnParentAreNotInherited`, `test_rootNeverFallsThrough`.)*
- **Containment:** revoking the parent grant closes the fallthrough for every member at once. *(Test: `test_parentTransferKeepsGrant_likeAnyNativeDelegate` ends with exactly this.)*
- **Redirecting the pointer (v1) or adding a team (v2):** needs `ROLE_SET_TEAM` on root (demo step 6; the cascade demo's attack), must be a contract (step 7) declaring `ITeam` via ERC-165, and emits an event (`TeamPointerUpdated`, `TeamAdded`). A contract can lie about ERC-165, so the `ROLE_SET_TEAM` holder is the real safeguard — a stated trust assumption, the same one you make of any namespace admin.
- **A broken team contract:** reverts, infinite loops, and malformed return data all fail closed, and native owners keep writing normally. *(Test: `test_badTeamFailsClosed_nativeOwnerUnaffected`.)*
- **The admin set itself** is ordinary EAC: capped at 15 per role, every change emits `EACRolesChanged`, so it is auditable. It is not frozen — an admin can grant the admin role to others.
- **One more thing to volunteer:** `TeamRegistry` also holds `SET_SUBREGISTRY` on `devops` itself in the parent. The deployed `TeamRegistry` has no function that could use it; a different team contract that could make arbitrary calls would be able to repoint the whole namespace. So the team contract should be a narrow one.

## "Does `explain()` prove the write path agrees, or is it a separate check?"

`explain().allowed` is `hasRoles()`, which reads the same `_getRoles` hook the write path's `_checkRoles` reads, on the same resource — so they cannot drift, with one exception: the write path also rejects an expired name first, which `explain()` does not check. The per-check reads the demo animates are independent calls from the script (`nativeRoles`, `parent.roles`, `team.isMember`); their agreement with `explain()` is observed on each run, not guaranteed by construction.

*Source: `CascadeSubregistry.explain` → `hasRoles(anyId, …)` → `_getRoles`; `PermissionedRegistry.getResource(anyId) = _constructResource(anyId, _entry(anyId))`, the same resource `_checkExpiryAndTokenRoles` passes to `_checkRoles`.*

## "Does the team pointer survive the parent name changing hands? (Mutable Token IDs)"

The pointer grants nothing by itself; the authority is the parent's grant to the team, read live from the parent's current EAC resource. Unregistering, expiry, or re-registration of `devops` changes that resource, so the team's grant stops applying exactly as every native grant does — demo step 8 shows it: same pointer, same member, write reverts. Token IDs regenerating on grant/revoke doesn't change the resource, and a transfer keeps third-party grants in place for every delegate in stock ENSv2, not just this one; the new owner can revoke the team in one call.

*Source: demo step 8; tests `test_parentReissueInvalidatesTeamGrant`, `test_parentExpiryInvalidatesTeamGrant`, `test_parentTransferKeepsGrant_likeAnyNativeDelegate`; `PermissionedRegistry._update` (transfer moves only the owner's roles) and `_regenerate` (bumps `tokenVersionId`, not `eacVersionId`).*

## "Can't EAC tell you who holds a role?"

It tells you how many, not who: `roleCount` and `getAssigneeCount` expose holder counts; there is no call that returns holder identities. That is why the registry names its candidate with a `team` pointer instead of discovering it.

## "What exactly does the team get access to? Text records?"

No — registry permissions, not records. The team inherits **registry roles on each subname's entry**: `SET_SUBREGISTRY` (where the name's children live — the demo's "Edit" is `setSubregistry`), and in the cascade demo also `SET_RESOLVER` for the security council (which resolver the name uses). Text and address records live in a resolver behind the resolver's own roles, keyed by `(namehash, record part)`; per-record rights are a separate mechanism on the roadmap. The one overlap: whoever can set the resolver can point the name at a resolver they control. *Source: `CascadeSubregistryV2._getRoles`, the demo's `setSubregistry` / `setResolver` writes; `PermissionedResolver` in contracts-v2.*

## "Is this a shared resolver?"

No. This governs registry-level roles — `ROLE_SET_SUBREGISTRY` (repointing where a subname's children live) and, in the cascade demo, `ROLE_SET_RESOLVER` (choosing a name's resolver) — not resolver records. A shared resolver grant couldn't give anyone the ability to manage subnames.

## "Is this a tokenized subname?"

No. The subname's ERC1155 token never moves. Joining or leaving a team is a role write on the team contract, not a transfer of anything.

## "Is the demo output live or canned?"

Live. Every click on https://ens-drive.vercel.app and every write in `npm run demo` / `npm run smoke:v2` is a mined Sepolia transaction with an Etherscan link, including every one that reverts. The drive's state is read from the contracts every few seconds; the drag moves Alex's chip before the transaction lands (optimistic), but the files only flip to "can edit" once the receipt and a fresh read confirm it. The "On-chain, just now" card and Behind the scenes are a `cast run` replay of the mined transaction. `npm run demo -- --recap` is the only replay of old output, and it says so in its header along with the time of the run it replays.

## "How far up does it look, and can a registry just claim any parent?"

Up to `depth` levels (1–3, set by the registry's `ROLE_SET_TEAM` holder), through stock `getParent`. A claim isn't enough: each level counts only if that parent's `getSubregistry(label)` points back down to the registry below it, so a registry that names a parent that doesn't claim it inherits nothing from it or anything above. A hostile or broken ancestor fails closed.

*Source: `test_multiHop_brokenLinkStopsTheWalk`, `test_multiHop_lyingParentPointerIgnored`, `testFuzz_hostileAncestorFailsClosed`; Halmos `check_v2_brokenLinkContributesNothing`.*

## "Doesn't every write now pay for all those lookups?"

Owners don't: the write check looks at the caller's own roles first and stops there (36,971 gas on Sepolia). Members pay only for what can change the answer: one folder at a time, a team is asked about membership only if its grant covers a role still missing, and the walk stops when the role is covered. A member's write through one level went from 165,723 to 97,665 gas on Sepolia; through two levels and the nested team, 138,289. Views (`hasRoles`) still compute the full answer, because `hasRoles` isn't virtual in `PermissionedRegistry`; that is one of our questions for ENS.

*Source: `test_fastPath_nativeOwnerWriteMakesNoLookups`, `test_pruning_irrelevantTeamNotAsked`, `test_pruning_level2NotWalkedWhenLevel1Covers`; Sepolia numbers in `roadmap-v2.md` §6.*

## "How do you know the lazy check gives the same answer as the full one?"

Inheritance only ever adds roles, so skipping a path that can't add a missing role can't change the yes/no. That's checked three ways: a differential fuzz test (lazy write vs full `hasRoles`, random grants, memberships and requested roles), the write-vs-view invariant, and a Halmos proof for all inputs with two teams and two levels.

*Source: `testFuzz_lazyCheckMatchesFullUnion`, `invariant_viewsAgreeWithWrites`, Halmos `check_v2_lazyEqualsFullUnion`.*

## "Is it tested for every access-control case?"

71 Foundry tests and 3 Halmos proofs: the rule itself, admin bits and root never inherited, members never administering or transferring, approvals (an operator of a member gets nothing), expiry of the name and of the parent, re-issue and transfer, the 15-member cap, hostile teams and ancestors, gas bounds, and an invariant that v2 at depth 1 behaves exactly like v1. Not audited, and we say so.

*Source: `contracts/test/` — `CascadeGaps.t.sol` for the gaps the ENS team raised; `feedback/ens-pitch-3.md`.*
