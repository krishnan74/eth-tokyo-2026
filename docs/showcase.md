# Showcase copy

Ready-to-paste text for the ETHGlobal showcase (and anywhere else the project is summarised). Every claim here is backed by the code, the tests or a Sepolia transaction — see [`evidence.md`](evidence.md) and [`roadmap-v2.md`](roadmap-v2.md). The full form copy is in [`submission.md`](submission.md).

## Name

ENS Drive (powered by Cascade)

## Tagline (≤ 100 characters)

Google Drive–style sharing for ENS names: share a name with a team, not each subname with each person.

## The problem

ENSv2 already built the directory tree: every name can have its own registry, so names nest like folders (`orbit-dao.eth › protocol › vault`). What's missing is the sharing layer. ENSv2's Enhanced Access Control grants permissions one address on one name, in each folder's own registry, so there is no way to say "everyone on core-devs may manage every name under protocol, including tomorrow's." Teams either copy every member onto every name and registry, or route every action through a shared contract such as a Safe, where members stop acting as themselves.

## What it does

ENS Drive adds the missing permission layer to ENSv2 with Cascade, a relationship-based access control (ReBAC) rule built into ENSv2's own access control. A name shares a role with a team contract, like sharing a folder with a group, and the team's members inherit that role on every name below it, checked live on every call: up to three folders down, up to four teams per folder, and teams inside teams. Add someone to a team once and they can manage every name; remove them once and access is gone everywhere. Nothing is written to the names, and nothing ENSv2 does today is replaced.

The live demo is a shared-drive view on real ENSv2 contracts on Sepolia, for a fictional DAO, `orbit-dao.eth`. Its folder `protocol` holds three contract names. Drag a new contributor, `alex.orbit-dao.eth`, into core-devs and all three become editable; move them into the auditors, a team inside the security council that's shared a folder up, and they still can; switch off "sharing flows into subfolders" and they can't. After each action an "On-chain, just now" card says what the contracts checked, and "Behind the scenes" replays the transaction's call tree.

## How it's made

- **ENSv2 `PermissionedRegistry` subclass.** `CascadeSubregistryV2` overrides Enhanced Access Control's role lookup, `_getRoles` (the documented hook the stock registry already uses for approved operators), and its write check, `_checkRoles`. For any subname, an account's roles become its own grants plus the regular roles the names above grant any of its teams, if the account is a member. Admin roles and registry-wide roles are never inherited.
- **A lazy write check.** Own roles first (owners pay nothing extra), then one folder at a time, asking a team about membership only when its grant could help, and stopping as soon as the role is covered. A member's write went from 165,723 to 97,665 gas on Sepolia.
- **Each level proves the link.** A folder above counts only if it points back down to the one below, so a registry can't adopt a parent that doesn't claim it. Re-issuing or letting a name above expire ends its teams' authority automatically.
- **Teams are anything with `isMember`.** `TeamRegistry` (plain EAC), `NestedTeam` (teams of teams), and adapters for a Hats role and a Safe's owners, fork-tested against the real Hats and Safe.
- **Fail-closed external calls.** Every lookup is a read-only, gas-capped STATICCALL with bounded, length-checked returns, so a broken or hostile team contract can't block or escalate anything.
- **Proof.** 71 Foundry tests (unit, fuzz, invariants, a v1/v2 equivalence invariant, gas) and 3 Halmos symbolic proofs, including that the lazy check always agrees with the full union; live smoke runs and the demo on the ENSv2 beta on Sepolia, every step a real transaction.
- **Stack.** Solidity 0.8.26 + Foundry + Halmos on `ensdomains/contracts-v2@48b3e2d`; a TypeScript core shared by viem scripts and a Next.js 16 + wagmi web UI on Vercel, which signs with dedicated least-privilege keys and replays each transaction with Foundry's `cast run`.

## Links

- Live demo: https://ens-drive.vercel.app
- Source: https://github.com/krishnan74/eth-tokyo-2026 *(private for now)*
- Video: *(to record)*
