# ENS Drive contracts, explained (Cascade)

> **Naming:** *ENS Drive* is the product; *Cascade* is its permission layer — the `CascadeSubregistry` / `CascadeSubregistryV2` contracts and the ReBAC rule they implement. Contract and code names stay `Cascade…`, matching the Sepolia deployment.

How the contracts are structured, how a call flows through them, what state they hold, how they were deployed and wired, and the technical details worth knowing before anyone asks. Everything here matches the code in `contracts/src/` and the Sepolia books in `deployments/`.

**Two versions, both live.** §2–9 explain the first, one-folder version (`CascadeSubregistry`, `deployments/sepolia.json`) in full, because every idea in the cascade starts there. §10 covers what the cascade version (`CascadeSubregistryV2`, the live demo's default, `deployments/sepolia-orbit.json`) adds; the call-by-call path of a two-level write is in [`architecture.md` §7](architecture.md#7-the-cascade-version--cascadesubregistryv2-the-live-demo) and everything else in [`roadmap-v2.md`](roadmap-v2.md).

---

## 1. Files and what each one is

| File | What it is | New or stock |
|---|---|---|
| `contracts/src/CascadeSubregistryV2.sol` | The cascade: up to 4 teams, inheritance up to 3 levels with a link check at each, a lazy role-aware write check. The live demo, on `protocol.orbit-dao.eth`. | **New — the contribution** |
| `contracts/src/CascadeSubregistry.sol` | The first version: the one-hop inheritance rule (one parent, one team). The One folder tab, on `devops.acme-corp.eth`. | New |
| `contracts/src/TeamRegistry.sol` | The team roster: a plain EAC contract with an `isMember` view. | New, thin |
| `contracts/src/ITeam.sol` | The one-function interface Cascade calls on a team: `isMember(address) → bool`. | New |
| `contracts/src/demo/AlwaysTrueTeam.sol` | Demo fixture: an attacker's team that says everyone is a member. Used only to show the hijack being refused. | Fixture, not product |
| `lib/contracts-v2/.../PermissionedRegistry.sol` | ENS's standard registry. Cascade inherits it; the org registry *is* it. | Stock ENSv2 |
| `lib/contracts-v2/.../EnhancedAccessControl.sol` | ENS's permission system (EAC). | Stock ENSv2 |
| `contracts/src/teams/NestedTeam.sol` | Teams of teams: a roster that includes up to 4 sub-teams, 3 levels deep. The demo's security-council. | New |
| `contracts/src/teams/HatsTeam.sol`, `SafeTeam.sol` | Hat wearers / Safe owners as a team, behind `isMember`. Fork-tested against the real Hats v1 and Safe 1.4.1; not deployed. | New |
| `contracts/test/Cascade.t.sol` | 17 v1 unit tests, plus test-only helper contracts. | New |
| `contracts/test/CascadeInvariant.t.sol` | The v1 rule as invariants over random action sequences, plus 5 fuzz tests. | New |
| `contracts/test/CascadeV2.t.sol` | 18 v2 tests, 9 team tests, the lazy-check differential fuzz and pruning tests, and invariants over teams × levels. | New |
| `contracts/test/CascadeGaps.t.sol` | The gaps the ENS team raised: approvals, expiry, the 15-member cap, members never administering, and a v1/v2 equivalence invariant. | New |
| `contracts/test/CascadeV2Gas.t.sol`, `RosterFork.t.sol`, `CascadeSymbolic.t.sol` | Gas benchmark; Hats/Safe fork tests (opt-in, `npm run test:fork`); 3 Halmos proofs (`npm run prove`). | New |

All ENS code comes from the `ensdomains/contracts-v2` repository pinned at commit `48b3e2d`, the source that matches the ENSv2 beta deployment on Sepolia.

---

## 2. Inheritance

```
EnhancedAccessControl  (stock: roles, grants, _getRoles hook, _checkRoles)
ERC1155Singleton       (stock: each name is a one-owner token)
        │
PermissionedRegistry   (stock: names, expiry, subregistry, resolver; overrides _getRoles for approved operators)
        │
CascadeSubregistry     (new: overrides _getRoles once more, adds team pointer, explain, nativeRoles)

EnhancedAccessControl, ITeam
        │
TeamRegistry           (new: MEMBER role on one resource, isMember view, ERC-165)
```

Cascade does **not** modify any ENS source file. It is a subclass. The org registry for `acme-corp.eth` is a stock `PermissionedRegistry`, deployed as-is.

---

## 3. `CascadeSubregistry` in detail

### State it adds

| Item | Type | Purpose |
|---|---|---|
| `team` | `address` (storage) | The team contract whose members may inherit the parent's grant. |
| `ROLE_SET_TEAM` | constant, `1 << 40` | Root role required to change `team`. Nybble 10, unused by ENS's own roles. |
| `ROLE_SET_TEAM_ADMIN` | constant, `ROLE_SET_TEAM << 128` | Admin of that role. |
| `PARENT_CALL_GAS` | constant, `50_000` | Gas cap for the call to the parent registry. |
| `MEMBER_CALL_GAS` | constant, `30_000` | Gas cap for the call to the team contract. |
| `REGULAR_ROLES` | constant, `type(uint128).max` | Mask that keeps only the lower (regular-role) half of a bitmap. |

It also relies on two things the stock registry already stores: `_parentRegistry` and `_childLabel`, set with the stock `setParent(parent, label)`. For our deployment they are the org registry and `"devops"`.

### Events and errors it adds

- `event TeamPointerUpdated(address indexed oldTeam, address indexed newTeam, address indexed changedBy)`
- `error TeamNotContract(address team)`
- `error TeamInterfaceUnsupported(address team)`

### Functions

**`constructor(ILabelStore labelStore, address rootAccount, uint256 roleBitmap)`**

Passes straight through to `PermissionedRegistry`. `labelStore` is ENS's shared label database on Sepolia (`0xD735…E855`). `rootAccount` receives `roleBitmap` on the root resource. We deployed it with the operator and `ALL_ROLES`, so the operator holds every root role, including `ROLE_SET_TEAM`.

**`setTeam(address newTeam)` — external, `onlyRootRoles(ROLE_SET_TEAM)`**

1. Reverts `TeamNotContract` if `newTeam` has no code.
2. Reverts `TeamInterfaceUnsupported` unless `newTeam` declares `ITeam` through ERC-165 (checked with OpenZeppelin's `ERC165Checker`).
3. Emits `TeamPointerUpdated(old, new, msg.sender)`, then stores `newTeam`.

**`_getRoles(uint256 resource, address account)` — internal view, override (the mechanism)**

```solidity
roleBitmap = super._getRoles(resource, account);          // stock EAC, incl. approved operators
if (resource == ROOT_RESOURCE) return roleBitmap;         // root is never inherited
uint256 granted = _teamGrant();                           // parent's grant to the team, regular bits only
if (granted != 0 && _isMember(account)) roleBitmap |= granted;
```

The team's membership is only asked about if the parent actually grants the team something.

**`_teamGrant()` — internal view**

Returns `0` if there is no team, the parent has no code, or the parent is this contract (self-reference guard). Otherwise it makes a capped read-only call to `parent.roles(labelId("devops"), team)` and masks the result with `REGULAR_ROLES`, so admin bits never pass through.

**`_isMember(address account)` — internal view**

Capped read-only call to `team.isMember(account)`. Returns true only if the call succeeded and returned exactly `1`.

**`_staticUint(target, gasCap, data)` — private view**

Does `target.staticcall{gas: gasCap}(data)` and returns `(false, 0)` if the call failed **or returned fewer than 32 bytes**; otherwise decodes one word. This exists because Solidity's `try/catch` does *not* catch return data it cannot decode — a team returning 1 byte would otherwise have made every role check on the registry revert, including native owners'.

**`explain(uint256 anyId, uint256 roleBitmap, address account)` — external view**

Returns an `Explanation` struct:

| Field | Meaning |
|---|---|
| `native` | The account holds the role itself (on the name or root), nothing inherited. |
| `parent`, `label`, `team` | Which parent, label and team were consulted. |
| `parentGrantsTeam` | The parent grants the team this role (regular bits). |
| `member` | `team.isMember(account)` — reported as a fact even when the decision didn't need it. |
| `allowed` | `hasRoles(anyId, roleBitmap, account)`, which uses the same `_getRoles` hook as writes. |

`explain()` does **not** check expiry; the write path does (see §5).

**`nativeRoles(uint256 anyId, address account)` — external view**

The account's own roles on the name plus root, using `super._getRoles` so nothing is inherited. The drive UI shows it as "given directly" in the Who has access panel.

### What Cascade leaves untouched

`register`, `unregister`, `renew`, `setSubregistry`, `setResolver`, `grantRoles`, `revokeRoles`, token transfers, `_checkRoles`, and the rules for who can grant (`_getSettableRoles`) are all stock. They behave differently only because the roles they read now include inherited ones.

---

## 4. `TeamRegistry` in detail

- Inherits stock `EnhancedAccessControl` and implements `ITeam`.
- **`TEAM_RESOURCE = 1`** — members are granted on resource 1, because stock `grantRoles` refuses the root resource.
- **`ROLE_MEMBER = 1 << 0`**, **`ROLE_MEMBER_ADMIN = ROLE_MEMBER << 128`**.
- **Constructor `(address[] admins)`** grants each admin `ROLE_MEMBER_ADMIN` on root. Admins can add and remove members but are **not members themselves**. We deployed it with the operator as the only admin.
- **Adding a member** is the stock call `grantRoles(1, ROLE_MEMBER, account)`; **removing** is `revokeRoles(1, ROLE_MEMBER, account)`. Both emit EAC's own `EACRolesChanged` event.
- **`isMember(account)`** returns `hasRoles(1, ROLE_MEMBER, account)`.
- **`supportsInterface`** reports `type(ITeam).interfaceId`, which is what `setTeam` checks.
- Inherits EAC's cap of **15 holders per role**. Admins can grant the admin role to others (standard EAC), so the admin set is auditable but not frozen.

---

## 5. How a write flows through the contracts

The demo's write is the outsider calling `setSubregistry(svcTokenId, 0x…dEaD)` on `CascadeSubregistry`:

```
outsider ──setSubregistry(anyId, newRegistry)──▶ CascadeSubregistry (stock function)
  │
  ├─ _checkExpiryAndTokenRoles(anyId, ROLE_SET_SUBREGISTRY)          stock
  │    ├─ name expired or never registered? → revert LabelExpired
  │    └─ _checkRoles(resource, ROLE_SET_SUBREGISTRY, outsider)       stock EAC
  │         └─ hasRoles → _getRoles(ROOT) | _getRoles(resource)
  │                              │
  │                              └─ Cascade._getRoles(resource, outsider)   ◀── the only new logic
  │                                   ├─ stock roles on the name: none
  │                                   ├─ STATICCALL org registry.roles("devops", TeamRegistry)   (≤ 50k gas)
  │                                   │     → SET_SUBREGISTRY (the parent's grant to the team)
  │                                   └─ STATICCALL TeamRegistry.isMember(outsider)              (≤ 30k gas)
  │                                         → true  ⇒ add SET_SUBREGISTRY
  │         role present → continue          role missing → revert EACUnauthorizedAccountRoles
  └─ store the new subregistry, emit SubregistryUpdated                stock
```

Things to notice:

- **The expiry check runs first.** A write to an expired or never-registered name reverts with `LabelExpired` before any role logic.
- **Every check reads live.** Nothing about membership is cached or copied onto the name.
- **Both external calls are read-only.** They happen before any state change, and a STATICCALL cannot modify state, so a malicious team can't re-enter and change anything.

---

## 6. Where the authority actually lives

Three independent facts, each held by a different contract, must all be true for a member to act:

| Fact | Held by | Changed by |
|---|---|---|
| The parent grants the team `SET_SUBREGISTRY` on `devops` | org registry (stock) | `grantRoles` / `revokeRoles` on the org registry |
| The account is a member | `TeamRegistry` (stock EAC) | `grantRoles` / `revokeRoles` on the team |
| Cascade reads this team | `CascadeSubregistry.team` | `setTeam` (needs `ROLE_SET_TEAM`) |

Cutting any one of them removes access. The **parent's grant is the authority**: the pointer on its own confers nothing.

---

## 7. How it was deployed and wired (Sepolia, ENSv2 beta)

| # | Transaction | Result |
|---|---|---|
| 1 | Deploy `PermissionedRegistry(labelStore, operator, ALL_ROLES)` | The org registry for `acme-corp.eth`. |
| 2 | Deploy `CascadeSubregistry(labelStore, operator, ALL_ROLES)` and `TeamRegistry([operator])` | The two new contracts. |
| 3 | Commit–reveal on the beta `ETHRegistrar`: `acme-corp` with subregistry = org registry (paid in MockUSDC) | `acme-corp.eth` exists and points at the org registry. |
| 4 | Org registry: `register("devops", operator, cascade, 0x0, ALL_ROLES, +1 year)` | `devops.acme-corp.eth` exists; its children live in Cascade. |
| 5 | Org registry: `grantRoles(labelId("devops"), SET_SUBREGISTRY, TeamRegistry)` | The parent's grant to the team. |
| 6 | Cascade: `setParent(orgRegistry, "devops")`, then `setTeam(TeamRegistry)` | Cascade knows its parent and its team. |
| 7 | Deploy `AlwaysTrueTeam` | Attacker fixture for the hijack step. |

During each demo, subnames are created with `cascade.register("svc-…", operator, 0x0, 0x0, RENEW, +30 days)`: the operator owns them with only the `RENEW` role, and **nobody is granted `SET_SUBREGISTRY` on them**.

**Redeploy history:** the first `CascadeSubregistry` (`0xa6e5…3b22`) overrode `_checkRoles` rather than `_getRoles`. `setup --redeploy` replaced it: `devops` was repointed with `setSubregistry` on the org registry, and the old team's grant was revoked. Retired addresses stay in `deployments/sepolia.json`.

| Current contract | Address |
|---|---|
| Org registry (`acme-corp.eth`) | `0xa27742aead8ca8baa8ff0a97754ac1736741e126` |
| `CascadeSubregistry` (`devops.acme-corp.eth`) | `0x2f15c12d21d7561433ddc6f7b856e9f0e4455e13` |
| `TeamRegistry` | `0x11ddfcb62670f0608d7cbc5b61e4470e0c7472bb` |
| `AlwaysTrueTeam` (fixture) | `0xaa735fc88e25f7d846010469ee75f287c8ec20c1` |
| Operator | `0xDcbe075a907960951Cd4df379BB21461097eEa91` |
| Outsider | `0xF4ff37B96BF5474F8d2F58ABfB9F61F5A9629Fa8` |

---

## 8. Technical details worth knowing

### ENS internals that shape the design

- **Resources vs token IDs.** A name has a **token ID** (its ERC-1155 id) and a **resource** (what EAC permissions attach to). Both are the label hash with a version number mixed in. The token version (`tokenVersionId`) bumps on every grant or revoke, so a name's token ID changes — this protects buyers of names. The resource version (`eacVersionId`) bumps on unregister, so all permissions on a name reset when it's re-issued.
- **An expired name's resource moves on by one version.** That's why a lapsed or re-issued `devops` automatically drops the team's grant: Cascade reads `roles` against the parent's *current* resource.
- **Granting a role on a name regenerates its token ID.** Step 5 of the setup (granting the team on `devops`) bumped `devops`'s token ID. Harmless, but visible on-chain.
- **`anyId`.** Stock registry functions accept either a label hash or a token ID ("anyId") and convert internally with `getResource` / `getTokenId`.
- **Names only get admin role bits at registration.** Granting on a name later can only add regular roles, because the stock `_getSettableRoles` returns `roles >> 128` for non-root resources. So the parent could never hand the team an admin role on `devops` after the fact — and even if it had one from registration, Cascade masks admin bits anyway.
- **Resolver permissions are a separate world**, keyed by record key rather than by name. Cascade only touches registry roles.

### Behaviours of the mechanism you should be able to explain

- **Views agree with writes.** `hasRoles()` and `roles()` include inherited roles. This is what makes `explain().allowed` and the UI's "effective" row trustworthy.
- **Views say yes on names that don't exist.** For a member, `hasRoles()` returns true on any label under `devops`, even an unregistered one, because the unregistered label still maps to a non-root resource. Writes to such names are still refused (`LabelExpired`), so this affects views only. The UI only ever asks about registered names.
- **Inherited roles emit no events.** Grants to the team and memberships emit stock EAC events on their own contracts, but nothing is emitted on Cascade when a member "gains" a role. Indexers should call `hasRoles()`.
- **Everyone pays for the hook.** Any role lookup on a subname makes up to two external calls, even for native owners: about 2,300 gas extra per write (73,069 vs 75,382 gas in the local like-for-like test).
- **Gas caps and the 63/64 rule.** Each capped call forwards at most its cap. If the outer transaction has too little gas left, the call gets less and fails closed — access is denied rather than wrongly granted.
- **Transfers keep the team's grant.** A stock transfer of `devops` moves only the owner's own roles; third-party grants such as the team's stay. The new owner holds the admin roles and can revoke it.
- **The team's latent power.** `TeamRegistry` itself holds `SET_SUBREGISTRY` on `devops` in the org registry. It has no function that could exercise it, but a team contract that could make arbitrary calls would be able to repoint the whole namespace. Team contracts should be narrow.
- **Trust anchors.** The operator holds all root roles on both registries (as any namespace owner would), and the `ROLE_SET_TEAM` holder chooses which team is read. A contract can lie about ERC-165, so that holder is trusted.

### Build and tooling

- **Foundry** (`forge`), Solidity **0.8.26**, `evm_version = cancun`, optimizer 200 runs. Foundry is not on `PATH` by default: `export PATH="$HOME/.foundry/bin:$PATH"`.
- **Dependencies are git submodules** pinned to exact commits: `lib/contracts-v2` (`48b3e2d`), `lib/openzeppelin-contracts`, `lib/forge-std`.
- **Remappings:** `@ens/v2/` → `lib/contracts-v2/contracts/src/`, `@openzeppelin/contracts/` → `lib/openzeppelin-contracts/contracts/`.
- **Commands:** `forge build`, `npm test` (71 tests across all suites), `npm run prove` (3 Halmos proofs; needs `forge build --ast`), `npm run test:fork` (Hats/Safe on a fork), `npm run gen` (regenerates `core/cascade/generated.ts` — the ABIs and addresses the terminal demo and web UI share — after any contract change or redeploy).
- **Deployment and wiring** is `scripts/setup.ts` (v1) and `scripts/setup-v2.ts` (the cascade tree, `--tree orbit|acme`) in viem, not Forge scripts, because commit–reveal needs a 60-second wait between transactions.

---

## 9. The tests

`contracts/test/Cascade.t.sol` builds the same shape as Sepolia in a local EVM — a stock `PermissionedRegistry` as the org registry, `devops` pointing at a `CascadeSubregistry`, a `TeamRegistry` granted `SET_SUBREGISTRY` — using a no-op label store. Test-only helper contracts: `AlwaysTrueTeam` (lies about membership), `UndeclaredTeam` (has `isMember` but no ERC-165), `BadTeam` (reverts / loops forever / returns 1 byte), `OwnerTeam` (can own a name, to test masked admin bits).

| Area | Tests |
|---|---|
| Core sequence | deny → grant → allow → revoke → deny, with `explain()` checked at each step |
| Hook agreement | `hasRoles()` and `roles()` include inherited roles and drop them on leave |
| Scope | only the granted role is inherited; admin bits masked; root never inherited; members can't register or grant |
| Pointer | outsider can't `setTeam`; wallet rejected; contract without `ITeam` rejected; event carries old, new, sender |
| Robustness | reverting, looping and 1-byte teams fail closed while native owners keep working; gas cap bounds the call; self-parent doesn't recurse |
| Invalidation | parent re-issue and parent expiry end the grant; parent transfer keeps it, and the new owner can revoke |
| Gas | native vs inherited write, like for like |

Invariant and fuzz tests of the rule are in `CascadeInvariant.t.sol`. The cascade's tests are summarised in §10.

---

## 10. What the cascade version adds (`CascadeSubregistryV2`)

Same base (`PermissionedRegistry`), same guarantees as the one-folder version, and these differences:

| | `CascadeSubregistry` (v1) | `CascadeSubregistryV2` (the demo) |
|---|---|---|
| Teams | one `team` pointer, `setTeam` | up to 4 (`MAX_TEAMS`), `addTeam` / `removeTeam`, `teams()` |
| Levels | the parent only | `depth` 1–3 (`MAX_DEPTH`), `setDepth`; each level found with stock `getParent` |
| Link check | none needed (one parent, set by the owner) | each ancestor counts only if its `getSubregistry(label)` returns the child below |
| Overrides | `_getRoles` | `_getRoles` (full union: views) and `_checkRoles` (lazy: writes) |
| Write cost for owners | two outside calls | none: own roles checked first |
| Gas caps | `isMember` 30k, parent `roles` 50k | `isMember` 100k (room for a `NestedTeam`), parent `roles` and link checks 50k, `getParent` return ≤ 320 bytes |
| Guard role | `ROLE_SET_TEAM` for `setTeam` | `ROLE_SET_TEAM` for `addTeam`, `removeTeam`, `setDepth` |
| Events | `TeamPointerUpdated` | `TeamAdded`, `TeamRemoved`, `DepthUpdated` |
| Views | `explain()`, `nativeRoles()` | the same, plus `ancestry()` |

**The lazy check (`_checkRoles` → `_inheritsMissing`).** Own roles first; then, level by level, each team's grant at that level is added to what it had from the levels below; a team is asked about membership only if its grants cover a still-missing role, and a known non-member is skipped at later levels; stop as soon as nothing is missing. It gives the same yes/no as the full union because inheritance only adds roles.

**Teams.** `NestedTeam` is a roster whose `isMember` is also true for members of its sub-teams (up to 4, 3 levels; cycles end at the limit), asked through `isMemberWithin` with a gas-capped STATICCALL. `HatsTeam` answers `isWearerOfHat`, `SafeTeam` answers `isOwner`; neither needs a change in Cascade.

**Tests.** 18 v2 unit tests (many teams, remove team, guards, multi-hop, broken and lying links, re-issue and expiry at the top, fast path, worst-case gas), 9 team tests (nesting, cycles, broken sub-teams, Hats, Safe), the lazy-check differential fuzz and pruning tests, v2 invariants, the gap tests (`CascadeGaps.t.sol`), and the Halmos proofs `check_v1_rule`, `check_v2_lazyEqualsFullUnion`, `check_v2_brokenLinkContributesNothing`.
