# ENS Drive — the whole project, explained

> **Naming:** *ENS Drive* is the product; *Cascade* is its permission layer — the `CascadeSubregistry` contract and the ReBAC rule it implements. Contract and code names stay `Cascade…`, matching the Sepolia deployment.

A complete technical walkthrough of Cascade for pitching it to the ENS team: the ENS concepts it builds on, the gap it fills, how the mechanism works line by line, what is deployed, how it is proven, and where it goes next. Each section ends with a line you can use when pitching.

---

## 1. The setting: ENS and ENSv2

**ENS** maps human-readable names (`alice.eth`) to addresses and records. Every name can have **subnames** (`api.alice.eth`), so a name is really a tree.

**ENSv2** (live in beta on Sepolia, the version we build on) rebuilt that tree:

- **Every name can have its own registry.** `.eth` has a registry; `acme-corp.eth` points to its own registry, which holds `devops`; `devops.acme-corp.eth` points to another registry, which holds `svc-…`. Resolving a name means walking registry → registry.
- **`PermissionedRegistry`** is ENS's standard registry contract. Each name in it is an **ERC-1155 token** (exactly one owner per token), with an expiry, a pointer to its **subregistry** (where its children live) and a **resolver** (where its records live).
- **The Universal Resolver** is the single entry point apps use to resolve any name by walking that chain of registries. Our names resolve through it.
- **Registering a `.eth` name** uses **commit–reveal**: commit a hash, wait 60 seconds, then reveal. This prevents front-running. On the beta deployment it is paid in a MockUSDC token. We registered `acme-corp.eth` this way.

> **Pitch line:** "ENSv2 gives every name its own registry. That is what makes a namespace something an organisation can actually run."

---

## 2. Enhanced Access Control (EAC): ENSv2's permission system

EAC decides **who may do what** in both registries and resolvers.

### Resources

Every permission is scoped to a **resource**, a `uint256` that identifies *what* is being controlled. In a registry, each name has a resource. There is also a special **`ROOT_RESOURCE` (0)**: a role granted at root applies to *every* name in that registry.

### Roles as a bitmap

An account's roles on a resource are stored as one 256-bit number:

- It is split into **4-bit slots** ("nybbles"). The **lower half holds regular roles**; the **upper half holds their admin roles**.
- Each role's admin is `role << 128`. Holding the admin role lets you **grant and revoke** that role.
- Each slot also tracks **how many accounts hold the role**, up to a maximum of **15**. This is why EAC can tell you *how many* holders a role has, but not *who* they are.

### The registry roles that matter here

| Role | What it allows |
|---|---|
| `SET_SUBREGISTRY` | Repoint a name's children. **This is the role the demo inherits.** |
| `SET_RESOLVER` | Change where a name's records live. |
| `RENEW`, `UNREGISTER` | Extend or end a registration. |
| `REGISTRAR` | Create names (root only). |
| `UPGRADE`, `SET_PARENT` | Upgrade the registry; set its parent link. |
| `CAN_TRANSFER_ADMIN` | Allow a name's token to be transferred. |
| **`ROLE_SET_TEAM`** | **Our addition**: change which team Cascade reads. |

### How a permission check works

1. A protected function (for example `setSubregistry`) calls **`_checkRoles`**.
2. `_checkRoles` asks **`hasRoles`**, which merges the caller's roles on **root** and on the **name**.
3. Both are read through one internal function: **`_getRoles(resource, account)`**.

### `_getRoles` is the extension point

EAC documents `_getRoles` as *the* place to add role logic at read time. The stock `PermissionedRegistry` already overrides it: if you approve an operator for your tokens, that operator gets your roles.

### Two permission worlds

- **Registry roles** govern a name's structure: its children, its resolver, its renewal.
- **Resolver roles** govern its records: addresses, text records.

They are separate systems. Cascade works in the **registry** world.

> **Pitch line:** "EAC is role-based access. It answers exactly one question: is this address listed with this role on this name?"

---

## 3. The gap: role-based vs relationship-based access

### Two models

- **RBAC (role-based access control):** permissions are attached to *identities* directly. EAC is RBAC: every entry is (name, address, role).
- **ReBAC (relationship-based access control):** permissions follow *relationships*. "You can edit this because you are a member of a team that can edit its parent."

### Zanzibar

**Google's Zanzibar** is the reference ReBAC system; Drive, YouTube, Calendar and Cloud use it. Its signature rule is *inherit through a relation*: a file's editors include the editors of its parent folder, and a grant to a group covers the group's members.

### What EAC cannot express today

> "Anyone on the devops team may manage every name under devops — including the ones we create tomorrow."

There is no EAC entry that means *members of this team*. Teams work around it in one of two ways:

1. **Copy every member everywhere.** Grant each person on each registry. Root grants do cover future names, but only inside *one* registry. Joining or leaving costs a transaction per registry, each role is capped at 15 holders, and one missed revoke leaves access behind.
2. **Grant one shared contract** (for example a Safe). It works, but members stop acting as themselves: every action is routed through that contract and its own rules.

> **Pitch line:** "EAC can give a role to an address. It can't give one to a relationship."

---

## 4. Cascade: the mechanism

### The rule (one hop)

> An account's roles on any subname = **its own EAC grants** ∪ **the roles the parent grants the team**, *if the account is a member of the team*.

That is one Zanzibar-style inheritance step, done inside EAC: **parent name → team → member**.

### The contracts

| Contract | Role in the system |
|---|---|
| **`TeamRegistry`** | A small, plain EAC contract. Admins grant or revoke `MEMBER`. It exposes `isMember(address)` and declares the `ITeam` interface through ERC-165. Joining the team is an **ordinary EAC grant**. |
| **`CascadeSubregistry`** | A stock `PermissionedRegistry` with **one override** (`_getRoles`), plus a guarded `team` pointer, `explain()` and `nativeRoles()`. It manages the subnames of `devops.acme-corp.eth`. **The only real contribution.** |
| **Org registry** (`acme-corp.eth`) | An **unmodified** stock `PermissionedRegistry`. It holds `devops` and grants `TeamRegistry` `SET_SUBREGISTRY` on it, with a normal `grantRoles` call. |
| **`AlwaysTrueTeam`** | **A demo fixture only**: the attacker's contract, which claims everyone is a member. |

### The override

```solidity
function _getRoles(uint256 resource, address account) internal view override returns (uint256 roleBitmap) {
    roleBitmap = super._getRoles(resource, account);          // 1. stock EAC (incl. approved operators)
    if (resource == ROOT_RESOURCE) return roleBitmap;         //    root is never inherited
    uint256 granted = _teamGrant();                           // 2. parent.roles("devops", team), regular bits only
    if (granted != 0 && _isMember(account)) roleBitmap |= granted;   // 3. team.isMember(account)
}
```

- **`_teamGrant()`** asks the parent registry for `roles(label, team)`, then **masks off the admin half**. The parent is found through the stock `setParent` / `getParent`.
- **`_isMember()`** asks the team contract whether the account is a member.
- Because **everything goes through the hook**, the write path (`_checkRoles`), the public views `hasRoles` and `roles`, and `explain()` all agree.

### Safety properties

**No escalation**

- **Admin bits are masked**, so members can never grant or revoke. EAC decides who can grant from admin bits only.
- **Root is never inherited**, so members can't register names, upgrade the registry or change the pointer.
- **Members get only what the parent granted the team.** Here that is `SET_SUBREGISTRY`, not `SET_RESOLVER`.

**The pointer is guarded**

- `setTeam` needs `ROLE_SET_TEAM` on root.
- It rejects a non-contract address (`TeamNotContract`).
- It requires the address to declare the `ITeam` interface through ERC-165 (`TeamInterfaceUnsupported`).
- Every change emits `TeamPointerUpdated(old, new, by)`.
- **Trust assumption:** a contract can lie about ERC-165, so whoever holds `ROLE_SET_TEAM` is trusted, exactly as a namespace admin is.

**External calls are safe**

- Both external calls run inside view functions, so the EVM makes them **STATICCALLs**: the called contract cannot change any state. That makes reentrancy moot.
- Each call has a **gas cap**: 30,000 for `isMember`, 50,000 for the parent's `roles`.
- They are made as **low-level calls with a length check**. Solidity's `try/catch` does **not** catch return data it can't decode. A team contract returning one byte would otherwise have made every check on the registry revert, including native owners' checks. A test caught this.
- **Result:** reverts, infinite loops and garbage return data all **fail closed**.

**No self-reference**

A registry set as its own parent is refused, which prevents infinite recursion.

### Why a pointer, not "find who holds the role"

EAC stores **counts** of role holders (`roleCount`, `getAssigneeCount`), **not identities**. The registry therefore can't ask "who holds `SET_SUBREGISTRY` on `devops`?".

Instead it **names its candidate** (`team`) and checks the parent's grant to that team **live, on every call**. The **grant is the authority**; the pointer alone confers nothing. Revoke the grant and the path closes.

### Invalidation: does access survive the parent changing?

- **Token IDs** regenerate on every grant or revoke (`tokenVersionId`). This protects buyers of names.
- **The resource** (`eacVersionId`) changes when a name is **unregistered, expires, or is re-registered**.
- Cascade reads the parent's grant against the parent's **current resource**. So re-registration or expiry **ends the team's authority automatically**, exactly as it ends native grants. This is proven live (terminal demo step 8) and in tests.
- **A transfer keeps third-party grants in place.** That is stock ENSv2 behaviour for every delegate, not something specific to Cascade; the new owner can revoke the team in one call.

### `explain()` and `nativeRoles()`

- **`explain()`** returns all three answers (does the caller hold the role directly? does the parent grant the team? is the caller a member?) plus `allowed`. `allowed` is `hasRoles`, which uses the same hook as the write path, so the two can't drift.
  - **Exception:** the write path also rejects expired names first; `explain()` does not check expiry.
- **`nativeRoles()`** is the stock-only view: the caller's own grants, with nothing inherited. The UI uses it for the "stored in EAC" row.

> **Pitch line:** "One hook, one extra term. Everything above and below it is stock ENSv2."

---

## 5. What changes, named rather than hidden

- **`hasRoles()` and `roles()` include inherited roles**, just as they already include approved operators. That keeps views in agreement with writes.
- **Inherited roles emit no events.** Indexers must call `hasRoles()` rather than rebuild roles from logs.
- **Every write costs about 2,300 extra gas, native owners included**, because every lookup on a subname can make two external calls (73,069 vs 75,382 gas, measured locally).
- **One new root role (`ROLE_SET_TEAM`) and the pointer.**
- **A latent power:** the team contract itself holds `SET_SUBREGISTRY` on `devops`. `TeamRegistry` has no function that could use it, which is why team contracts should be narrow.

---

## 6. What is deployed (Sepolia, ENSv2 beta)

```
.eth registry (ENS beta)
 └─ acme-corp.eth        → org registry: stock PermissionedRegistry   0xa27742aead8ca8baa8ff0a97754ac1736741e126
     └─ devops           → CascadeSubregistry                         0x2f15c12d21d7561433ddc6f7b856e9f0e4455e13
         └─ svc-xxxx     → created live in each demo
TeamRegistry    0x11ddfcb62670f0608d7cbc5b61e4470e0c7472bb  (granted SET_SUBREGISTRY on devops by the org registry)
AlwaysTrueTeam  0xaa735fc88e25f7d846010469ee75f287c8ec20c1  (attacker fixture)
```

### Setup

One idempotent script, `npm run setup`. It simulates every step first and only sends with `--write`:

1. Deploy the org registry.
2. Deploy `CascadeSubregistry` and `TeamRegistry`.
3. Register `acme-corp.eth` with commit–reveal.
4. Register `devops`, pointing at Cascade.
5. Grant the team its role on `devops`.
6. Call `setParent` and `setTeam` on Cascade.
7. Deploy the attacker fixture.

### History

The first version overrode `_checkRoles`. It was replaced by the `_getRoles` version using `setup --redeploy`, which **repointed** `devops` to the new registry and **revoked** the old team's grant. Both deployments are recorded in `deployments/sepolia.json`.

### Provenance

- Built against **`ensdomains/contracts-v2@48b3e2d`**, verified to match the beta deployment.
- **Not** production ENS. **Not** audited. **Not** yet source-verified on Etherscan.

---

## 7. How it is proven

### 17 Foundry tests

- The full deny → grant → allow → revoke → deny sequence.
- Views agree with writes.
- Only the granted role is inherited.
- Admin bits are masked.
- Root is never inherited.
- Members can't register names or grant roles.
- The pointer: an outsider is refused, a wallet is refused, a contract without the interface is refused, and the event carries old, new and sender.
- Broken team contracts (revert, infinite loop, 1-byte return) all fail closed, and native owners are unaffected.
- The gas cap bounds the call.
- Parent re-issue, expiry and transfer.
- A registry set as its own parent.
- A gas comparison between native and inherited writes.

### Live runs

- **The 8-step terminal demo on Sepolia:** every outcome as expected, every transaction on Etherscan.
- **An earlier web UI version:** clicked through on live Sepolia.
- **The current shared-drive UI:** clicked through on a **Sepolia fork** (all seven actions, every trace decoded); on live Sepolia, the Reset action and its trace replay were run. Do one full live run-through before presenting.

### Gas on Sepolia

- Write allowed through the team: **91,946**.
- Write denied after the full check: **69,921**.

---

## 8. The demo software

### Shared core (`core/cascade/`)

Holds the addresses, the ABIs (generated from the Foundry build), the **three-check chain** with its short-circuit, the agreement check, and the cost numbers. **The terminal demo and the web UI both use it**, so they can't disagree about what a check means.

### Terminal demo (`npm run demo`)

| Step | What happens |
|---|---|
| 1–5 | Create a subname; the outsider's write is denied; the outsider joins; the write is allowed; the outsider leaves; the write is denied again. |
| 6 | The outsider tries to hijack the team pointer. |
| 7 | The operator tries to set a plain wallet as the team. |
| 8 | The parent re-issues `devops`, and the same member is denied. |

**Refused writes are actually sent**, with a fixed gas limit, so each refusal is a **mined failed transaction** rather than a simulated claim. Revert reasons are decoded from a simulation.

### Web UI (Next.js + wagmi): ENS Drive

A deliberately simple page in three parts — the problem, try it, under the hood — with everything else in a collapsed "More detail".

**The shared-drive demo**

- **The mapping.** The `devops` folder is `devops.acme-corp.eth` (a name with its own registry); files are its subnames; the `devops-team` group is `TeamRegistry`; "Can edit" is the `SET_SUBREGISTRY` role; "Edit as outsider" is a real `setSubregistry` write.
- **Share dialog.** The folder's "Shared with devops-team · Can edit" pill opens a read-only share dialog driven by the parent's live grant.
- **Group and People.** Drag the outsider between them (or use the text button) to grant or revoke `MEMBER` on `TeamRegistry`. The chip's position comes from the live `isMember` read; a dashed placeholder waits while the transaction confirms.
- **Who has access.** For the selected file: Admin (owner), devops-team (can edit, from the folder), and the outsider — "Can edit · via devops-team" or "No access". Underneath, in ENS terms, *given directly* (`nativeRoles()`, never changes) next to *via the group* (inherited). This is the visual proof that Cascade adds to EAC without writing into it.
- **Folders tree.** `acme-corp.eth › devops`, with the parent-folder cascade marked "Next — not built yet".
- **Attack.** "As the outsider, change who the folder is shared with" sends `setTeam` and is refused on-chain.
- **Start over.** Removes the outsider from the group if a previous run left them in.

**Behind the scenes**

After each action, the server replays the mined transaction with Foundry's `cast run` and the page shows the EVM's own call tree — the calls, gas, return values, events and reverts — decoded into names by context, with a plain-language note per call. Internal steps (`_checkRoles` → Cascade's `_getRoles`) are shown separately, labelled as from the contract source, because the EVM doesn't record internal functions. If the full replay fails on the free RPC, it falls back to `cast run --quick`, labelled as such. Traces only work for fresh transactions.

**Reads and writes**

- **The browser reads the chain directly** and waits for every receipt itself. Nothing is shown as landed before it has.
- **The two demo keys sign on the app's server** and never reach the browser.
- **Transactions (and traces) only run locally.** A public server would let anyone spend the operator's ETH.
- **Light theme by default**, with a toggle.

---

## 9. Scope and roadmap

### MVP (live)

**One hop, one team per registry**, chosen deliberately to test the rule inside EAC.

### Next (planned, not built)

1. **Many teams per role.** Devops can edit, security can revoke.
2. **Teams of teams.** Nested groups, bounded in depth and gas.
3. **Multi-hop names.** Inheritance up the name tree, with a hard depth cap.
4. **Bring your own roster.** A Hats role or a Safe's owners behind `isMember()`, after checking it fits the gas cap.

### After ENS feedback

- **Who-can-access queries:** events plus an indexer, the equivalent of Zanzibar's "expand".
- **Resolver-record rights:** a **different mechanism**, because resolver permissions are keyed by record, not by parent name, so there is no hop to inherit through.
- **Agent fleets as the use case:** agents are just members, so this needs no mechanism change.

### The invariant every step keeps

Native grants stay untouched, admin and root roles are never inherited, and every lookup is bounded and fails closed.

---

## 10. Glossary

| Term | Meaning |
|---|---|
| **Resource** | The `uint256` an EAC permission is scoped to. |
| **`ROOT_RESOURCE` (0)** | Registry-wide scope: a role granted here applies to every name in the registry. |
| **Role bitmap / nybble** | An account's roles stored as 4 bits per role; the upper half holds admin roles. |
| **Admin role** | `role << 128`; lets you grant or revoke that role. |
| **`_getRoles`** | EAC's read-time hook; Cascade's only override. |
| **`eacVersionId`** | Changes on unregister or expiry, resetting a name's permissions. |
| **`tokenVersionId`** | Changes on grant or revoke, regenerating a name's token ID. |
| **STATICCALL** | A read-only external call; the called contract can't change state. |
| **ERC-165** | A standard way for a contract to declare which interfaces it supports. |
| **Commit–reveal** | Two-step registration that prevents front-running. |
| **ReBAC** | Relationship-based access control: access decided by relationships. |
| **Zanzibar** | Google's reference ReBAC system. |
| **Fail closed** | On any error, deny. |
