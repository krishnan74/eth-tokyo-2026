/**
 * One-time wiring of acme-corp.eth → devops.acme-corp.eth → CascadeSubregistry.
 *
 *   npm run setup                                  # Sepolia, simulate only
 *   npm run setup -- --write                       # Sepolia, send
 *   npm run setup -- --rpc http://127.0.0.1:8545   # anvil fork of Sepolia, sends
 *   npm run setup -- --write --redeploy            # replace CascadeSubregistry + TeamRegistry under the same devops name
 *
 * Idempotent: every step checks chain state first and skips what is already done.
 *
 *   1. Deploy the org's registry — a stock PermissionedRegistry, unmodified ENSv2 code.
 *   2. Deploy CascadeSubregistry (the one new contract) and TeamRegistry.
 *   3. Register acme-corp.eth via commit–reveal, with the org registry as its subregistry.
 *   4. Register `devops` in the org registry, with CascadeSubregistry as its subregistry.
 *   5. Grant TeamRegistry ROLE_SET_SUBREGISTRY on `devops` — an ordinary EAC grant.
 *   6. CascadeSubregistry.setParent(orgRegistry, "devops") and setTeam(TeamRegistry).
 *   7. Deploy the AlwaysTrueTeam demo fixture (the attacker's contract in the hijack step).
 *
 * --redeploy retires the current CascadeSubregistry + TeamRegistry: step 4 repoints `devops` at the new
 * registry and step 5 revokes the retired team's grant. Subnames created under the old registry are no
 * longer reachable from `devops`.
 */
import { randomBytes } from "node:crypto";
import { encodeDeployData, type Address, type Hex } from "viem";
import {
  ALL_ROLES, ENS, ERC20_ABI, FORK, ORG, REGISTRAR_ABI, REGISTRY_ABI, ROLE_SET_SUBREGISTRY, TEAM_LABEL, WRITE, ZERO,
  artifact, explorer, labelId, loadBook, operator, pub, saveBook,
} from "./lib.js";

const op = operator.account.address;
const book = loadBook();
if (process.argv.includes("--redeploy") && WRITE && book.cascade && book.team) {
  (book.retired ??= []).push({ cascade: book.cascade, team: book.team, at: new Date().toISOString() });
  delete book.cascade;
  delete book.team;
  saveBook(book);
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
  book.txs[name] = hash;
  saveBook(book);
  console.log(`    ${name}: ${explorer(hash)}`);
}

async function deploy(key: "parent" | "cascade" | "team" | "attacker", contract: string, args: unknown[]) {
  if (book[key] && (await pub.getCode({ address: book[key]! }))) {
    return console.log(`    ${contract} already at ${book[key]}`);
  }
  const { abi, bytecode } = artifact(contract);
  if (!WRITE) {
    await pub.estimateGas({ account: op, data: encodeDeployData({ abi, bytecode, args }) });
    return console.log(`    ${contract}: deploy simulates OK (not sent)`);
  }
  const hash = await operator.deployContract({ abi, bytecode, args });
  const r = await pub.waitForTransactionReceipt({ hash });
  book[key] = r.contractAddress!;
  book.txs[`deploy ${contract}`] = hash;
  saveBook(book);
  console.log(`    ${contract} → ${r.contractAddress}  ${explorer(hash)}`);
}

async function main() {
  console.log(`operator ${op}\nrpc      ${FORK ? "anvil fork" : "Sepolia"}  mode ${WRITE ? "WRITE" : "simulate"}`);

  step(1, "org registry for acme-corp.eth (stock PermissionedRegistry)");
  await deploy("parent", "PermissionedRegistry", [ENS.labelStore, op, ALL_ROLES]);

  step(2, "CascadeSubregistry + TeamRegistry");
  await deploy("cascade", "CascadeSubregistry", [ENS.labelStore, op, ALL_ROLES]);
  await deploy("team", "TeamRegistry", [[op]]);
  if (!WRITE) return console.log("\nsteps 3–6 depend on the deployments; re-run with --write.");
  const { parent, cascade, team } = book as Required<typeof book>;
  const { abi: cascadeAbi } = artifact("CascadeSubregistry");
  const { abi: parentAbi } = artifact("PermissionedRegistry");

  step(3, `register ${ORG}.eth (commit–reveal)`);
  const current = await pub.readContract({ address: ENS.ethRegistry, abi: REGISTRY_ABI, functionName: "getSubregistry", args: [ORG] });
  if (current.toLowerCase() === parent.toLowerCase()) {
    console.log(`    already registered, subregistry = org registry`);
  } else {
    const available = await pub.readContract({ address: ENS.ethRegistrar, abi: REGISTRAR_ABI, functionName: "isAvailable", args: [ORG] });
    if (!available) throw new Error(`${ORG}.eth is taken and does not point at our registry (${current})`);
    const [base, premium] = await pub.readContract({ address: ENS.ethRegistrar, abi: REGISTRAR_ABI, functionName: "getRegisterPrice", args: [ORG, YEAR, ENS.mockUsdc] });
    await send("usdc approve", { address: ENS.mockUsdc, abi: ERC20_ABI, functionName: "approve", args: [ENS.ethRegistrar, base + premium] } as never);
    const secret = `0x${randomBytes(32).toString("hex")}` as Hex;
    const c = await pub.readContract({ address: ENS.ethRegistrar, abi: REGISTRAR_ABI, functionName: "makeCommitment",
      args: [ORG, op, secret, parent, ENS.publicResolver, YEAR, NO_REFERRER] });
    await send("commit", { address: ENS.ethRegistrar, abi: REGISTRAR_ABI, functionName: "commit", args: [c] } as never);
    if (FORK) {
      await pub.request({ method: "evm_increaseTime" as never, params: [70] as never });
      await pub.request({ method: "evm_mine" as never, params: [] as never });
    } else {
      console.log("    waiting 70s for the commitment to age…");
      await new Promise((r) => setTimeout(r, 70_000));
    }
    await send(`register ${ORG}.eth`, { address: ENS.ethRegistrar, abi: REGISTRAR_ABI, functionName: "register",
      args: [ORG, op, secret, parent, ENS.publicResolver, YEAR, ENS.mockUsdc, NO_REFERRER] } as never);
  }

  step(4, `${TEAM_LABEL}.${ORG}.eth → CascadeSubregistry`);
  const sub = await pub.readContract({ address: parent, abi: REGISTRY_ABI, functionName: "getSubregistry", args: [TEAM_LABEL] });
  if (sub.toLowerCase() === cascade.toLowerCase()) console.log("    already pointed at this CascadeSubregistry");
  else if (sub !== ZERO) await send(`repoint ${TEAM_LABEL} subregistry`, { address: parent, abi: parentAbi, functionName: "setSubregistry",
    args: [labelId(TEAM_LABEL), cascade] } as never);
  else await send(`register ${TEAM_LABEL}`, { address: parent, abi: parentAbi, functionName: "register",
    args: [TEAM_LABEL, op, cascade, ZERO, ALL_ROLES, BigInt(Math.floor(Date.now() / 1000)) + YEAR] } as never);

  step(5, `grant TeamRegistry ROLE_SET_SUBREGISTRY on ${TEAM_LABEL} (native EAC)`);
  for (const r of book.retired ?? []) {
    const stale = await pub.readContract({ address: parent, abi: REGISTRY_ABI, functionName: "hasRoles", args: [labelId(TEAM_LABEL), ROLE_SET_SUBREGISTRY, r.team] });
    if (stale) await send(`revoke retired team ${r.team.slice(0, 8)}`, { address: parent, abi: parentAbi, functionName: "revokeRoles",
      args: [labelId(TEAM_LABEL), ROLE_SET_SUBREGISTRY, r.team] } as never);
  }
  const granted = await pub.readContract({ address: parent, abi: REGISTRY_ABI, functionName: "hasRoles", args: [labelId(TEAM_LABEL), ROLE_SET_SUBREGISTRY, team] });
  if (granted) console.log("    already granted");
  else await send("grant team SET_SUBREGISTRY", { address: parent, abi: parentAbi, functionName: "grantRoles",
    args: [labelId(TEAM_LABEL), ROLE_SET_SUBREGISTRY, team] } as never);

  step(6, "CascadeSubregistry.setParent + setTeam");
  const [p] = (await pub.readContract({ address: cascade, abi: cascadeAbi, functionName: "getParent" })) as [Address, string];
  if (p.toLowerCase() === parent.toLowerCase()) console.log("    parent already set");
  else await send("setParent", { address: cascade, abi: cascadeAbi, functionName: "setParent", args: [parent, TEAM_LABEL] } as never);
  const t = (await pub.readContract({ address: cascade, abi: cascadeAbi, functionName: "team" })) as Address;
  if (t.toLowerCase() === team.toLowerCase()) console.log("    team already set");
  else await send("setTeam", { address: cascade, abi: cascadeAbi, functionName: "setTeam", args: [team] } as never);

  step(7, "AlwaysTrueTeam demo fixture (the attacker's contract)");
  await deploy("attacker", "AlwaysTrueTeam", []);

  console.log(`\ndone.\n  org registry  ${parent}\n  cascade       ${cascade}\n  team          ${team}`);
}

main().catch((e) => { console.error(`\n✗ ${e instanceof Error ? e.message : e}`); process.exit(1); });
