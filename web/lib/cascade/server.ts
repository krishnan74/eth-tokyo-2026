// Server-only: signs the demo's transactions with the operator and outsider keys from the repo's .env,
// exactly as scripts/demo.ts does. Keys never reach the browser; the browser gets tx hashes and waits
// for receipts itself.
import fs from "node:fs";
import path from "node:path";
import {
  BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, http, parseEther, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import {
  CASCADE_ABI, ENS, PLACEHOLDER, ROLE_MEMBER, ROLE_RENEW, SEPOLIA, TEAM_ABI, TEAM_RESOURCE, ZERO, labelId,
} from "./contracts";

// The keys live in the repo root's .env, shared with the terminal demo.
// Read at runtime only — excluded from build tracing so the .env is never bundled into server output.
for (const p of [path.resolve(/*turbopackIgnore: true*/ process.cwd(), ".env"), path.resolve(/*turbopackIgnore: true*/ process.cwd(), "../.env")]) {
  if (fs.existsSync(/*turbopackIgnore: true*/ p)) { try { process.loadEnvFile(/*turbopackIgnore: true*/ p); } catch { /* already loaded */ } break; }
}

/**
 * Writes spend the operator's Sepolia ETH and change the live demo state, so they are on only for a
 * local dev server unless explicitly enabled. A public deployment would otherwise let anyone drive it.
 */
export const WRITES_ENABLED = process.env.CASCADE_UI_WRITES === "1" || process.env.NODE_ENV === "development";

const RPC = process.env.CASCADE_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const chain = { ...sepolia, contracts: { ...sepolia.contracts, ensUniversalResolver: { address: ENS.universalResolver, blockCreated: 0 } } };
const transport = http(RPC);
const pub = createPublicClient({ chain, transport });

function key(name: string): Hex | null {
  const v = process.env[name];
  return v ? ((v.startsWith("0x") ? v : `0x${v}`) as Hex) : null;
}
function wallet(name: string) {
  const k = key(name);
  if (!k) throw new Error(`${name} is not set in the repo's .env`);
  return createWalletClient({ account: privateKeyToAccount(k), chain, transport });
}

export function actors() {
  const op = key("OPERATOR_PRIVATE_KEY"), out = key("OUTSIDER_PRIVATE_KEY");
  return {
    operator: op ? privateKeyToAccount(op).address : null,
    outsider: out ? privateKeyToAccount(out).address : null,
    writesEnabled: WRITES_ENABLED,
  };
}

export type ActionName = "create" | "write" | "grant" | "revoke" | "hijack";
export type ActionResult = { hash: Hex; label?: string; expectedRevertReason?: string; funding?: Hex };

/** Why a call would revert, decoded from a simulation against the latest block. */
async function revertReason(req: Parameters<typeof pub.simulateContract>[0]): Promise<string | undefined> {
  try {
    await pub.simulateContract(req);
    return undefined;
  } catch (err) {
    const r = err instanceof BaseError ? err.walk((x) => x instanceof ContractFunctionRevertedError) : null;
    if (r instanceof ContractFunctionRevertedError) return r.data?.errorName ?? r.reason ?? r.shortMessage;
    return (err as Error).message.split("\n")[0];
  }
}

/** The outsider pays its own gas; top it up from the operator when low, as the terminal demo does. */
async function fundOutsider(): Promise<Hex | undefined> {
  const out = wallet("OUTSIDER_PRIVATE_KEY");
  if ((await pub.getBalance({ address: out.account.address })) >= parseEther("0.002")) return undefined;
  const hash = await wallet("OPERATOR_PRIVATE_KEY").sendTransaction({ to: out.account.address, value: parseEther("0.005") });
  await pub.waitForTransactionReceipt({ hash });
  return hash;
}

export async function runAction(action: ActionName, label?: string): Promise<ActionResult> {
  const op = wallet("OPERATOR_PRIVATE_KEY");
  const out = wallet("OUTSIDER_PRIVATE_KEY");
  switch (action) {
    case "create": {
      const l = `svc-${Date.now().toString(36)}`;
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);
      const hash = await op.writeContract({ address: SEPOLIA.cascade, abi: CASCADE_ABI, functionName: "register",
        args: [l, op.account.address, ZERO, ZERO, ROLE_RENEW, expiry] });
      return { hash, label: l };
    }
    case "write": {
      if (!label) throw new Error("create a subname first");
      const funding = await fundOutsider();
      const req = { address: SEPOLIA.cascade, abi: CASCADE_ABI, functionName: "setSubregistry", args: [labelId(label), PLACEHOLDER] } as const;
      const expectedRevertReason = await revertReason({ ...req, account: out.account });
      // Fixed gas so a refused write is mined as a failed transaction, not refused by estimation.
      const hash = await out.writeContract({ ...req, gas: 200_000n });
      return { hash, label, expectedRevertReason, funding };
    }
    case "grant":
      return { hash: await op.writeContract({ address: SEPOLIA.team, abi: TEAM_ABI, functionName: "grantRoles", args: [TEAM_RESOURCE, ROLE_MEMBER, out.account.address] }) };
    case "revoke":
      return { hash: await op.writeContract({ address: SEPOLIA.team, abi: TEAM_ABI, functionName: "revokeRoles", args: [TEAM_RESOURCE, ROLE_MEMBER, out.account.address] }) };
    case "hijack": {
      const funding = await fundOutsider();
      const req = { address: SEPOLIA.cascade, abi: CASCADE_ABI, functionName: "setTeam", args: [SEPOLIA.attacker] } as const;
      const expectedRevertReason = await revertReason({ ...req, account: out.account });
      const hash = await out.writeContract({ ...req, gas: 200_000n });
      return { hash, expectedRevertReason, funding };
    }
  }
}
