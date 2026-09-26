# Submission form copy — ENS Drive (first draft)

Draft here, paste into the ETHGlobal form. **Field limits below are marked "confirm"** — check each against the live form before pasting; the ENS track text is quoted from the Tokyo 2026 prize page.

Every claim here is backed by [`evidence.md`](evidence.md), the tests, or a Sepolia transaction. Where something only ran on a local fork, it says so.

---

## Project name

ENS Drive

## Tagline / short description (limit: confirm — this draft is 95 characters)

Google Drive–style sharing for ENS names: share with a team, not each subname with each person.

## Description (limit: confirm)

ENSv2 already built the directory tree: every name can have its own registry, so names nest like folders (`acme-corp.eth › devops › svc-api`). What's missing is the sharing layer. ENSv2's Enhanced Access Control (EAC) grants permissions one address on one name, so there is no way to say "everyone on the devops team may manage every name under devops — including the ones we create tomorrow." Today a team either copies every member onto every name and registry, or routes every action through a shared contract such as a Safe, where members stop acting as themselves.

ENS Drive adds that permission layer with Cascade, a relationship-based access control (ReBAC) rule built into EAC itself. A parent name grants a role to a team contract — like sharing a folder with a group — and the team's members inherit that role on every subname under it, checked live on every call. Add someone to the team once and they can manage every name; remove them once and their access is gone everywhere. Nothing is written to the names, and nothing EAC does today is replaced: the only new contract is a subclass of ENSv2's own `PermissionedRegistry` that overrides one function.

The demo is a minimal shared-drive view on real ENSv2 beta contracts on Sepolia. The `devops` folder is `devops.acme-corp.eth`; files are its subnames; the `devops-team` group is a team contract. Drag an outsider into the group and every file becomes editable by them — the "Who has access" panel shows "Can edit · via devops-team" while "given directly" stays empty. Drag them out and every file locks again. An attempt to point the folder at an attacker's always-yes group is refused on-chain. After each action, a "Behind the scenes" panel replays the mined transaction and shows the actual contract calls.

What is live: the contracts and every demo action run on the ENSv2 beta on Sepolia, with transactions on Etherscan. What is not: the web UI's transactions run from a local server (the demo keys never leave it), so the hosted page is read-only; the MVP is deliberately one hop and one team per registry.

## How it's made (limit: confirm)

The core is one contract, `CascadeSubregistry` (`contracts/src/CascadeSubregistry.sol`), a subclass of ENSv2's `PermissionedRegistry` built against `ensdomains/contracts-v2@48b3e2d`, the source matching the ENSv2 beta on Sepolia. It overrides a single function: `_getRoles`, EAC's documented hook for adding role logic at read time, which the stock registry already overrides for approved operators. Because `_getRoles` is virtual, every permission check inside ENS's unmodified code — `_checkRoles`, `hasRoles`, `roles` — runs the new version. It returns the caller's own grants, plus, if the parent registry grants the team contract a role on this registry's label (read with `parent.roles(label, team)`) and the caller is a member (`team.isMember(caller)`), that role. Cascade doesn't add a check; it changes the answer to the one check ENS already runs.

The hard parts were making that safe. Admin role bits are masked off, so members can use a role but never grant it; nothing is inherited at the registry root, so registering names, upgrading, or changing the team stay native-only. Changing the team needs a dedicated root role, must point at a contract that declares the team interface through ERC-165, and emits an event. Both external lookups are read-only STATICCALLs with gas caps. A test showed that Solidity's `try/catch` does not catch undecodable return data — a team contract returning one byte would have reverted every permission check on the registry, including the owner's — so the calls are low-level with a length check and fail closed. Because the parent's grant is read against the parent's current EAC resource, re-issuing or letting the parent name expire ends the team's authority automatically. Our first version overrode `_checkRoles` instead; views then disagreed with writes, so we moved the logic into the hook and redeployed.

EAC can report how many accounts hold a role but not which ones, so the registry names its team with a pointer and treats the parent's grant as the authority: the pointer alone grants nothing. The team roster, `TeamRegistry`, is plain EAC with an `isMember` view.

17 Foundry tests cover the deny/grant/allow/revoke sequence, views agreeing with writes, masked admin bits, the pointer guard, hostile team contracts (always-yes, infinite loop, garbage return), and parent re-issue, expiry and transfer. The deployment and wiring on Sepolia — including registering `acme-corp.eth` through the ENSv2 beta registrar's commit–reveal — is a viem script. A shared TypeScript core feeds both an eight-step terminal demo and a Next.js 16 + wagmi web UI; the UI's "Behind the scenes" panel replays each transaction with Foundry's `cast run` (public Sepolia RPCs don't serve trace APIs) and decodes the call tree into names.

## Track: ENS — Best Use of ENSv2 ($6,000)

> "Use Enhanced Access Control, the shared, role-based permission system behind both registries and resolvers" · "deploy your own subname registry to tokenize and manage subnames under your own rules"

**ENSv2 is the product, not an add-on.** ENS Drive is a new permission layer inside ENSv2's Enhanced Access Control: a custom subname registry (`CascadeSubregistry`, a `PermissionedRegistry` subclass) that extends EAC through its own `_getRoles` hook so that a role granted to a team on a parent name is inherited by the team's members on every subname. It reads the parent registry's EAC grant and a team roster that is itself plain EAC. Without ENSv2's per-name registries and EAC there is nothing for it to extend.

**Built on ENSv2 (Sepolia):** `acme-corp.eth` was registered through the ENSv2 beta `ETHRegistrar` with its subregistry set to a stock `PermissionedRegistry`, which holds `devops` pointing at `CascadeSubregistry`. Contracts:
- Org registry (`acme-corp.eth`): `0xa27742aead8ca8baa8ff0a97754ac1736741e126`
- `CascadeSubregistry` (`devops.acme-corp.eth`): `0x2f15c12d21d7561433ddc6f7b856e9f0e4455e13`
- `TeamRegistry`: `0x11ddfcb62670f0608d7cbc5b61e4470e0c7472bb`

**Functional, no hard-coded values:** every state in the demo is read live from these contracts, and every action is a real transaction — including the refused ones, which are mined as failed transactions with decoded revert reasons. Transaction hashes for every setup step and a full demo run are in `docs/evidence.md`.

**Feedback from ENS:** we pitched it twice to the ENS team at the event; their feedback shaped the simpler UI and the contract-level "Behind the scenes" view.

## Challenges / what we learned (if the form asks)

- EAC tracks role holder counts, not identities, so "who holds this role on the parent?" is not answerable on-chain; a team pointer plus a live check of the parent's grant keeps the grant as the authority.
- Overriding `_checkRoles` made views disagree with writes; the documented `_getRoles` hook fixed it but means every lookup on a subname pays for two external reads (≈2,300 gas per write, native owners included, measured locally).
- `try/catch` doesn't catch undecodable return data; untrusted external calls needed low-level calls with a length check.
- ENSv2's token IDs change on every grant/revoke while EAC resources change only on unregister/expiry — understanding that split is what makes re-issue invalidation automatic.
- Public Sepolia RPCs don't serve `debug_traceTransaction`; real traces came from replaying fresh transactions with `cast run`.

## What's next (if the form asks)

- Several teams per role on one parent (devops edits, security revokes), then teams of teams and multi-hop inheritance up the name tree — each bounded and fail-closed.
- Existing on-chain rosters (a Hats role, a Safe's owners) as the team, through the one-function `isMember` interface.
- A public live demo where visitors connect their own wallet as the outsider.

## Known limitations

- One hop and one team per registry (MVP scope).
- For a team member, `hasRoles()` also reports the role on unregistered labels (writes there still revert).
- Inherited roles emit no events; indexers should call `hasRoles()`.
- ≈2,300 extra gas per write on subnames, native owners included (local measurement).
- ENSv2 beta on Sepolia, not production ENS; not audited; contracts not yet source-verified on Etherscan.

## Links — to fill before submitting

- **Repo:** `https://github.com/krishnan74/eth-tokyo-2026` — **currently private.** The ENS track requires "the code needs to be open source and accessible on Github"; make it public (and consider renaming it) before submitting.
- **Live demo:** **not yet deployed.** The ENS track requires "a link to a live demo". Options: a hosted read-only deployment of the UI (reads live, transactions disabled), or a public deployment where visitors connect their own wallet — decide before submitting.
- **Video:** to record — see [`demo-video.md`](demo-video.md).
- **Contracts:** the three Etherscan addresses above.
- **Submitted at commit:** *(fill in at submission)*.
