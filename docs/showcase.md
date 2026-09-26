# Showcase copy

Ready-to-paste text for the ETHGlobal showcase (and anywhere else the project is summarised). Every claim here is backed by the code, the tests or a Sepolia transaction — see [`evidence.md`](evidence.md).

## Name

ENS Drive (powered by Cascade)

## Tagline (≤ 100 characters)

Google Drive–style sharing for ENS names: share a name with a team, not each subname with each person.

## The problem

ENSv2 already built the directory tree: every name can have its own registry, so names nest like folders (`acme-corp.eth › devops › svc-api`). What's missing is the sharing layer. ENSv2's Enhanced Access Control grants permissions one address on one name, so there is no way to say "everyone on the devops team may manage every name under devops — including tomorrow's." Teams either copy every member onto every name and registry, or route every action through a shared contract such as a Safe, where members stop acting as themselves.

## What it does

ENS Drive adds the missing permission layer to ENSv2 with Cascade, a relationship-based access control (ReBAC) rule built into ENSv2's own access control. A parent name shares a role with a team contract — like sharing a folder with a group — and the team's members inherit that role on every subname under it, checked live on every call. Add someone to the team once and they can manage every name; remove them once and access is gone everywhere. Nothing is written to the names, and nothing ENSv2 does today is replaced: the MVP is deliberately one hop and one team per registry.

The demo is a minimal shared-drive view on real ENSv2 contracts on Sepolia: the `devops` folder is a name with its own registry, files are subnames, and dragging an address into the `devops-team` group makes every file editable. A "Behind the scenes" panel replays each transaction and shows the actual contract calls.

## How it's made

- **ENSv2 `PermissionedRegistry` subclass.** `CascadeSubregistry` overrides a single function, `_getRoles` — Enhanced Access Control's documented hook, which the stock registry already uses for approved operators. For any subname, an account's roles become its own grants plus the regular roles the parent registry grants a team contract, if the account is a member. Admin roles and registry-wide roles are never inherited.
- **A team roster on plain EAC.** `TeamRegistry` holds a `MEMBER` role per account and answers `isMember()`; it declares its interface through ERC-165.
- **Three independent facts gate every inherited write** — the parent's grant (stock ENSv2 registry), membership (TeamRegistry) and the registry's team pointer (guarded by a dedicated `ROLE_SET_TEAM`). Cut any one and access ends. Re-issuing the parent name ends the team's authority automatically.
- **Fail-closed external calls.** Both lookups are read-only, gas-capped STATICCALLs with length-checked returns, so a broken or hostile team contract can't block or escalate anything.
- **Proof.** 17 unit tests plus 5 fuzz tests and 5 invariants (sequence, view/write agreement, admin masking, pointer guard, broken teams, parent re-issue/expiry/transfer); an eight-step terminal demo and a web demo on the ENSv2 beta on Sepolia, every step a real transaction; each action's call tree replayed with Foundry's `cast run`.
- **Stack.** Solidity 0.8.26 + Foundry on `ensdomains/contracts-v2@48b3e2d`; a TypeScript core shared by a viem terminal demo and a Next.js 16 + wagmi web UI.

## Links to fill in at submission

- Live demo: *(not yet deployed publicly — the UI's transactions currently run locally)*
- Source: *(repository is private for now)*
- Video: *(to record)*
