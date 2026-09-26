/**
 * Roadmap deployment: CascadeSubregistryV2 on its own name tree, separate from the live v1 demo.
 *
 *   npm run setup:v2                                  # Sepolia, simulate only
 *   npm run setup:v2 -- --write                       # Sepolia, send
 *   npm run setup:v2 -- --rpc http://127.0.0.1:8545   # anvil fork of Sepolia, sends
 *   npm run setup:v2 -- --write --redeploy            # replace CascadeSubregistryV2 under the same platform name (teams and grants kept)
 *
 * Nothing here touches acme-corp.eth, devops.acme-corp.eth or any v1 contract: it registers its own
 * name (acme-labs.eth) and deploys fresh contracts. Addresses go to deployments/sepolia-v2.json
 * (deployments/fork-v2.json on a fork), never to the v1 book. Idempotent, like setup.ts.
 *
 *   .eth registry ── acme-labs ──▶ OrgRegistry v2 (stock) ── platform ──▶ CascadeSubregistryV2 ── svc-api
 *        │ grant: security holds SET_RESOLVER on acme-labs        (level 2)
 *        └───────────────── OrgRegistry v2 │ grant: dev-team holds SET_SUBREGISTRY on platform   (level 1)
 *
 *   Teams on CascadeSubregistryV2 (depth 2):
 *     dev-team  — TeamRegistry                               (roadmap 1: many teams)
 *     security  — NestedTeam containing sre (a TeamRegistry)  (roadmap 2: teams of teams)
 *   security's grant sits two levels up, on acme-labs.eth itself (roadmap 3: multi-hop).
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { encodeDeployData, type Address, type Hex } from "viem";
import {
  ALL_ROLES, ENS, ERC20_ABI, FORK, REGISTRAR_ABI, REGISTRY_ABI, ROLE_RENEW, ROLE_SET_SUBREGISTRY, WRITE, ZERO,
  artifact, explorer, labelId, operator, pub,
} from "./lib.js";

export const ORG_V2 = "acme-labs";
export const FOLDER_V2 = "platform";
export const FILE_V2 = "svc-api";
export const ROLE_SET_RESOLVER = 1n << 24n;

export type BookV2 = {
  org?: Address; cascade?: Address; devTeam?: Address; sre?: Address; security?: Address;
  /** Earlier CascadeSubregistryV2 deployments, replaced by `--redeploy`. */
  retired?: { cascade: Address; at: string }[];
  txs: Record<string, Hex>;
};
export const BOOK_V2 = FORK ? "deployments/fork-v2.json" : "deployments/sepolia-v2.json";
export const loadBookV2 = (): BookV2 => {
  const src = existsSync(BOOK_V2) ? BOOK_V2 : FORK && existsSync("deployments/sepolia-v2.json") ? "deployments/sepolia-v2.json" : null;
  return src ? JSON.parse(readFileSync(src, "utf8")) : { txs: {} };
};
export const saveBookV2 = (b: BookV2) => writeFileSync(BOOK_V2, JSON.stringify(b, null, 2) + "\n");
/** Tx names in the book carry the deployment number after a redeploy, so earlier entries are never overwritten. */
export const txKey = (b: BookV2, name: string) => (b.retired?.length ? `${name} [deploy ${b.retired.length + 1}]` : name);

const op = operator.account.address;
const book = loadBookV2();
if (process.argv.includes("--redeploy") && WRITE && book.cascade && process.argv[1]?.endsWith("setup-v2.ts")) {
  (book.retired ??= []).push({ cascade: book.cascade, at: new Date().toISOString() });
  delete book.cascade;
  saveBookV2(book);
}
const YEAR = 31_536_000n;
const NO_REFERRER = `0x${"00".repeat(32)}` as Hex;
const step = (n: number, s: string) => console.log(`\n[${n}] ${s}`);

async function send(name: string, req: Parameters<typeof operator.writeContract>[0]) {
  const { request } = await pub.simulateContract({ ...req, account: operator.account } as never);
  if (!WRITE) return console.log(`    ${name}: simulates OK (not sent)`);
  const hash = await operator.writeContract(request as never);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${name} reverted: ${hash}`);
  book.txs[txKey(book, name)] = hash;
  saveBookV2(book);
  console.log(`    ${name}: ${explorer(hash)}`);
}

async function deploy(key: Exclude<keyof BookV2, "txs" | "retired">, contract: string, args: unknown[]) {
  if (book[key] && (await pub.getCode({ address: book[key]! }))) return console.log(`    ${contract} (${key}) already at ${book[key]}`);
  const { abi, bytecode } = artifact(contract);
  if (!WRITE) {
    await pub.estimateGas({ account: op, data: encodeDeployData({ abi, bytecode, args }) });
    return console.log(`    ${contract} (${key}): deploy simulates OK (not sent)`);
  }
  const hash = await operator.deployContract({ abi, bytecode, args });
  const r = await pub.waitForTransactionReceipt({ hash });
  book[key] = r.contractAddress!;
  book.txs[txKey(book, `deploy ${key}`)] = hash;
  saveBookV2(book);
  console.log(`    ${contract} (${key}) → ${r.contractAddress}  ${explorer(hash)}`);
}

const read = <T>(address: Address, abi: unknown, functionName: string, args: unknown[] = []) =>
  pub.readContract({ address, abi, functionName, args } as never) as Promise<T>;

async function main() {
  // Always deploy what the source says: out/ can hold a stale build (e.g. after a mutation test), and
  // the deploy reads bytecode from out/. Foundry must be on PATH (see CLAUDE.md).
  execFileSync("forge", ["build"], { stdio: ["ignore", "ignore", "inherit"] });
  console.log(`operator ${op}\nrpc      ${FORK ? "anvil fork" : "Sepolia"}  mode ${WRITE ? "WRITE" : "simulate"}\nbook     ${BOOK_V2}`);

  step(1, "contracts: OrgRegistry v2 (stock), CascadeSubregistryV2, dev-team, sre, security (NestedTeam)");
  await deploy("org", "PermissionedRegistry", [ENS.labelStore, op, ALL_ROLES]);
  await deploy("cascade", "CascadeSubregistryV2", [ENS.labelStore, op, ALL_ROLES]);
  await deploy("devTeam", "TeamRegistry", [[op]]);
  await deploy("sre", "TeamRegistry", [[op]]);
  await deploy("security", "NestedTeam", [[op]]);
  if (!WRITE) return console.log("\nlater steps depend on the deployments; re-run with --write.");
  const { org, cascade, devTeam, sre, security } = book as Required<BookV2>;
  const orgAbi = artifact("PermissionedRegistry").abi;
  const v2Abi = artifact("CascadeSubregistryV2").abi;
  const nestedAbi = artifact("NestedTeam").abi;

  step(2, `register ${ORG_V2}.eth (commit–reveal), subregistry = OrgRegistry v2`);
  const current = await read<Address>(ENS.ethRegistry, REGISTRY_ABI, "getSubregistry", [ORG_V2]);
  if (current.toLowerCase() === org.toLowerCase()) console.log("    already registered, subregistry = OrgRegistry v2");
  else {
    const available = await read<boolean>(ENS.ethRegistrar, REGISTRAR_ABI, "isAvailable", [ORG_V2]);
    if (!available) throw new Error(`${ORG_V2}.eth is taken and does not point at our registry (${current})`);
    const [base, premium] = await read<[bigint, bigint]>(ENS.ethRegistrar, REGISTRAR_ABI, "getRegisterPrice", [ORG_V2, YEAR, ENS.mockUsdc]);
    const bal = await read<bigint>(ENS.mockUsdc, ERC20_ABI, "balanceOf", [op]);
    if (bal < base + premium) await send("usdc mint", { address: ENS.mockUsdc, abi: ERC20_ABI, functionName: "mint", args: [op, base + premium] } as never);
    await send("usdc approve", { address: ENS.mockUsdc, abi: ERC20_ABI, functionName: "approve", args: [ENS.ethRegistrar, base + premium] } as never);
    const secret = `0x${randomBytes(32).toString("hex")}` as Hex;
    const c = await read<Hex>(ENS.ethRegistrar, REGISTRAR_ABI, "makeCommitment", [ORG_V2, op, secret, org, ENS.publicResolver, YEAR, NO_REFERRER]);
    await send("commit", { address: ENS.ethRegistrar, abi: REGISTRAR_ABI, functionName: "commit", args: [c] } as never);
    if (FORK) {
      await pub.request({ method: "evm_increaseTime" as never, params: [70] as never });
      await pub.request({ method: "evm_mine" as never, params: [] as never });
    } else {
      console.log("    waiting 70s for the commitment to age…");
      await new Promise((r) => setTimeout(r, 70_000));
    }
    await send(`register ${ORG_V2}.eth`, { address: ENS.ethRegistrar, abi: REGISTRAR_ABI, functionName: "register",
      args: [ORG_V2, op, secret, org, ENS.publicResolver, YEAR, ENS.mockUsdc, NO_REFERRER] } as never);
  }

  step(3, `OrgRegistry v2: parent pointer (for multi-hop) and ${FOLDER_V2} → CascadeSubregistryV2`);
  const [orgParent] = await read<[Address, string]>(org, orgAbi, "getParent");
  if (orgParent.toLowerCase() === ENS.ethRegistry.toLowerCase()) console.log("    parent already set");
  else await send("org setParent", { address: org, abi: orgAbi, functionName: "setParent", args: [ENS.ethRegistry, ORG_V2] } as never);
  const sub = await read<Address>(org, REGISTRY_ABI, "getSubregistry", [FOLDER_V2]);
  if (sub.toLowerCase() === cascade.toLowerCase()) console.log(`    ${FOLDER_V2} already points at CascadeSubregistryV2`);
  else if (sub !== ZERO) await send(`repoint ${FOLDER_V2} subregistry`, { address: org, abi: orgAbi, functionName: "setSubregistry",
    args: [labelId(FOLDER_V2), cascade] } as never);
  else await send(`register ${FOLDER_V2}`, { address: org, abi: orgAbi, functionName: "register",
    args: [FOLDER_V2, op, cascade, ZERO, ALL_ROLES, BigInt(Math.floor(Date.now() / 1000)) + YEAR] } as never);

  step(4, "CascadeSubregistryV2: parent, teams, depth 2");
  const [p] = await read<[Address, string]>(cascade, v2Abi, "getParent");
  if (p.toLowerCase() === org.toLowerCase()) console.log("    parent already set");
  else await send("v2 setParent", { address: cascade, abi: v2Abi, functionName: "setParent", args: [org, FOLDER_V2] } as never);
  const teams = (await read<Address[]>(cascade, v2Abi, "teams")).map((t) => t.toLowerCase());
  for (const [name, t] of [["dev-team", devTeam], ["security", security]] as const) {
    if (teams.includes(t.toLowerCase())) console.log(`    ${name} already added`);
    else await send(`v2 addTeam ${name}`, { address: cascade, abi: v2Abi, functionName: "addTeam", args: [t] } as never);
  }
  if ((await read<bigint>(cascade, v2Abi, "depth")) === 2n) console.log("    depth already 2");
  else await send("v2 setDepth 2", { address: cascade, abi: v2Abi, functionName: "setDepth", args: [2n] } as never);

  step(5, "security (NestedTeam) contains sre");
  const subs = (await read<Address[]>(security, nestedAbi, "subTeams")).map((t) => t.toLowerCase());
  if (subs.includes(sre.toLowerCase())) console.log("    sre already a sub-team");
  else await send("security addSubTeam sre", { address: security, abi: nestedAbi, functionName: "addSubTeam", args: [sre] } as never);

  step(6, "grants: dev-team SET_SUBREGISTRY on platform (level 1); security SET_RESOLVER on acme-labs.eth (level 2)");
  if (await read<boolean>(org, REGISTRY_ABI, "hasRoles", [labelId(FOLDER_V2), ROLE_SET_SUBREGISTRY, devTeam])) console.log("    level-1 grant already there");
  else await send("grant dev-team on platform", { address: org, abi: orgAbi, functionName: "grantRoles",
    args: [labelId(FOLDER_V2), ROLE_SET_SUBREGISTRY, devTeam] } as never);
  if (await read<boolean>(ENS.ethRegistry, REGISTRY_ABI, "hasRoles", [labelId(ORG_V2), ROLE_SET_RESOLVER, security])) console.log("    level-2 grant already there");
  else await send("grant security on acme-labs.eth", { address: ENS.ethRegistry, abi: orgAbi, functionName: "grantRoles",
    args: [labelId(ORG_V2), ROLE_SET_RESOLVER, security] } as never);

  step(7, `a file to act on: ${FILE_V2}.${FOLDER_V2}.${ORG_V2}.eth`);
  const fileSub = await read<bigint>(cascade, v2Abi, "getExpiry", [labelId(FILE_V2)]);
  if (fileSub > BigInt(Math.floor(Date.now() / 1000))) console.log(`    ${FILE_V2} already registered`);
  else await send(`register ${FILE_V2}`, { address: cascade, abi: v2Abi, functionName: "register",
    args: [FILE_V2, op, ZERO, ZERO, ROLE_RENEW, BigInt(Math.floor(Date.now() / 1000)) + YEAR] } as never);

  console.log(`\ndone.\n  ${ORG_V2}.eth org registry  ${org}\n  CascadeSubregistryV2       ${cascade}\n  dev-team                   ${devTeam}\n  security (NestedTeam)      ${security}\n  sre                        ${sre}`);
}

if (process.argv[1]?.endsWith("setup-v2.ts")) main().catch((e) => { console.error(`\n✗ ${e instanceof Error ? e.message : e}`); process.exit(1); });
