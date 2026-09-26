# Rehearsed answers

Say these as written. Each has been checked against the code or a test; the source is named after each answer.

## "Why not just grant the team a role on `ROOT_RESOURCE`?"

Root grants genuinely solve future subnames within one registry, no argument there. What they don't solve is a team that spans several registries: without Cascade that's a separate root grant per person per registry, so a team of five across three registries is fifteen grants, and every join or leave has to touch all three. With Cascade, membership lives once in `TeamRegistry`, every registry that grants the team a role reads from that same roster, and a join or leave is one transaction however many registries there are. It also separates who manages the team from who administers each namespace.

*Source: the cost aside printed by `npm run demo` (5 people, 3 registries: 15 root grants vs 5 memberships + 3 parent grants).*

## "What if `TeamRegistry` is compromised or misconfigured?"

A compromised team admin can add any address as a member, and that address gets exactly the regular roles the parent granted the team — here `SET_SUBREGISTRY` on subnames of `devops` — and nothing else: it cannot register or unregister names, change resolvers, grant or revoke roles, or touch `devops` itself; and the owner of `devops` can shut the whole path off with one transaction by revoking the parent's grant to the team.

Supporting detail, if asked:

- **What a rogue member can actually do:** repoint the subregistry of any existing `*.devops.acme-corp.eth` name, which means controlling whatever sits beneath that subname. That is the real blast radius, bounded by the roles the parent chose to grant. *(Tests: `test_onlyTheRoleTheTeamHolds`, `test_memberCannotRegisterOrGrant`, `test_adminBitsOnParentAreNotInherited`, `test_rootNeverFallsThrough`.)*
- **Containment:** revoking the parent grant closes the fallthrough for every member at once. *(Test: `test_parentTransferKeepsGrant_likeAnyNativeDelegate` ends with exactly this.)*
- **Redirecting the pointer:** needs `ROLE_SET_TEAM` on root (demo step 6), must be a contract (step 7) declaring `ITeam` via ERC-165, and emits `TeamPointerUpdated(old, new, by)`. A contract can lie about ERC-165, so the `ROLE_SET_TEAM` holder is the real safeguard — a stated trust assumption, the same one you make of any namespace admin.
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

## "Is this a shared resolver?"

No. This governs `ROLE_SET_SUBREGISTRY`, a registry-level action — creating and repointing subnames — not resolver records. A shared resolver grant couldn't give anyone the ability to manage subnames.

## "Is this a tokenized subname?"

No. The subname's ERC1155 token never moves. Joining or leaving the team is a role write on `TeamRegistry`, not a transfer of anything.

## "Is the demo output live or canned?"

Live. Every write in `npm run demo` is a mined Sepolia transaction with an Etherscan link, including every one that reverts; revert reasons are decoded from a simulation, not printed from a script. The per-check lines are real reads pinned to the write's block. `npm run demo -- --recap` is the only replay, and it says so in its header along with the time of the run it replays.
