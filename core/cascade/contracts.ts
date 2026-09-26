// Addresses, names, roles and ABIs shared by the terminal demo (scripts/) and the web UI (web/).
// Browser-safe: no Node APIs here.
//
// ENS addresses are the ENSv2 beta deployment on Sepolia (ETHOnline 2026), verified behaviourally on
// 2026-09-26 — see docs/plan.md. NOT production ENS.
import { keccak256, parseAbi, toHex, type Address } from "viem";

export { CASCADE_ABI, SEPOLIA, TEAM_ABI } from "./generated";

export const ENS = {
  ethRegistry: "0x1d78834d97c1d7b1a38c1dedbd1a287cfed3971e",
  ethRegistrar: "0x7d1b7f586a62ac3f54b9a396849757814283270b",
  publicResolver: "0xf9de4979ddb290baf5b760d0e788125017bc33f6",
  universalResolver: "0xd26f2040d083af1cd2962ba303f4bea0c4faf142",
  labelStore: "0xD7351F76866123A7E49381F38a30a96AdBa7E855",
  mockUsdc: "0xcbfd80f74375c54e545af34788ff465f96f66f05",
} as const satisfies Record<string, Address>;

export const ORG = "acme-corp"; // acme-corp.eth
export const TEAM_LABEL = "devops"; // devops.acme-corp.eth, governed by TeamRegistry
export const TEAM_NAME = `${TEAM_LABEL}.${ORG}.eth`;

export const ALL_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111n;
export const ROLE_RENEW = 1n << 16n;
export const ROLE_SET_SUBREGISTRY = 1n << 20n;
export const TEAM_RESOURCE = 1n;
export const ROLE_MEMBER = 1n;
export const ZERO = "0x0000000000000000000000000000000000000000" as Address;
/** What the outsider's write sets a subname's subregistry to. Any address works; the write being allowed is the point. */
export const PLACEHOLDER = "0x000000000000000000000000000000000000dEaD" as Address;

export const labelId = (label: string) => BigInt(keccak256(toHex(label)));
export const etherscanTx = (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`;
export const etherscanAddress = (a: string) => `https://sepolia.etherscan.io/address/${a}`;

/** The slice of a stock PermissionedRegistry both demos read. */
export const REGISTRY_ABI = parseAbi([
  "function getSubregistry(string) view returns (address)",
  "function getResolver(string) view returns (address)",
  "function hasRoles(uint256,uint256,address) view returns (bool)",
  "function roles(uint256,address) view returns (uint256)",
]);

/** Registry role names, from RegistryRolesLib (plus CascadeSubregistry's ROLE_SET_TEAM). */
export const ROLE_NAMES: [bigint, string][] = [
  [1n << 0n, "REGISTRAR"], [1n << 4n, "REGISTER_RESERVED"], [1n << 8n, "SET_PARENT"], [1n << 12n, "UNREGISTER"],
  [1n << 16n, "RENEW"], [1n << 20n, "SET_SUBREGISTRY"], [1n << 24n, "SET_RESOLVER"], [1n << 36n, "SET_URI"],
  [1n << 40n, "SET_TEAM"], [1n << 120n, "CAN_NAME"], [1n << 124n, "UPGRADE"],
];

/** Decode a role bitmap into role names; admin bits (upper 128) are reported with an _ADMIN suffix. */
export function roleNames(bitmap: bigint): string[] {
  const out: string[] = [];
  for (const [bit, name] of ROLE_NAMES) {
    if (bitmap & bit) out.push(name);
    if (bitmap & (bit << 128n)) out.push(`${name}_ADMIN`);
  }
  if (bitmap & ((1n << 28n) << 128n)) out.push("CAN_TRANSFER_ADMIN");
  return out;
}
