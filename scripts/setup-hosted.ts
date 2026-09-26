/**
 * Least-privilege signer for the hosted demo (Vercel). Run from the main operator's machine.
 *
 *   npm run setup:hosted              # simulate
 *   npm run setup:hosted -- --write   # send
 *
 * The hosted server signs with its own keys (`.env.hosted`, never committed), not the main operator's.
 * The hosted operator gets exactly what the UI's buttons need, and nothing else:
 *   - ROLE_REGISTRAR on CascadeSubregistry's root  → "+ New file" (register a subname)
 *   - ROLE_MEMBER_ADMIN on TeamRegistry's root     → drag in / out, Start over (grant/revoke MEMBER)
 * It cannot touch acme-corp.eth, devops, the team pointer, the parent's grant, or upgrade anything.
 * Its ETH balance is the hard budget for the public site: when it runs out, hosted transactions stop.
 */
import { readFileSync } from "node:fs";
import { parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SEPOLIA } from "../core/cascade/index.js";
import { CASCADE_ABI, TEAM_ABI } from "../core/cascade/generated.js";
import { WRITE, explorer, operator, pub } from "./lib.js";

const ROLE_REGISTRAR = 1n;
const ROLE_MEMBER_ADMIN = 1n << 128n;
const BUDGET = parseEther(process.env.HOSTED_BUDGET_ETH ?? "0.2");

function hostedAddress(name: string) {
  const line = readFileSync(".env.hosted", "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} missing from .env.hosted`);
  const v = line.slice(name.length + 1).trim();
  return privateKeyToAccount((v.startsWith("0x") ? v : `0x${v}`) as Hex).address;
}

async function send(name: string, req: Parameters<typeof operator.writeContract>[0]) {
  const { request } = await pub.simulateContract({ ...req, account: operator.account } as never);
  if (!WRITE) return console.log(`    ${name}: simulates OK (not sent)`);
  const hash = await operator.writeContract(request as never);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${name} reverted: ${hash}`);
  console.log(`    ${name}: ${explorer(hash)}`);
}

async function main() {
  const hostedOp = hostedAddress("OPERATOR_PRIVATE_KEY");
  const hostedOut = hostedAddress("OUTSIDER_PRIVATE_KEY");
  console.log(`main operator  ${operator.account.address}\nhosted operator ${hostedOp}\nhosted outsider ${hostedOut}\nmode ${WRITE ? "WRITE" : "simulate"}`);

  const canRegister = await pub.readContract({ address: SEPOLIA.cascade, abi: CASCADE_ABI, functionName: "hasRootRoles", args: [ROLE_REGISTRAR, hostedOp] });
  if (canRegister) console.log("  ROLE_REGISTRAR on CascadeSubregistry: already granted");
  else await send("grant ROLE_REGISTRAR (cascade root)", { address: SEPOLIA.cascade, abi: CASCADE_ABI, functionName: "grantRootRoles", args: [ROLE_REGISTRAR, hostedOp] } as never);

  const canAdmin = await pub.readContract({ address: SEPOLIA.team, abi: TEAM_ABI, functionName: "hasRootRoles", args: [ROLE_MEMBER_ADMIN, hostedOp] });
  if (canAdmin) console.log("  ROLE_MEMBER_ADMIN on TeamRegistry: already granted");
  else await send("grant ROLE_MEMBER_ADMIN (team root)", { address: SEPOLIA.team, abi: TEAM_ABI, functionName: "grantRootRoles", args: [ROLE_MEMBER_ADMIN, hostedOp] } as never);

  const bal = await pub.getBalance({ address: hostedOp });
  if (bal >= BUDGET) console.log(`  hosted operator balance ${bal} wei: at or above budget`);
  else if (!WRITE) console.log(`    fund hosted operator with ${BUDGET - bal} wei (not sent)`);
  else {
    const hash = await operator.sendTransaction({ to: hostedOp, value: BUDGET - bal });
    await pub.waitForTransactionReceipt({ hash });
    console.log(`    funded hosted operator: ${explorer(hash)}`);
  }
}

main().catch((e) => { console.error(`\n✗ ${e instanceof Error ? e.message : e}`); process.exit(1); });
