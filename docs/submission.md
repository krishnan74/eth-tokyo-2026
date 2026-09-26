# Submission form copy — ENS Drive

The ETHGlobal form copy, kept here so it can be updated and re-pasted. **First draft submitted on 2026-09-26 at commit `fdff719`, without the demo video.** That draft described the one-folder MVP (v1). Since then the cascade version (v2) was built, deployed on Sepolia, merged into `main` and made the live demo's default; every section below describes the current state (`main` at `fcf2147`). Re-paste it when editing the submission. The ENS track text is quoted from the Tokyo 2026 prize page.

Every claim here is backed by [`evidence.md`](evidence.md), [`roadmap-v2.md`](roadmap-v2.md), the tests, or a Sepolia transaction. Where something only ran on a local fork, it says so.

---

## Project name

ENS Drive

## Tagline / short description (95 characters)

Google Drive–style sharing for ENS names: share with a team, not each subname with each person.

## Description

ENSv2 already built the directory tree: every name can have its own registry, so names nest like folders (`orbit-dao.eth › protocol › vault`). What's missing is the sharing layer. ENSv2's Enhanced Access Control (EAC) grants permissions one address on one name, in each folder's own registry, so there is no way to say "everyone on core-devs may manage every name under protocol, including the ones we create tomorrow." Today a team either copies every member onto every name and registry, or routes every action through a shared contract such as a Safe, where members stop acting as themselves.

ENS Drive adds that permission layer with Cascade, a relationship-based access control (ReBAC) rule built into EAC itself. A name grants a role to a team contract, like sharing a folder with a group, and the team's members inherit that role on every name below it, checked live on every call: through up to three folders, up to four teams per folder, and teams inside teams. Add someone to a team once and they can manage every name; remove them once and their access is gone everywhere. Nothing is written to the names, and nothing EAC does today is replaced: the only new contract is a subclass of ENSv2's own `PermissionedRegistry` that overrides its role lookup.

The live demo is a shared-drive view on real ENSv2 beta contracts on Sepolia, for a fictional DAO, `orbit-dao.eth`. A new contributor, `alex.orbit-dao.eth`, can't edit the protocol's contract names (`vault`, `oracle`, `bridge`). Dragged into core-devs, they can edit all three at once; moved into auditors, a team inside the security council that's shared one folder up on `orbit-dao.eth`, they still can; turning off "sharing flows into subfolders" takes it away. An attempt to add an always-yes group is refused on-chain. After each action an "On-chain, just now" card says in plain words what the contracts checked, and "Behind the scenes" replays the mined transaction's full call tree. The first, one-folder version is still there in a second tab.

What is live: the contracts and every demo action run on the ENSv2 beta on Sepolia, with transactions on Etherscan, and the hosted site at ens-drive.vercel.app sends them itself, signing with dedicated least-privilege keys under a rate limit and a capped test-ETH budget. What is not: production ENS (this is the ENSv2 beta), an audit, and wallet connection (visitors drive a demo account, not their own).

## How it's made

The core is one contract, `CascadeSubregistryV2` (`contracts/src/CascadeSubregistryV2.sol`), a subclass of ENSv2's `PermissionedRegistry` built against `ensdomains/contracts-v2@48b3e2d`, the source matching the ENSv2 beta on Sepolia. It overrides EAC's role lookup, `_getRoles`, the documented hook the stock registry already overrides for approved operators, and its write-side check, `_checkRoles`. Because both are virtual, every permission check inside ENS's unmodified code runs the new version. It returns the caller's own grants, plus, for each team the registry names, the roles that ancestor registries grant that team on the path down to this registry, if the caller is a member. Cascade doesn't add a check; it changes the answer to the one check ENS already runs.

The write-side check is lazy and role-aware: the caller's own roles first (owners pay no external lookup), then one folder at a time; a team is asked about membership only when its grants cover a role still missing, and the walk stops as soon as every requested role is covered. Because inheritance only adds roles, that gives the same yes/no as the full union; a differential fuzz test and a Halmos proof check it. On Sepolia a member's write through one level costs 97,665 gas (the first, full-union version: 165,723); an owner's write is unchanged at 36,971.

The hard parts were making that safe. Each level must point back down (`getSubregistry` on the parent returns the child) before its grant counts, so a registry can't claim a parent that doesn't claim it. Admin role bits are masked off, so members can use a role but never grant it; nothing is inherited at the registry root, so registering names, upgrading, or changing the teams stay native-only. Adding a team needs a dedicated root role and a contract that declares the team interface through ERC-165. Every external lookup is a read-only STATICCALL with a gas cap and a bounded return size, and fails closed: a test showed that Solidity's `try/catch` does not catch undecodable return data, so a team contract returning one byte would have reverted every permission check on the registry, including the owner's. Because grants are read against each parent's current EAC resource, re-issuing or letting a parent name expire ends the team's authority automatically.

EAC can report how many accounts hold a role but not which ones, so the registry names its teams with pointers and treats the parents' grants as the authority: a pointer alone grants nothing. A team is anything with an `isMember(address)` view: `TeamRegistry` (plain EAC), `NestedTeam` (teams of teams, three levels), and adapters for a Hats role and a Safe's owners, tested on a fork against the real Hats v1 and Safe 1.4.1.

71 Foundry tests (unit, fuzz and invariant, including a v1/v2 equivalence invariant, hostile teams, gas caps, and parent re-issue, expiry and transfer) plus 3 Halmos symbolic proofs, for all inputs: v1's rule (a member gets exactly the regular half of the parent's grant, never an admin bit, nothing at the root), v2's lazy write check agreeing with the full union across two teams and two levels, and a parent that doesn't point back down contributing nothing. Deployment and wiring on Sepolia, including registering `orbit-dao.eth` through the ENSv2 beta registrar's commit–reveal, are viem scripts. A shared TypeScript core feeds a terminal demo and a Next.js 16 + wagmi web UI hosted on Vercel; its "Behind the scenes" panel replays each transaction with Foundry's `cast run` (public Sepolia RPCs don't serve trace APIs) and decodes the call tree into names.

## Track: ENS — Best Use of ENSv2 ($10,000)

The form's "How are you using this Protocol / API?" field takes this section's text, from "ENSv2 is the product" down.

> "Use Enhanced Access Control, the shared, role-based permission system behind both registries and resolvers" · "deploy your own subname registry to tokenize and manage subnames under your own rules"

**ENSv2 is the product, not an add-on.** ENS Drive is a new permission layer inside ENSv2's Enhanced Access Control: a custom subname registry (`CascadeSubregistryV2`, a `PermissionedRegistry` subclass) that extends EAC through its own role-lookup hooks so that a role granted to a team on a name is inherited by the team's members on every name below it, across folders. It reads the ancestor registries' EAC grants and team rosters that are themselves plain EAC. Without ENSv2's per-name registries and EAC there is nothing for it to extend.

**Built on ENSv2 (Sepolia):** `orbit-dao.eth` was registered through the ENSv2 beta `ETHRegistrar` with its subregistry set to a stock `PermissionedRegistry`, which holds `protocol` pointing at `CascadeSubregistryV2`. The security council is shared on `orbit-dao.eth` itself, in the .eth registry, two folders above the files. Contracts:
- Org registry (`orbit-dao.eth`): `0x6e1d2249483700697eb92f959f629fc2ebd6fc48`
- `CascadeSubregistryV2` (`protocol.orbit-dao.eth`): `0x7aa120442ccb9df297d81cd88975e4d9b129d0a3`
- core-devs (`TeamRegistry`): `0x170943bc913b250cb16d3e2720d0d4852e91adb0`
- security-council (`NestedTeam` ⊃ auditors): `0xce0bdedf8d6afb19c395f0d242395f62f975acfa`
- auditors (`TeamRegistry`): `0x63941f63430acb4af79c33d2eb5d6815683b9b62`
- The one-folder version (v1, second tab) on `devops.acme-corp.eth`: `CascadeSubregistry` `0x2f15c12d21d7561433ddc6f7b856e9f0e4455e13`, `TeamRegistry` `0x11ddfcb62670f0608d7cbc5b61e4470e0c7472bb`

**Functional, no hard-coded values:** every state in the demo is read live from these contracts, and every action is a real transaction, including the refused ones, which are mined as failed transactions with decoded revert reasons. Transaction hashes for every setup step and smoke run are in `docs/roadmap-v2.md` and `docs/evidence.md`.

**Feedback from ENS:** we pitched it three times to the ENS team at the event. Their feedback shaped the simpler UI, the contract-level "Behind the scenes" view, the lazy check (gas), and the extra access-control tests and proofs.

## Challenges / what we learned (if the form asks)

- EAC tracks role holder counts, not identities, so "who holds this role on the parent?" is not answerable on-chain; team pointers plus a live check of the parents' grants keep the grants as the authority.
- Overriding `_checkRoles` alone made views disagree with writes; the documented `_getRoles` hook fixed it. The v2 lazy `_checkRoles` is safe only because inheritance is monotone, so it is fuzzed and symbolically proven against the full union.
- Walking up the tree needs proof each level really contains the next: a registry's `getParent` is only a claim, so each level's `getSubregistry` must point back down.
- `try/catch` doesn't catch undecodable return data; untrusted external calls needed low-level calls with length and size checks.
- ENSv2's token IDs change on every grant/revoke while EAC resources change only on unregister/expiry; an expired name reads as a fresh resource, which is what makes re-issue and expiry invalidation automatic.
- Public Sepolia RPCs don't serve `debug_traceTransaction`; real traces came from replaying fresh transactions with `cast run`.

## What's next (if the form asks)

- `hasRoles` made overridable in ENSv2, so views can use the same lazy check as writes (today views pay the full lookup).
- Hats and Safe adapters deployed on Sepolia (built and fork-tested against the real contracts, not deployed).
- Visitors connecting their own wallet as the new contributor.
- An external audit before anything beyond the beta.

## Known limitations

- Union only: a name can't opt out of a grant made above it (deliberate; a deny rule would break "inheritance only adds").
- Up to 4 teams per registry and 3 levels; members pay more with every team and level (owners don't).
- Views (`hasRoles`, `roles`) compute the full answer; for a team member they also report the role on unregistered labels (writes there still revert).
- Inherited roles emit no events; indexers should call `hasRoles()`.
- ENSv2 beta on Sepolia, not production ENS; not audited; contracts not yet source-verified on Etherscan.

## Links

- **Repo:** `https://github.com/krishnan74/eth-tokyo-2026`, **still private.** The ENS track requires open source on GitHub; judges get a 404 until it is made public.
- **Code link (ENS prize, "link to the line of code where the tech is used"):** v2, the lazy write-side check: `https://github.com/krishnan74/eth-tokyo-2026/blob/fcf214713fb000c01f0cf7ef101ff2ab21a5adb2/contracts/src/CascadeSubregistryV2.sol#L153-L199`. The submitted link (v1 `_getRoles`, still valid): `https://github.com/krishnan74/eth-tokyo-2026/blob/fdff7192ac5ab9815afde3b7849147a67b909174/contracts/src/CascadeSubregistry.sol#L116-L122`. Both pinned to a commit so the lines never move.
- **Live demo:** https://ens-drive.vercel.app, opening on the cascade drive for `orbit-dao.eth`, with the one-folder version in the second tab. Every button sends a real Sepolia transaction; "Behind the scenes" replays it with `cast run`.
- **Video:** not yet recorded. Script in [`pitch-finalist.md`](pitch-finalist.md) §2, checklist in [`demo-video.md`](demo-video.md).
- **Contracts:** the Etherscan addresses above.
- **First draft submitted at commit:** `fdff719`. Current: `fcf2147`.

---

## Other form answers

### Category and emoji

- **Category:** Infrastructure. (Secondary if multi-select: Developer Tool, Security. Avoid Storage Application: nothing is stored.)
- **Emoji:** 📂

### Tech stack

- **Ethereum developer tools:** Foundry, OpenZeppelin (Contracts: `ERC165Checker`), Halmos. Not Hardhat: nothing in the repo uses it.
- **Networks:** Ethereum (Sepolia testnet).
- **Languages:** Solidity, TypeScript, Node.js, HTML/CSS (JavaScript optional: the only JS file is a config). Not PowerShell.
- **Web frameworks:** Next.js (plus React and Tailwind CSS if offered).
- **Databases:** None.
- **Design tools:** None.
- **Other technologies:** ENSv2 (`ensdomains/contracts-v2`), viem, wagmi, TanStack Query, Framer Motion, Lenis, tsx, Anvil, Vercel, Hats Protocol and Safe (adapters, fork-tested), Claude Code.

### ENS prize — ease of use (1–10)

Suggested 6: EAC's design and the `_getRoles` hook are clean, but anyId vs resource, token-ID regeneration and the beta's source commit were only learned from the source. *(Record the rating actually given here.)*

### ENS prize — additional feedback for the sponsor

Condensed from [`feedback/ens.md`](feedback/ens.md) and [`feedback/ens-pitch-3.md`](feedback/ens-pitch-3.md):

```
From building a custom subname registry on the ENSv2 beta (Sepolia):

1. EAC exposes role holder counts, not identities. A contract can't act on "whoever holds role X on the parent". We worked around it with stored team pointers. An optional enumerable-holders extension, or a documented "delegate a role to a contract that vouches for members" pattern, would help.
2. _getRoles is the right extension hook (PermissionedRegistry already overrides it for approved operators), but it's internal and nothing says it's a stable extension surface across releases. Please state which internal hooks are supported for subclassing.
3. hasRoles isn't virtual, so a subclass can make writes cheaper (a lazy _checkRoles) but views always pay the full _getRoles. Making hasRoles overridable would let views use the same short-circuit.
4. Public hasRoles/roles/grantRoles take an anyId, while internal _checkRoles/_getRoles take a resource. Easy to mix up when subclassing; one paragraph on anyId vs token ID vs resource would save hours.
5. Token IDs regenerate on every grant/revoke, while EAC resources only change on unregister/expiry. A deliberate protection, but surprising for integrators who store token IDs. Worth calling out in the registry docs.
6. A name can only receive admin role bits at registration; later grantRoles can only add regular roles (_getSettableRoles >> 128). We found this by reading the source; it belongs in the role-model docs.
7. It wasn't obvious which contracts-v2 commit matches the beta deployment. We pinned 48b3e2d and confirmed it behaviourally. Publishing the commit hash next to the beta addresses would help.
8. viem's built-in Universal Resolver address targets a different deployment than the beta, so we had to override it. A note in the beta docs would help.
```
