# Cascade — smart-contract architecture

What happens at the contract level, behind every action in the demo. Diagrams render on GitHub (Mermaid). Addresses are the live Sepolia deployment on the ENSv2 beta; the source is `contracts/src/` built on `ensdomains/contracts-v2@48b3e2d`.

The demo UI shows the same thing live: after each action, its **Behind the scenes** panel replays the mined transaction with Foundry's `cast run` and prints the EVM's own call tree.

---

## 1. The contracts and what each stores

```mermaid
flowchart LR
  subgraph ENS["ENSv2 beta (stock)"]
    ETH[".eth registry"]
  end
  subgraph ORG["OrgRegistry · acme-corp.eth · stock PermissionedRegistry"]
    DEV["name: devops<br/>subregistry → CascadeSubregistry"]
    GRANT["EAC grant on devops:<br/>TeamRegistry holds SET_SUBREGISTRY"]
  end
  subgraph CAS["CascadeSubregistry · devops.acme-corp.eth · one override"]
    SVC["names: svc-…"]
    PTR["team → TeamRegistry"]
    PAR["parent → OrgRegistry, label 'devops'"]
  end
  subgraph TEAM["TeamRegistry · the roster · plain EAC"]
    MEM["MEMBER bit per account<br/>(resource 1)"]
    ADM["MEMBER_ADMIN at root<br/>(operator)"]
  end
  ETH -->|"acme-corp → subregistry"| ORG
  DEV -->|"children live in"| CAS
  CAS -. "reads roles(devops, team)" .-> GRANT
  CAS -. "reads isMember(caller)" .-> MEM
```

| Contract | Address (Sepolia) | Code | Stores |
|---|---|---|---|
| OrgRegistry | `0xa27742aead8ca8baa8ff0a97754ac1736741e126` | stock `PermissionedRegistry` | the name `devops`; the grant *TeamRegistry holds `SET_SUBREGISTRY` on devops*; operator's root roles |
| CascadeSubregistry | `0x2f15c12d21d7561433ddc6f7b856e9f0e4455e13` | `PermissionedRegistry` + one override | the `svc-…` names; `team` pointer; parent + label (stock `setParent`); operator's root roles incl. `ROLE_SET_TEAM` |
| TeamRegistry | `0x11ddfcb62670f0608d7cbc5b61e4470e0c7472bb` | plain `EnhancedAccessControl` | `MEMBER` on resource 1 per account; `MEMBER_ADMIN` on root for the operator |
| AlwaysTrueTeam | `0xaa735fc88e25f7d846010469ee75f287c8ec20c1` | demo fixture | nothing — answers `isMember = true` for anyone |

Three independent facts must all hold for a member to act — cut any one and access ends:
**(1)** the OrgRegistry grant to the team · **(2)** membership in TeamRegistry · **(3)** Cascade's `team` pointer.

---

## 2. Inheritance — how the override reaches ENS's own code

```mermaid
classDiagram
  class EnhancedAccessControl {
    <<stock ENSv2>>
    +hasRoles(resource, roles, account) bool
    +roles(resource, account) uint256
    +grantRoles(...) / revokeRoles(...)
    #_checkRoles(resource, roles, account)
    #_getRoles(resource, account) uint256  «virtual»
  }
  class PermissionedRegistry {
    <<stock ENSv2>>
    +register / setSubregistry / setResolver / renew ...
    #_getRoles()  «override: approved operators get the owner's roles»
  }
  class CascadeSubregistry {
    <<new>>
    +team : address
    +setTeam(address)  «ROLE_SET_TEAM»
    +explain(anyId, roles, account)
    +nativeRoles(anyId, account)
    #_getRoles()  «override: + team's grant for members»
  }
  class TeamRegistry {
    <<new, thin>>
    +isMember(address) bool
    +supportsInterface(ITeam)
  }
  EnhancedAccessControl <|-- PermissionedRegistry
  PermissionedRegistry <|-- CascadeSubregistry
  EnhancedAccessControl <|-- TeamRegistry
```

`_getRoles` is `virtual`, so every role check inside ENS's unmodified code (`_checkRoles`, `hasRoles`, `roles`, the grant rules) runs the most-derived version — Cascade's — which calls `super._getRoles` first (ENS's own logic) and then adds the team's grant.

```solidity
function _getRoles(uint256 resource, address account) internal view override returns (uint256 roleBitmap) {
    roleBitmap = super._getRoles(resource, account);          // stock EAC + approved operators
    if (resource == ROOT_RESOURCE) return roleBitmap;         // registry-wide roles are never inherited
    uint256 granted = _teamGrant();                           // OrgRegistry.roles(labelhash("devops"), team) & lower 128 bits
    if (granted != 0 && _isMember(account)) roleBitmap |= granted;   // TeamRegistry.isMember(account)
}
```

---

## 3. What happens on each demo action

### A write by the outsider — `setSubregistry(svc, placeholder)`

```mermaid
sequenceDiagram
  autonumber
  actor O as outsider
  participant C as CascadeSubregistry
  participant R as OrgRegistry
  participant T as TeamRegistry
  O->>C: setSubregistry(svc, placeholder)
  Note over C: stock: _checkExpiryAndTokenRoles<br/>name expired? → revert LabelExpired
  Note over C: stock: _checkRoles → hasRoles → _getRoles
  Note over C: Cascade _getRoles: stored roles = none
  C->>R: roles(labelhash("devops"), TeamRegistry)  [STATICCALL, ≤50k gas]
  R-->>C: SET_SUBREGISTRY
  C->>T: isMember(outsider)  [STATICCALL, ≤30k gas]
  alt member
    T-->>C: true
    Note over C: roles = SET_SUBREGISTRY → check passes
    C-->>O: write stored · emit SubregistryUpdated
  else not a member
    T-->>C: false
    C-->>O: revert EACUnauthorizedAccountRoles(tokenId(svc), SET_SUBREGISTRY, outsider)
  end
```

Real trace from the demo (replayed with `cast run`, member case):

```
CascadeSubregistry.setSubregistry(labelhash("svc-…"), placeholder)      70,230 gas
 ├─ OrgRegistry.roles(labelhash("devops"), TeamRegistry)  [read-only]  12,666 gas → SET_SUBREGISTRY
 ├─ TeamRegistry.isMember(outsider)                        [read-only]   5,148 gas → true
 ├─ emit SubregistryUpdated(tokenId("svc-…"), placeholder, outsider)
 └─ done
```

### Joining / leaving the team — drag in / drag out

```mermaid
sequenceDiagram
  actor Op as operator (team admin)
  participant T as TeamRegistry
  Op->>T: grantRoles(1, MEMBER, outsider)   (drag in)
  Note over T: stock EAC: _roles[1][outsider] |= MEMBER · count +1
  T-->>Op: emit EACRolesChanged
  Op->>T: revokeRoles(1, MEMBER, outsider)  (drag out)
  T-->>Op: emit EACRolesChanged
```

Nothing is written to any name. Every subname's access flips because each check reads membership live.

### Creating a subname — `+ New subname`

`CascadeSubregistry.register("svc-…", operator, 0x0, 0x0, RENEW, +30 days)` → `LabelStore.setLabel` → mint the name's ERC-1155 token to the operator → the operator gets `RENEW` on it. Nobody gets `SET_SUBREGISTRY` on the new name.

### The hijack attempt — dropping `AlwaysTrueTeam` on the socket

```
CascadeSubregistry.setTeam(AlwaysTrueTeam)                               3,731 gas
 └─ reverted: EACUnauthorizedAccountRoles(root, SET_TEAM, outsider)
```

`setTeam` is `onlyRootRoles(ROLE_SET_TEAM)`; it fails before anything runs. Had the caller held the role, it would also require a contract that declares `ITeam` via ERC-165, and emit `TeamPointerUpdated(old, new, by)`.

---

## 4. Role bitmaps involved

| Role | Bits | Where |
|---|---|---|
| `SET_SUBREGISTRY` | `1 << 20` | granted to TeamRegistry on `devops` in OrgRegistry; inherited by members on `svc-…` |
| `RENEW` | `1 << 16` | operator's role on each new `svc-…` |
| `ROLE_SET_TEAM` | `1 << 40` | root role on CascadeSubregistry; gates `setTeam` |
| `MEMBER` | `1 << 0` (TeamRegistry) | per member, on resource 1 |
| any admin role | `role << 128` | never inherited — Cascade masks the upper 128 bits |

---

## 5. Guarantees and where they come from

| Guarantee | Mechanism |
|---|---|
| Members can't grant or revoke | the inherited bitmap is masked to the lower 128 bits; EAC derives grant rights only from admin (upper) bits |
| Members can't register, upgrade or change the team | `_getRoles` returns early for `ROOT_RESOURCE` |
| Only the role the parent chose | `granted` is exactly what OrgRegistry holds for the team on `devops` |
| Views agree with writes | the logic lives in `_getRoles`, which `hasRoles`, `roles` and `_checkRoles` all read |
| A broken or hostile team can't block or escalate | STATICCALLs (no state changes), gas caps, length-checked returns; any failure → no inherited roles |
| Re-issuing the parent ends the team's authority | `roles()` reads the parent's *current* EAC resource; unregister/expiry moves it |
| Stored EAC state is never touched by inheritance | nothing is written on Cascade when a member gains or loses access — `nativeRoles()` stays unchanged |

---

## 6. Trade-offs (named)

- `hasRoles()` / `roles()` include inherited roles; for a member, `hasRoles()` is also true on unregistered labels (writes there still revert, `LabelExpired`).
- Inherited roles emit no events; indexers should call `hasRoles()`.
- Every role lookup on a subname can make two external calls — about 2,300 extra gas per write, native owners included (local measurement).
- The team contract itself holds `SET_SUBREGISTRY` on `devops`; `TeamRegistry` has no function that uses it — team contracts should be narrow.
- MVP scope: one hop, one team per registry.
