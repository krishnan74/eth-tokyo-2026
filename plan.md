# Cascade v2 — Quick Demo Implementation Plan

**Scope:** the one-hop fallthrough only. No off-chain computation, no relayer, no ProveKit. Every step below is native EAC plus one new extension point. This is deliberate — see "What this demo is not" at the bottom before you start, and keep it that way while you build.

---

## 1. The mechanism, restated as an implementation spec

1. A **team contract** is deployed. It is itself a standard EAC-governed resource — a small, fixed admin set can grant/revoke a `MEMBER` role on it, using native EAC, unmodified.
2. The team contract's address is granted **`ROLE_SET_SUBREGISTRY`** on `infra.acme.eth` — the role that governs creating/managing subnames under that name. This is a completely ordinary EAC grant; nothing about granting a role to a contract instead of a wallet is new (a Safe already does this today).
3. A **custom registry** manages `infra.acme.eth`'s subnames — it's a `PermissionedRegistry` subclass. Its role-check function is overridden with exactly one addition: if the native two-location check (resource itself, or `ROOT_RESOURCE`) fails, look up who holds the requested role on the *parent* resource. If that holder is a contract, call a fixed interface function on it (`isMember(address)`) instead of reverting immediately.
4. That's the entire new surface area. Steps 1 and 2 are unmodified EAC. Step 3's fallthrough call is the one thing this project actually contributes.

---

## 2. Contracts to write

| Contract | What it does | New code, or native EAC? |
|---|---|---|
| `TeamRegistry` | Small EAC-governed resource. Admins grant/revoke `MEMBER` role on member addresses. Exposes `isMember(address) view returns (bool)`. | Mostly native EAC (inherit the pattern, don't reinvent role storage) — the only bespoke part is the `isMember` view wrapper. |
| `CascadeSubregistry` | `PermissionedRegistry` subclass managing `infra.acme.eth`'s subnames. Overrides the role-check path with the parent-fallthrough logic described above. | This is the one genuinely new contract. Keep it small — one overridden function, not a rewrite of the base. |
| (existing) `infra.acme.eth`'s own registry | Where `TeamRegistry`'s address is granted `ROLE_SET_SUBREGISTRY`. | Fully native — no new code, just a grant transaction. |

**Do not build a general "relationship engine."** `CascadeSubregistry`'s fallthrough should call exactly one fixed interface (`isMember`) — not a pluggable resolver, not a configurable relation type. That generality is v1's job, not this demo's.

---

## 3. Build order, time-boxed

**Block 1 — confirm the extension point works at all (do this first, before writing anything else).**
Deploy a minimal `PermissionedRegistry` subclass on Sepolia that overrides nothing yet — just confirm it behaves identically to the base contract for an ordinary grant/check. This answers the single highest-risk unknown (can this actually be subclassed the way the docs describe) before any real logic is written on top of it.

**Block 2 — `TeamRegistry`.**
Deploy it, grant `MEMBER` to two or three test addresses, confirm `isMember()` returns correctly for each. This is low-risk — it's not doing anything EAC doesn't already do natively.

**Block 3 — grant `TeamRegistry` the role on `infra.acme.eth`.**
One transaction: `ROLE_SET_SUBREGISTRY` → `TeamRegistry`'s address, on `infra.acme.eth`'s own registry, on native EAC. Confirm the grant is visible via a normal role-check call before moving on.

**Block 4 — the fallthrough itself, in `CascadeSubregistry`.**
Override the role-check function: try native check → on failure, fetch the role-holder on the parent resource → if it's a contract, low-level call `isMember(msg.sender)` → return its result. Wrap the external call in a try/catch so a holder that *isn't* a contract (or doesn't implement the interface) fails safely back to a plain revert, not an unrelated error.

**Block 5 — the failure/success/revocation sequence, scripted.**
Write a script (Hardhat/Foundry, whichever you're already using) that runs, in order: (a) create a brand-new subname under `infra.acme.eth`, (b) attempt a write from a non-member address — expect revert, (c) grant that address `MEMBER` on `TeamRegistry`, (d) repeat the same write — expect success, (e) revoke `MEMBER`, (f) repeat the same write again — expect revert. This script *is* your demo's technical backbone — get it fully scripted and reliable before touching any UI.

**Block 6 — the `explain()` view function.**
A read-only function that walks the same two lookups the write path uses (local check, then parent-holder check, then membership) and returns a short structured result — not a separate reimplementation, literally reuse the same internal checks so it can never drift out of sync with what the write path actually decided.

**Block 7 — UI, only after Block 5 is solid.**
Whatever wrapper you want on top (a simple page showing the sequence, or just a terminal walkthrough) — do this last. A working, scripted contract sequence with no UI is a complete demo. A polished UI on top of a flaky contract sequence is not.

---

## 4. The demo script itself

Run it in this order, live:

1. Show `infra.acme.eth`'s registry. Point out `TeamRegistry`'s address holds `ROLE_SET_SUBREGISTRY` — native EAC, nothing new yet.
2. Create a brand-new subname under it live. Attempt a write from an address that's not on the team — **fails**, native EAC revert, no fallthrough involved because the check never gets that far without a reason to.
3. Grant that address `MEMBER` on `TeamRegistry` — one ordinary transaction.
4. Attempt the identical write again — **succeeds**, on a subname that didn't exist when the grant happened. Call `explain()` here and show the two-step reasoning it returns.
5. Revoke `MEMBER`. Attempt the same write a third time — **fails immediately**, live, no delay, nothing cached.

---

## 5. Answer these two questions before you present it — you'll be asked again

- **"Is this a shared resolver?"** No — say why directly: this governs `ROLE_SET_SUBREGISTRY`, a registry-level action (creating/managing subnames), not resolver-level records. A shared resolver grant couldn't do what step 2 above does.
- **"Is this a tokenized subname?"** No — the subname's ERC1155 token never moves. Joining/leaving the team is a role write on `TeamRegistry`, not a transfer of anything.

Have both answers ready verbatim, not reconstructed live — you already worked them out once, don't make yourself redo it under pressure.

---

## 6. What this demo is not — say this before anyone finds it themselves

- **One hop only.** The fallthrough checks the immediate parent's role holder — nothing further up the tree. A grant sitting two levels above a new subname will not be found. Named limitation, not a bug to discover live.
- **No off-chain computation, no proof, no relayer.** This is the whole point of choosing v2 for a quick demo — say it as a feature of this version, not an apology.
- **`TeamRegistry` itself inherits EAC's native 15-holder cap.** Fine for a small, stable team; not a general org chart.
- **No gas numbers yet — get real ones before anyone asks.** Two extra `SLOAD`s per fallthrough is cheap in principle; benchmark it on Sepolia during Block 4, not after.

---

## 7. Fallback if something breaks close to demo time

If the live scripted sequence (Block 5) becomes unreliable under time pressure, the acceptable fallback is a **pre-recorded run of the exact same script**, shown alongside the actual deployed contract addresses and a live Etherscan link so it can be verified as real, not staged. Do not fake the *result* of any step — only the *live execution* is allowed to be pre-recorded, and say so plainly if asked.
