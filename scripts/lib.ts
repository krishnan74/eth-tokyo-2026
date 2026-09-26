// Shared config for setup.ts and demo.ts.
//
// Addresses are the ENSv2 beta deployment on Sepolia (ETHOnline 2026), verified behaviourally on
// 2026-09-26 — see docs/plan.md. NOT production ENS.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  createPublicClient, createWalletClient, http, keccak256, toHex, parseAbi,
  type Abi, type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

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

export const ALL_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111n;
export const ROLE_RENEW = 1n << 16n;
export const ROLE_SET_SUBREGISTRY = 1n << 20n;
export const TEAM_RESOURCE = 1n;
export const ROLE_MEMBER = 1n;
export const ZERO = "0x0000000000000000000000000000000000000000" as Address;

export const labelId = (label: string) => BigInt(keccak256(toHex(label)));

/** `--rpc <url>` targets a local anvil fork instead of Sepolia. */
const rpcFlag = process.argv.indexOf("--rpc");
export const RPC = rpcFlag > 0 ? process.argv[rpcFlag + 1] : need("SEPOLIA_RPC_URL");
export const FORK = rpcFlag > 0;
export const WRITE = process.argv.includes("--write") || FORK;

export function need(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`${k} unset — see .env.example`);
  return v;
}
const key = (k: string) => (need(k).startsWith("0x") ? need(k) : `0x${need(k)}`) as Hex;

// On a fork, viem must not use the chain's own Universal Resolver either.
const chain = { ...sepolia, contracts: { ...sepolia.contracts,
  ensUniversalResolver: { address: ENS.universalResolver, blockCreated: 0 } } };
const transport = http(RPC);
export const pub = createPublicClient({ chain, transport });
export const operator = createWalletClient({ account: privateKeyToAccount(key("OPERATOR_PRIVATE_KEY")), chain, transport });
export const outsider = createWalletClient({ account: privateKeyToAccount(key("OUTSIDER_PRIVATE_KEY")), chain, transport });

export function artifact(name: string): { abi: Abi; bytecode: Hex } {
  const j = JSON.parse(readFileSync(`out/${name}.sol/${name}.json`, "utf8"));
  return { abi: j.abi, bytecode: j.bytecode.object };
}

/** Deployed addresses. Sepolia and fork runs keep separate files so a rehearsal never pollutes the real book. */
const BOOK = FORK ? "deployments/fork.json" : "deployments/sepolia.json";
export type Book = {
  parent?: Address; cascade?: Address; team?: Address; attacker?: Address;
  /** Earlier CascadeSubregistry/TeamRegistry deployments, replaced by `setup --redeploy`. */
  retired?: { cascade: Address; team: Address; at: string }[];
  txs: Record<string, Hex>;
};
// A fork of Sepolia already contains the real deployment, so a fresh fork starts from the Sepolia book.
export const loadBook = (): Book => {
  const src = existsSync(BOOK) ? BOOK : FORK && existsSync("deployments/sepolia.json") ? "deployments/sepolia.json" : null;
  return src ? JSON.parse(readFileSync(src, "utf8")) : { txs: {} };
};
export const saveBook = (b: Book) => writeFileSync(BOOK, JSON.stringify(b, null, 2) + "\n");

export const explorer = (hash: string) => (FORK ? `(fork) ${hash}` : `https://sepolia.etherscan.io/tx/${hash}`);

export const REGISTRAR_ABI = parseAbi([
  "function isAvailable(string) view returns (bool)",
  "function getRegisterPrice(string,uint64,address) view returns (uint256 base, uint256 premium)",
  "function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)",
  "function commit(bytes32)",
  "function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns (uint256)",
]);
export const ERC20_ABI = parseAbi([
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function mint(address,uint256)",
]);
export const REGISTRY_ABI = parseAbi([
  "function getSubregistry(string) view returns (address)",
  "function getResolver(string) view returns (address)",
  "function hasRoles(uint256,uint256,address) view returns (bool)",
  "function roles(uint256,address) view returns (uint256)",
]);
