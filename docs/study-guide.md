# ENS Drive — 20-minute study guide

> **Naming:** *ENS Drive* is the product; *Cascade* is its permission layer — the `CascadeSubregistry` contract and the ReBAC rule it implements. Contract and code names stay `Cascade…`, matching the Sepolia deployment.

Read top to bottom. Each block is time-boxed; the total is 20 minutes. Deeper detail lives in [`project-explainer.md`](project-explainer.md) and [`contracts-explained.md`](contracts-explained.md) — you don't need them to pitch.

---

## Minutes 0–3 · The idea in four sentences

1. **ENSv2's access control (EAC) grants roles to addresses**, one name at a time: every permission is a (name, address, role) entry.
2. **It can't express a relationship** like "anyone on the devops team may manage every name under devops — including tomorrow's."
3. **Cascade adds that one relationship** as a single extra term inside EAC's own role lookup: an account's roles on a subname = its own grants **∪** what the parent grants the team, *if it's a member*.
4. **Nothing EAC does is replaced.** It's one subclass of ENS's own registry, overriding one hook. The MVP is deliberately **one hop and one team per registry**.

**Memorise:** *"EAC can give a role to an address. It can't give one to a relationship. Cascade adds the relationship, inside EAC."*

---

## Minutes 3–8 · The ENSv2 concepts you must be fluent in

| Concept | What to say |
|---|---|
| **Registry per name** | In ENSv2 every name can have its own registry. `acme-corp.eth` → its registry holds `devops` → `devops`'s registry (Cascade) holds `svc-…`. |
| **`PermissionedRegistry`** | ENS's standard registry. Each name is an ERC-1155 token with an expiry, a subregistry and a resolver. |
| **EAC resource** | The `uint256` a permission is scoped to. Each name has one; `ROOT_RESOURCE` (0) means "every name in this registry". |
| **Role bitmap** | Roles packed 4 bits each; lower half regular, upper half admin (`role << 128`). Holding the admin lets you grant/revoke. Max 15 holders per role. |
| **Counts, not identities** | EAC can tell you *how many* hold a role (`roleCount`), not *who*. That's why Cascade uses a team pointer. |
| **`_getRoles`** | EAC's documented hook for adding role logic at read time. Stock `PermissionedRegistry` already uses it for approved operators. **Cascade's only override.** |
| **Registry vs resolver roles** | Registry roles = structure (children, resolver, renewal). Resolver roles = records, keyed by record, not by name. Cascade is registry-only. |
| **Token ID vs resource versions** | Grants/revokes change a name's token ID. Unregister/expiry changes its resource — which wipes permissions, including the team's grant. |

---

## Minutes 8–13 · The mechanism and why it's safe

**The code that matters** (`CascadeSubregistry._getRoles`):
```solidity
roleBitmap = super._getRoles(resource, account);          // stock EAC
if (resource == ROOT_RESOURCE) return roleBitmap;         // root never inherited
uint256 granted = _teamGrant();                           // parent.roles("devops", team), admin bits stripped
if (granted != 0 && _isMember(account)) roleBitmap |= granted;
```

**Three facts must all be true for a member to act** — cut any one and access ends:

| Fact | Lives in | Changed by |
|---|---|---|
| Parent grants the team `SET_SUBREGISTRY` on `devops` | org registry (stock) | `grantRoles` / `revokeRoles` |
| The account is a member | `TeamRegistry` (plain EAC) | `grantRoles` / `revokeRoles` |
| Cascade reads this team | `CascadeSubregistry.team` | `setTeam` (needs `ROLE_SET_TEAM`) |

**Safety, in one breath each:**
- **No escalation:** admin bits masked (can't grant), root never inherited (can't register/upgrade/repoint the team), only the role the parent chose.
- **Guarded pointer:** `ROLE_SET_TEAM`, must be a contract, must declare `ITeam` via ERC-165, emits `TeamPointerUpdated`. Trust anchor = whoever holds `ROLE_SET_TEAM`.
- **Safe external calls:** read-only STATICCALLs, gas-capped (30k/50k), length-checked — reverts, loops and garbage all fail closed; native owners unaffected.
- **Self-invalidating:** the grant is read from the parent's *current* registration, so re-issue or expiry ends it automatically. Transfer keeps it (stock behaviour for every delegate).

**What changes (say it yourself):** views include inherited roles · inherited roles emit no events · ~2,300 gas per write, native owners too · one new root role + pointer · `hasRoles()` says yes on unregistered names for members (writes still refused).

---

## Minutes 13–16 · The ENSv2 dependency — what Cascade relies on

Cascade is a **subclass of ENSv2 code**, so it depends on specific behaviours staying as they are. Know these; one of them is a good question to ask ENS.

### Source dependency
- **`ensdomains/contracts-v2` pinned at commit `48b3e2d`** (git submodule), verified to match the ENSv2 beta deployed on Sepolia. Imported: `PermissionedRegistry`, `EnhancedAccessControl`, `RegistryRolesLib`, `LibLabel`, `ILabelStore`, `IRegistry`, plus OpenZeppelin's `ERC165Checker`.

### Behaviours Cascade depends on

| ENSv2 behaviour | Why Cascade needs it | If ENS changed it |
|---|---|---|
| `_getRoles` is `internal view virtual` and feeds every check | It's the only override; it's how inheritance reaches writes *and* views | Cascade can't hook in; would fall back to overriding `_checkRoles` (views would disagree with writes) |
| `roles(anyId, account)` on the parent routes through `_getRoles` and the parent's current resource | How Cascade reads the parent's grant to the team | The "grant is the authority" read would need another call |
| `setParent` / `getParent` and the internal `_parentRegistry`, `_childLabel` | How Cascade finds its parent and its label | Would need its own parent pointer |
| Role layout: 4-bit slots, admin = `role << 128`, `ALL_ROLES` | Admin masking (`type(uint128).max`) and the free slot for `ROLE_SET_TEAM` (`1 << 40`) | Masking and the new role would need redoing |
| Grant rules derive only from admin bits (`_getSettableRoles` shifts `>> 128`) | The "members can't grant" guarantee | Must re-verify no-escalation |
| Resource versioning: unregister/expiry moves the resource (`eacVersionId`) | Automatic invalidation of the team's grant on re-issue | Must re-verify invalidation |
| Expiry checked before roles (`_checkExpiryAndTokenRoles`) | Writes to unregistered/expired names are refused even though views say yes | Would expose inherited roles on dead names |
| Transfers move only the owner's roles (`_update`) | "Transfer keeps the team grant" behaviour | Stated behaviour would change |
| Constructor takes the shared `LabelStore` | Deploying both registries | Deploy args change |

**Good question to ask ENS:** *"Is `_getRoles` a stable, supported extension point for registries going forward? Cascade depends on it — so does your own approved-operator logic."*

### Deployment dependency (ENSv2 beta on Sepolia — not production)

| Contract | Address | Used for |
|---|---|---|
| `.eth` registry | `0x1d78834d97c1d7b1a38c1dedbd1a287cfed3971e` | holds `acme-corp` |
| `ETHRegistrar` | `0x7d1b7f586a62ac3f54b9a396849757814283270b` | commit–reveal registration of `acme-corp.eth` |
| `LabelStore` | `0xD7351F76866123A7E49381F38a30a96AdBa7E855` | constructor arg for both registries |
| Universal Resolver | `0xd26f2040d083af1cd2962ba303f4bea0c4faf142` | resolution checks (viem's built-in address must be overridden) |
| Public resolver | `0xf9de4979ddb290baf5b760d0e788125017bc33f6` | `acme-corp.eth`'s resolver |
| MockUSDC | `0xcbfd80f74375c54e545af34788ff465f96f66f05` | registration fee |

These came from the ETHOnline ENSv2 beta deployment and were verified behaviourally (code present, reads return expected values). **If ENS redeploys the beta, Cascade must be redeployed and re-wired** (`npm run setup -- --write`, then `npm run gen`).

### Our contracts on that deployment

| Contract | Address |
|---|---|
| Org registry (`acme-corp.eth`, stock) | `0xa27742aead8ca8baa8ff0a97754ac1736741e126` |
| `CascadeSubregistry` (`devops.acme-corp.eth`) | `0x2f15c12d21d7561433ddc6f7b856e9f0e4455e13` |
| `TeamRegistry` | `0x11ddfcb62670f0608d7cbc5b61e4470e0c7472bb` |
| `AlwaysTrueTeam` (fixture) | `0xaa735fc88e25f7d846010469ee75f287c8ec20c1` |

---

## Minutes 16–19 · Flash cards — cover the answer, say it aloud

1. **Why not root grants?** → They cover future names but only within one registry; a team across registries = a grant per person per registry. Cascade: one roster any registry points to; team admins separate from namespace admins.
2. **Why a pointer instead of finding the holder?** → EAC stores counts, not identities. The parent's grant is the authority; the pointer alone grants nothing.
3. **Can a member grant roles or register names?** → No: admin bits are masked and root is never inherited.
4. **What if the team contract is malicious?** → Members get exactly the parent's grant, nothing more; one revoke of the parent grant cuts everyone; broken teams fail closed.
5. **What stops someone swapping the team?** → `ROLE_SET_TEAM`, a contract check, an ERC-165 check, and an event. Demo step 7 shows the refusal on-chain.
6. **Does the team keep access if `devops` is re-issued?** → No — the grant is read from the current registration, so it ends automatically.
7. **Why `_getRoles` and not `_checkRoles`?** → It's the documented hook, and it keeps `hasRoles()` truthful.
8. **What do indexers see?** → No events for inherited roles; they should call `hasRoles()`.
9. **What does it cost?** → ~2,300 gas per write, native owners included (local measurement); 91,946 gas for an allowed inherited write on Sepolia.
10. **Is this a shared resolver / a token?** → Neither: a registry role; the subname token never moves.
11. **What's next?** → Many teams per role, teams of teams, multi-hop names, bring-your-own roster (Hats / Safe). After your feedback: who-can-access queries, resolver records, agent fleets.
12. **Is the demo live?** → Yes: Sepolia transactions, Etherscan links, revert reasons decoded from the chain.

---

## Minute 19–20 · Pre-flight

- [ ] `npm run ui` running; fresh browser window at the top of the page.
- [ ] Outsider **not** in the team (the guided coach warns if they are).
- [ ] Fallback terminal: `npm run demo -- --core`; `--recap` replays the last run and says so.
- [ ] Etherscan tab open for anyone who wants to verify.

---

## If the 20 minutes is your pitch slot

| Time | Segment | What happens |
|---|---|---|
| 0–2 | Frame | One-liner; MVP scope (one hop, one team). |
| 2–5 | The gap + the idea | Ledger → the sentence EAC can't express → the formula. |
| 5–10 | Live demo | Create → write fails → **drag in** → write succeeds → drag out → fails → **hijack refused**. Talk over the ~12 s confirmations. |
| 10–12 | How it fits | One hook; every other layer stock; name the changes yourself. |
| 12–13 | Roadmap | Step 0 live; steps 1–4 next; 5 after feedback. Don't promise all of 1–4. |
| 13–20 | **Their feedback** | The four questions, then agents & resolver records, then *"Is `_getRoles` a stable extension point?"* Write down their exact words. |

Leave at least **seven minutes for their answers** — that conversation is the point of the meeting.
