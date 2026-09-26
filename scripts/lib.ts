// Node-side config for setup.ts and demo.ts: env, clients, deployment book, Foundry artifacts.
//
// Addresses are the ENSv2 beta deployment on Sepolia (ETHOnline 2026), verified behaviourally on
// 2026-09-26 — see docs/plan.md. NOT production ENS.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  createPublicClient, createWalletClient, http, parseAbi,
  type Abi, type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

// Addresses, names, roles and ABIs live in the shared core so the web UI reads exactly the same ones.
export {
  ALL_ROLES, ENS, ORG, REGISTRY_ABI, ROLE_MEMBER, ROLE_RENEW, ROLE_SET_SUBREGISTRY, TEAM_LABEL, TEAM_RESOURCE, ZERO, labelId,
} from "../core/cascade/index.js";
import { ENS } from "../core/cascade/index.js";

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
