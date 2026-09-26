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
 *        │ grant: security holds SET_SUBREGISTRY + SET_RESOLVER on acme-labs   (level 2)
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
import { privateKeyToAccount } from "viem/accounts";
import { parseAbi } from "viem";
import {
  ALL_ROLES, ENS, ERC20_ABI, FORK, REGISTRAR_ABI, REGISTRY_ABI, ROLE_RENEW, ROLE_SET_SUBREGISTRY, WRITE, ZERO,
  artifact, explorer, labelId, operator, outsider, pub,
} from "./lib.js";

const REGISTRY_ABI_OWNER = parseAbi(["function getOwner(uint256) view returns (address)"]);

/** The hosted demo's outsider, derived from .env.hosted (never printed); null where that file isn't present. */
function hostedOutsiderAddress(): Address | null {
  if (!existsSync(".env.hosted")) return null;
  const line = readFileSync(".env.hosted", "utf8").split("\n").find((l) => l.startsWith("OUTSIDER_PRIVATE_KEY="));
  if (!line) return null;
  const v = line.slice("OUTSIDER_PRIVATE_KEY=".length).trim();
  return privateKeyToAccount((v.startsWith("0x") ? v : `0x${v}`) as Hex).address;
}

/**
 * Two independent trees, chosen with `--tree acme|orbit` (default orbit). Each has its own name, contracts
 * and book, so one can change while the other keeps serving the live site.
 *   acme:  acme-labs.eth › platform › svc-api, svc-db, svc-web   (book deployments/sepolia-v2.json)
 *   orbit: orbit-dao.eth › protocol › vault, oracle, bridge       (book deployments/sepolia-orbit.json)
 *          teams: core-devs (edits protocol) · security-council ⊃ auditors (edits + sets resolvers on orbit-dao.eth)
 *          members' own names: alex.orbit-dao.eth (hosted demo's outsider), alex-dev.orbit-dao.eth (local outsider)
 */
const TREES = {
  acme: { org: "acme-labs", folder: "platform", files: ["svc-api", "svc-db", "svc-web"], book: "v2", members: false,
    teams: { dev: "dev-team", sec: "security", sre: "sre" } },
  orbit: { org: "orbit-dao", folder: "protocol", files: ["vault", "oracle", "bridge"], book: "orbit", members: true,
    teams: { dev: "core-devs", sec: "security-council", sre: "auditors" } },
} as const;
const treeFlag = process.argv.indexOf("--tree");
export const TREE_NAME = (treeFlag > 0 ? process.argv[treeFlag + 1] : "orbit") as keyof typeof TREES;
if (!TREES[TREE_NAME]) throw new Error(`unknown --tree ${TREE_NAME}`);
export const TREE = TREES[TREE_NAME];
export const ORG_V2 = TREE.org;
export const FOLDER_V2 = TREE.folder;
export const FILES_V2: readonly string[] = TREE.files;
export const FILE_V2 = FILES_V2[0];
export const TEAMS = TREE.teams;
export const ROLE_SET_RESOLVER = 1n << 24n;

export type BookV2 = {
  org?: Address; cascade?: Address; devTeam?: Address; sre?: Address; security?: Address;
  /** Earlier CascadeSubregistryV2 deployments, replaced by `--redeploy`. */
  retired?: { cascade: Address; at: string }[];
  txs: Record<string, Hex>;
};
export const BOOK_V2 = FORK ? `deployments/fork-${TREE.book}.json` : `deployments/sepolia-${TREE.book}.json`;
export const loadBookV2 = (): BookV2 => {
  const sepoliaBook = `deployments/sepolia-${TREE.book}.json`;
  const src = existsSync(BOOK_V2) ? BOOK_V2 : FORK && existsSync(sepoliaBook) ? sepoliaBook : null;
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

  step(1, `contracts: OrgRegistry v2 (stock), CascadeSubregistryV2, ${TEAMS.dev}, ${TEAMS.sre}, ${TEAMS.sec} (NestedTeam)`);
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
  for (const [name, t] of [[TEAMS.dev, devTeam], [TEAMS.sec, security]] as const) {
    if (teams.includes(t.toLowerCase())) console.log(`    ${name} already added`);
    else await send(`v2 addTeam ${name}`, { address: cascade, abi: v2Abi, functionName: "addTeam", args: [t] } as never);
  }
  if ((await read<bigint>(cascade, v2Abi, "depth")) === 2n) console.log("    depth already 2");
  else await send("v2 setDepth 2", { address: cascade, abi: v2Abi, functionName: "setDepth", args: [2n] } as never);

  step(5, `${TEAMS.sec} (NestedTeam) contains ${TEAMS.sre}`);
  const subs = (await read<Address[]>(security, nestedAbi, "subTeams")).map((t) => t.toLowerCase());
  if (subs.includes(sre.toLowerCase())) console.log(`    ${TEAMS.sre} already a sub-team`);
  else await send(`${TEAMS.sec} addSubTeam ${TEAMS.sre}`, { address: security, abi: nestedAbi, functionName: "addSubTeam", args: [sre] } as never);

  step(6, `grants: ${TEAMS.dev} SET_SUBREGISTRY on ${FOLDER_V2} (level 1); ${TEAMS.sec} SET_SUBREGISTRY + SET_RESOLVER on ${ORG_V2}.eth (level 2)`);
  if (await read<boolean>(org, REGISTRY_ABI, "hasRoles", [labelId(FOLDER_V2), ROLE_SET_SUBREGISTRY, devTeam])) console.log("    level-1 grant already there");
  else await send(`grant ${TEAMS.dev} on ${FOLDER_V2}`, { address: org, abi: orgAbi, functionName: "grantRoles",
    args: [labelId(FOLDER_V2), ROLE_SET_SUBREGISTRY, devTeam] } as never);
  // security gets both "can edit" and "can set resolver" on acme-labs.eth: the demo's main path uses the
  // same verb at both levels (edit), and the resolver right shows that each team gets its own roles.
  const L2 = ROLE_SET_SUBREGISTRY | ROLE_SET_RESOLVER;
  if (await read<boolean>(ENS.ethRegistry, REGISTRY_ABI, "hasRoles", [labelId(ORG_V2), L2, security])) console.log("    level-2 grant already there");
  else await send(`grant ${TEAMS.sec} on ${ORG_V2}.eth`, { address: ENS.ethRegistry, abi: orgAbi, functionName: "grantRoles",
    args: [labelId(ORG_V2), L2, security] } as never);

  step(7, `files to act on in ${FOLDER_V2}.${ORG_V2}.eth: ${FILES_V2.join(", ")} (several, so one change visibly reaches many)`);
  for (const file of FILES_V2) {
    const expiry = await read<bigint>(cascade, v2Abi, "getExpiry", [labelId(file)]);
    if (expiry > BigInt(Math.floor(Date.now() / 1000))) console.log(`    ${file} already registered`);
    else await send(`register ${file}`, { address: cascade, abi: v2Abi, functionName: "register",
      args: [file, op, ZERO, ZERO, ROLE_RENEW, BigInt(Math.floor(Date.now() / 1000)) + YEAR] } as never);
  }

  if (TREE.members) {
    step(8, `members' own ENS names in ${ORG_V2}.eth (owned by the demo's outsider accounts)`);
    const hostedOutsider = hostedOutsiderAddress();
    const names: [string, Address | null][] = [["alex", hostedOutsider], ["alex-dev", outsider.account.address]];
    for (const [label, owner] of names) {
      if (!owner) { console.log(`    ${label}: no .env.hosted here, skipped`); continue; }
      const current = await read<Address>(org, REGISTRY_ABI_OWNER, "getOwner", [labelId(label)]);
      if (current.toLowerCase() === owner.toLowerCase()) console.log(`    ${label}.${ORG_V2}.eth already owned by ${owner.slice(0, 10)}…`);
      else await send(`register ${label}.${ORG_V2}.eth`, { address: org, abi: orgAbi, functionName: "register",
        args: [label, owner, ZERO, ZERO, 0n, BigInt(Math.floor(Date.now() / 1000)) + YEAR] } as never);
    }
  }

  console.log(`\ndone.\n  ${ORG_V2}.eth org registry  ${org}\n  CascadeSubregistryV2       ${cascade}\n  dev-team                   ${devTeam}\n  security (NestedTeam)      ${security}\n  sre                        ${sre}`);
}

if (process.argv[1]?.endsWith("setup-v2.ts")) main().catch((e) => { console.error(`\n✗ ${e instanceof Error ? e.message : e}`); process.exit(1); });
