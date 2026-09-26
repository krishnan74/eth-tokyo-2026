# Evidence

Everything here was run on Sepolia against the ENSv2 beta deployment (ETHOnline 2026), not production ENS, and not a simulator unless stated. The latest demo log is [`demo-sepolia-20260926T0032Z.log`](../evidence/demo-sepolia-20260926T0032Z.log); `npm run demo -- --recap` replays it.

## Deployed contracts (current)

| Contract | Address | Source |
|---|---|---|
| Org registry for `acme-corp.eth` | [`0xa27742aead8ca8baa8ff0a97754ac1736741e126`](https://sepolia.etherscan.io/address/0xa27742aead8ca8baa8ff0a97754ac1736741e126) | stock `PermissionedRegistry` from `ensdomains/contracts-v2@48b3e2d`, unmodified |
| `CascadeSubregistry` for `devops.acme-corp.eth` | [`0x2f15c12d21d7561433ddc6f7b856e9f0e4455e13`](https://sepolia.etherscan.io/address/0x2f15c12d21d7561433ddc6f7b856e9f0e4455e13) | [`contracts/src/CascadeSubregistry.sol`](../contracts/src/CascadeSubregistry.sol) (`_getRoles` version) |
| `TeamRegistry` | [`0x11ddfcb62670f0608d7cbc5b61e4470e0c7472bb`](https://sepolia.etherscan.io/address/0x11ddfcb62670f0608d7cbc5b61e4470e0c7472bb) | [`contracts/src/TeamRegistry.sol`](../contracts/src/TeamRegistry.sol) |
| `AlwaysTrueTeam` (demo fixture — the attacker's contract) | [`0xaa735fc88e25f7d846010469ee75f287c8ec20c1`](https://sepolia.etherscan.io/address/0xaa735fc88e25f7d846010469ee75f287c8ec20c1) | [`contracts/src/demo/AlwaysTrueTeam.sol`](../contracts/src/demo/AlwaysTrueTeam.sol) |

Retired (replaced by `setup --redeploy`; `devops` no longer points at them):

- `CascadeSubregistry` [`0xa6e5cf2aa3adaad2cee1d060e4bd4bc64b693b22`](https://sepolia.etherscan.io/address/0xa6e5cf2aa3adaad2cee1d060e4bd4bc64b693b22), `TeamRegistry` [`0x1a3dc7660515706ceec8409ff179c5fcc2e1b881`](https://sepolia.etherscan.io/address/0x1a3dc7660515706ceec8409ff179c5fcc2e1b881) — retired 2026-09-26

## Roadmap v2 (branch `roadmap/full-rebac`, separate tree `acme-labs.eth`)

Addresses, setup and smoke transactions, the browser run and gas are in [`roadmap-v2.md`](roadmap-v2.md#5-evidence-sepolia) (generated from `deployments/sepolia-v2.json`). None of it touches the contracts below.

## Setup transactions

| Step | Tx |
|---|---|
| deploy PermissionedRegistry | [`0x990e4db9…`](https://sepolia.etherscan.io/tx/0x990e4db97364f666b10cfa9de87532c6e49f7d3e911e397c5221288ad5100e93) |
| deploy CascadeSubregistry | [`0xb6a78671…`](https://sepolia.etherscan.io/tx/0xb6a7867148533389e2e8d2265fc591c6a71e0fb414bc66b9ee1411c74116ac1e) |
| deploy TeamRegistry | [`0xd0e19008…`](https://sepolia.etherscan.io/tx/0xd0e190084983d58142c3c6205f82c73e0dfc3ca366bb75663f33b9a01bcdcdab) |
| usdc approve | [`0xc058f9a1…`](https://sepolia.etherscan.io/tx/0xc058f9a12d07bc193e5702bedd8f32eca95e9dd9a09a3259fd2de04cb2102395) |
| commit | [`0x513f7381…`](https://sepolia.etherscan.io/tx/0x513f73812748b05f5433f990cdb26c67b090967b84cfe597a030f076e34e93e9) |
| register acme-corp.eth | [`0x6d0f2e0d…`](https://sepolia.etherscan.io/tx/0x6d0f2e0d67c367655df33da95b4c970c1379b662aacfab8793ceae0625df5eef) |
| register devops | [`0x89c285dc…`](https://sepolia.etherscan.io/tx/0x89c285dc0eb95b65c2a3c95174ff7090679ec1a8edbc10c30ed72d3aadbee56e) |
| grant team SET_SUBREGISTRY | [`0xa0e750b5…`](https://sepolia.etherscan.io/tx/0xa0e750b51db3f9ce78d7369a03ee0ceec11d4b624e4a726a31e1dbf4f423e7c8) |
| setParent | [`0x1ccd11ef…`](https://sepolia.etherscan.io/tx/0x1ccd11ef00549947bf298dbc3f6652a8a9dc01129c853bcdcfd82234bdb17bed) |
| setTeam | [`0x51319eea…`](https://sepolia.etherscan.io/tx/0x51319eea177045b992a09136073669fbaeb6998475e33ce74ba501ae6e9b3f53) |
| repoint devops subregistry | [`0xbae343c1…`](https://sepolia.etherscan.io/tx/0xbae343c119e2c8e8a73f56a341ec148773505d10c96ebea1c32fbe3fe6dd4b72) |
| revoke retired team 0x1a3dc7 | [`0x1a77eb19…`](https://sepolia.etherscan.io/tx/0x1a77eb19da6c2a37dc95cce1d4988711c331eb24e50c8255a66178e4f4fc4f08) |
| deploy AlwaysTrueTeam | [`0x1d49ef55…`](https://sepolia.etherscan.io/tx/0x1d49ef552a2603fe4f0b7c48b5a1909b73b5b18456ba7f278a04ef2e7d009271) |

## Live demo run — child `svc-muhnnzxl.devops.acme-corp.eth`, 2026-09-26T00:36:03Z

| Step | Status | Gas | Tx |
|---|---|---|---|
| register subname | success | 165133 | [`0xf712ac3a…`](https://sepolia.etherscan.io/tx/0xf712ac3aacc6c7982a23455159d503def7e41a28e7f607d5fdcd6053ec5a015f) |
| write as non-member | reverted | 69921 | [`0xfe8a723d…`](https://sepolia.etherscan.io/tx/0xfe8a723d12430e7e56cbed2ccbf3cc82895018405cc3059eed5ba3c49b6ccb91) |
| grant MEMBER | success | 74504 | [`0x38d3414d…`](https://sepolia.etherscan.io/tx/0x38d3414db11ddebec87a6c096824ab42c07495eb40384138139f92bb10061579) |
| write as member | success | 91946 | [`0x2e3d264e…`](https://sepolia.etherscan.io/tx/0x2e3d264ed6e8eea34345377fa61c0080d932f0a6e10593b73e5fde1e80adcaa2) |
| revoke MEMBER | success | 32196 | [`0x285280d5…`](https://sepolia.etherscan.io/tx/0x285280d5e55f34237098d7eb8d8350cf7c30666c37389ebe6f927063c3c1ecbd) |
| write after revoke | reverted | 69921 | [`0x014d5bbb…`](https://sepolia.etherscan.io/tx/0x014d5bbbb307848953ad8baedfb9466d5de3325298d53a3a24d3f9def44e94bb) |
| outsider setTeam(AlwaysTrueTeam) | reverted | 25163 | [`0x885844b7…`](https://sepolia.etherscan.io/tx/0x885844b7e0dd83ea2273a43c2d1d6bc493112fa54fd2617f28c390bed644bf99) |
| operator setTeam(wallet) | reverted | 27765 | [`0x1b3f2d3f…`](https://sepolia.etherscan.io/tx/0x1b3f2d3fbbd955941a05e95c3a658415c7d56a5025b922d0e82c27ef55cedfe1) |
| grant MEMBER (step 8) | success | 74504 | [`0xf754305c…`](https://sepolia.etherscan.io/tx/0xf754305cca2cb17ae8fd99e19d10a59b5bf502665f2a5b3bc64ea1da1d1830ea) |
| unregister devops | success | 45549 | [`0xa903fc10…`](https://sepolia.etherscan.io/tx/0xa903fc107dab5ae58b68115d1ea54a89b6f30df72f6bc2fdcfc2e96bed0fb70d) |
| re-register devops | success | 127705 | [`0x676fb172…`](https://sepolia.etherscan.io/tx/0x676fb172574405d98b9aa9124a995dd068dfb78298362691387b3b5e59a995c8) |
| write after parent re-issue | reverted | 61315 | [`0x3960ae00…`](https://sepolia.etherscan.io/tx/0x3960ae006216adfa1df92eea43cbe2222ff4f9acfb8210a799cacc8d1bfd1fc0) |
| restore: re-grant team | success | 104372 | [`0x4f43d5d2…`](https://sepolia.etherscan.io/tx/0x4f43d5d2770c9fc4ed095612175ffa43b3a4d151f8c2ec66f4ab839bcfd4402f) |
| restore: revoke MEMBER | success | 32196 | [`0x3c2c4570…`](https://sepolia.etherscan.io/tx/0x3c2c45709aea31c8075a3de67034ac17942d2f5632c02f298dd10ff12a585339) |

Revert reasons (decoded from a simulation before each refused tx was sent): step 6 `EACUnauthorizedAccountRoles`, step 7 `TeamNotContract`. The raw log also shows each write's per-check reads and `explain()` agreement.

## Hierarchy check (read-only, Sepolia)

- `ethRegistry.getSubregistry("acme-corp")` → `0xa27742aead8ca8baa8ff0a97754ac1736741e126` (org registry).
- `orgRegistry.getSubregistry("devops")` → `0x2f15c12d21d7561433ddc6f7b856e9f0e4455e13` (current CascadeSubregistry).
- Universal Resolver `findResolver` succeeds for `acme-corp.eth`, `devops.acme-corp.eth` and demo children (checked against the first deployment; the subnames inherit `acme-corp.eth`'s resolver).

## Gas

- Sepolia, current contract: outsider write allowed via the team **91,946**; denied (full check) **69,921**; denied after parent re-issue (no team grant, member not consulted) **61,315**.
- Local Foundry, like-for-like warm writes (`test_gas_nativeVsFallthrough`): native owner 73,069 vs via team 75,382. Native owners also pay for the hook's external calls.
- External call caps: `isMember` 30,000, parent `roles` 50,000.

## Web UI run (Sepolia, 2026-09-26)

The guided walkthrough was clicked through in headless Chrome against Sepolia: create → write (reverted, `EACUnauthorizedAccountRoles`) → grant → write (success) → revoke → write (reverted) → hijack (reverted, `EACUnauthorizedAccountRoles`). Every step matched its expected result (checked by the script). The captured screenshots (after steps 2, 4 and 7) show the three checks agreeing with `explain()`; the script did not assert agreement on every step. The UI's transactions are on the outsider's and operator's address pages: [outsider](https://sepolia.etherscan.io/address/0xF4ff37B96BF5474F8d2F58ABfB9F61F5A9629Fa8), [operator](https://sepolia.etherscan.io/address/0xDcbe075a907960951Cd4df379BB21461097eEa91).

## Current web UI (ENS Drive shared-drive view)

- Clicked through on an **anvil fork of Sepolia**: all seven actions as expected, "Who has access" correct after each, every action's `cast run` trace decoded, theme defaults to light, no console errors, no overflow at 400px.
- On **live Sepolia**, the Reset action removed the outsider left in the group from a pitch run — [`0x24e1f9c4…`](https://sepolia.etherscan.io/tx/0x24e1f9c442a689e317a57546c823a54db03ca42df94aa837e5d8bfc0967c7201) — and its trace was replayed with `cast run` (the full replay failed once on the free RPC; the `--quick` fallback exists for that).
- Not yet: a full seven-action click-through of the drive UI on live Sepolia.

## Tests (local Foundry, not Sepolia)

`forge test` — 17/17 passing. Coverage by audit item is in [`remediation.md`](remediation.md).
