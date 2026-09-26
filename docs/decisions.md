# Decisions

## 1. Stored team pointer + live parent check (instead of discovering the holder)

- **Context:** the plan had the fallthrough "look up who holds the requested role on the parent resource". EAC stores `_roles[resource][account]` plus a 4-bit count per role; it cannot list holders.
- **Decision:** `CascadeSubregistry.team` names the candidate; the parent's grant to it and `team.isMember(caller)` are read live on every check. (Originally in a `_checkRoles` override reading `parent.hasRoles`; since decision 4, in `_getRoles` reading `parent.roles`.) Alternatives considered: team contract *owns* the parent name (discoverable via `getOwner`, one team per name); a parent registry that tracks holders via `_onRolesGranted`/`_onRolesRevoked` (modifies two contracts). User chose this option.
- **Consequences:** parent registry stays stock ENSv2. The pointer and the grant are set separately, but the grant remains the authority: revoke it and the path closes (tested). Raised as design question 1 for the ENS team.

## 2. Neutral org name, stock parent registry

- **Context:** reuse `perjury.eth` (faster) vs a neutral name.
- **Decision:** register `acme-corp.eth` with a freshly deployed, unmodified `PermissionedRegistry` as its subregistry; `devops.acme-corp.eth` is the team-governed name.
- **Consequences:** the only non-stock registry in the chain is `CascadeSubregistry`.

## 3. Denied writes are sent, not simulated

- **Context:** a simulated revert is a claim; a mined failed tx is evidence.
- **Decision:** `demo.ts` sends the outsider's writes with a fixed 200k gas limit so rejections land on Etherscan as failed transactions.
- **Consequences:** costs a little testnet gas per run.

## 4. Fallthrough moves from `_checkRoles` to `_getRoles`

- **Context:** the audit pointed out that EAC documents `_getRoles` as the hook for injecting role logic at read time, and `PermissionedRegistry` already uses it for approved operators. Overriding only `_checkRoles` left the public `hasRoles` disagreeing with writes.
- **Decision:** override `_getRoles`: for non-root resources, add the parent's regular-role grant to `team` when the account is a member. Admin bits masked; root never inherited. `nativeRoles()` added for the stock-only view.
- **Consequences:** every consumer agrees (writes, `hasRoles`, `roles`, `explain`). Cost: every non-root lookup can make two external calls, including for native owners (≈2.3k gas locally). Requires a redeploy; `devops` repointed, old contracts retired.

## 5. Gas-capped low-level STATICCALLs, no reentrancy guard

- **Context:** the audit asked for a gas stipend and reentrancy protection on `isMember()`.
- **Decision:** both external calls use `staticcall{gas: cap}` with a return-length check (`isMember` 30k, parent `roles` 50k). No reentrancy guard: the calls run in view context, so the callee cannot change state, and write paths check before any effect.
- **Consequences:** `try/catch` was rejected after a test showed a 1-byte return would revert every check on the registry.

## 6. Mutable Token ID concern: resolved by reading the parent live (option 1)

- **Context:** the audit worried the stored `team` pointer escapes ENSv2's invalidation when the parent changes hands.
- **Decision:** no new code; the pointer confers nothing without the parent's grant, which is read live from the parent's current EAC resource. Demo step 8 and three tests prove re-issue and expiry invalidate it; transfer keeps it, as it does every delegate's grant in stock ENSv2.
- **Consequences:** the audit's premise (token-ID changes on ownership change) was corrected in `qa.md`: token IDs regenerate on role changes; the EAC resource changes on unregister/expiry.

## 7. The UI signs on its server, and only locally

- **Context:** the demo needs two signers (operator, outsider) whose keys must not reach a browser; a viewer's own wallet can't create subnames or grant membership.
- **Decision:** Next.js route handlers sign with the same `.env` keys as the terminal demo and return tx hashes; the browser reads via wagmi and waits for receipts itself. Writes are enabled only under `next dev` or `CASCADE_UI_WRITES=1`.
- **Consequences:** a public deployment is read-only by default. Letting a visitor's wallet play the outsider (with server-side operator actions) is a possible later step, not built.

## 8. One shared core for terminal and UI

- **Context:** the UI spec requires that the "explain() matches the write path" claim can't silently diverge between two consumers.
- **Decision:** `core/cascade/` holds addresses, ABIs (generated from the Foundry build), the three-check chain with its short-circuit, agreement check and cost numbers. `scripts/demo.ts` imports it for its checks; the UI imports it everywhere.
- **Consequences:** `npm run gen` must follow a contract change or redeploy; `generated.ts` is committed so the UI builds without Foundry.
