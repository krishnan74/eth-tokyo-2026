// Server-only: the /roadmap page's reads and writes on the CascadeSubregistryV2 tree (acme-labs.eth).
// Local-only like the v1 demo's writes: signed with the main operator/outsider keys from the repo's .env,
// which own that tree. The v1 demo's contracts are never written from here.
import { BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, http, parseEther, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import { ENS, REGISTRY_ABI, SEPOLIA, ROLE_RENEW, ROLE_SET_SUBREGISTRY, TEAM_ABI, TEAM_RESOURCE, ROLE_MEMBER, ZERO, labelId } from "../../../core/cascade/contracts";
import { CASCADE_V2_ABI, FOLDER_V2, NESTED_TEAM_ABI, ORG_V2, ROLE_SET_RESOLVER, SEPOLIA_V2 } from "../../../core/cascade/v2";
import { WRITES_ENABLED } from "./server";

const RPC = process.env.CASCADE_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const chain = { ...sepolia, contracts: { ...sepolia.contracts, ensUniversalResolver: { address: ENS.universalResolver, blockCreated: 0 } } };
const transport = http(RPC);
const pub = createPublicClient({ chain, transport });
const PLACEHOLDER = "0x000000000000000000000000000000000000dEaD" as Address;

function wallet(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in the repo's .env`);
  return createWalletClient({ account: privateKeyToAccount((v.startsWith("0x") ? v : `0x${v}`) as Hex), chain, transport });
}
const outsiderAddress = () => wallet("OUTSIDER_PRIVATE_KEY").account.address;

type Explained = { allowed: boolean; native: boolean; team: Address; level: number; ancestor: Address; label: string };

export type V2State = {
  outsider: Address;
  writesEnabled: boolean;
  depth: number;
  ancestry: { registry: Address; label: string }[];
  teams: { name: string; address: Address; member: boolean; grants: { level: number; where: string; roles: string[] }[] }[];
  sre: { address: Address; member: boolean };
  files: { label: string; setSubregistry: Explained; setResolver: Explained }[];
};

const roleList = (bits: bigint) => [
  ...(bits & ROLE_SET_SUBREGISTRY ? ["SET_SUBREGISTRY"] : []),
  ...(bits & ROLE_SET_RESOLVER ? ["SET_RESOLVER"] : []),
  ...(bits & ROLE_RENEW ? ["RENEW"] : []),
];

export async function v2State(labels: string[]): Promise<V2State> {
  const out = outsiderAddress();
  const c = SEPOLIA_V2.cascade;
  const [depth, [ancestors, ancLabels], memberDev, memberSec, memberSre] = await Promise.all([
    pub.readContract({ address: c, abi: CASCADE_V2_ABI, functionName: "depth" }),
    pub.readContract({ address: c, abi: CASCADE_V2_ABI, functionName: "ancestry" }),
    pub.readContract({ address: SEPOLIA_V2.devTeam, abi: TEAM_ABI, functionName: "isMember", args: [out] }),
    pub.readContract({ address: SEPOLIA_V2.security, abi: NESTED_TEAM_ABI, functionName: "isMember", args: [out] }),
    pub.readContract({ address: SEPOLIA_V2.sre, abi: TEAM_ABI, functionName: "isMember", args: [out] }),
  ]);
  const grantsFor = async (team: Address) => {
    const [l1, l2] = await Promise.all([
      pub.readContract({ address: SEPOLIA_V2.org, abi: REGISTRY_ABI, functionName: "roles", args: [labelId(FOLDER_V2), team] }) as Promise<bigint>,
      pub.readContract({ address: ENS.ethRegistry, abi: REGISTRY_ABI, functionName: "roles", args: [labelId(ORG_V2), team] }) as Promise<bigint>,
    ]);
    return [
      { level: 1, where: `${FOLDER_V2}.${ORG_V2}.eth`, roles: roleList(l1) },
      { level: 2, where: `${ORG_V2}.eth`, roles: roleList(l2) },
    ].filter((g) => g.roles.length);
  };
  const explain = async (label: string, role: bigint): Promise<Explained> => {
    const e = (await pub.readContract({ address: c, abi: CASCADE_V2_ABI, functionName: "explain", args: [labelId(label), role, out] })) as unknown as Explained & { level: bigint };
    return { allowed: e.allowed, native: e.native, team: e.team, level: Number(e.level), ancestor: e.ancestor, label: e.label };
  };
  const [devGrants, secGrants, files] = await Promise.all([
    grantsFor(SEPOLIA_V2.devTeam),
    grantsFor(SEPOLIA_V2.security),
    Promise.all(labels.map(async (label) => ({ label, setSubregistry: await explain(label, ROLE_SET_SUBREGISTRY), setResolver: await explain(label, ROLE_SET_RESOLVER) }))),
  ]);
  return {
    outsider: out,
    writesEnabled: WRITES_ENABLED,
    depth: Number(depth),
    ancestry: (ancestors as Address[]).map((registry, i) => ({ registry, label: (ancLabels as string[])[i] })),
    teams: [
      { name: "dev-team", address: SEPOLIA_V2.devTeam, member: memberDev as boolean, grants: devGrants },
      { name: "security", address: SEPOLIA_V2.security, member: memberSec as boolean, grants: secGrants },
    ],
    sre: { address: SEPOLIA_V2.sre, member: memberSre as boolean },
    files,
  };
}

export type V2Action =
  | { action: "create" }
  | { action: "join" | "leave"; team: "dev-team" | "sre" }
  | { action: "move"; from: "dev-team" | "sre"; to: "dev-team" | "sre" }
  | { action: "depth"; depth: 1 | 2 }
  | { action: "setSubregistry" | "setResolver"; label: string }
  | { action: "hijack" }
  | { action: "reset" };

export type V2Result = { hash?: Hex; status?: "success" | "reverted"; gasUsed?: string; block?: string; label?: string; expectedRevertReason?: string; noop?: string };

async function revertReason(req: object): Promise<string | undefined> {
  try {
    await pub.simulateContract(req as never);
    return undefined;
  } catch (err) {
    const r = err instanceof BaseError ? err.walk((x) => x instanceof ContractFunctionRevertedError) : null;
    return r instanceof ContractFunctionRevertedError ? (r.data?.errorName ?? r.shortMessage) : (err as Error).message.split("\n")[0];
  }
}

let queue: Promise<unknown> = Promise.resolve();
export function v2Act(a: V2Action): Promise<V2Result> {
  const next = queue.then(() => v2ActNow(a));
  queue = next.catch(() => undefined);
  return next;
}

async function v2ActNow(a: V2Action): Promise<V2Result> {
  const op = wallet("OPERATOR_PRIVATE_KEY");
  const out = wallet("OUTSIDER_PRIVATE_KEY");
  const mined = async (hash: Hex, extra: Partial<V2Result> = {}): Promise<V2Result> => {
    const r = await pub.waitForTransactionReceipt({ hash });
    return { hash, status: r.status, gasUsed: r.gasUsed.toString(), block: r.blockNumber.toString(), ...extra };
  };
  const team = (t: "dev-team" | "sre") => (t === "dev-team" ? SEPOLIA_V2.devTeam : SEPOLIA_V2.sre);
  // On the hosted demo the signer's balance is the budget: stop before it runs dry (reset still allowed).
  if (a.action !== "reset" && (await pub.getBalance({ address: op.account.address })) < parseEther("0.01")) {
    throw new Error("The demo's Sepolia test-ETH budget is used up. Run the demo locally, or ask the author to top it up.");
  }
  switch (a.action) {
    case "move": {
      // One drag from one group to another: leave, then join — each mined before the next (nonces).
      if (a.from === a.to) return { noop: "Already in that group." };
      const isIn = await pub.readContract({ address: team(a.from), abi: TEAM_ABI, functionName: "isMember", args: [out.account.address] });
      if (isIn) await mined(await op.writeContract({ address: team(a.from), abi: TEAM_ABI, functionName: "revokeRoles", args: [TEAM_RESOURCE, ROLE_MEMBER, out.account.address] }));
      return mined(await op.writeContract({ address: team(a.to), abi: TEAM_ABI, functionName: "grantRoles", args: [TEAM_RESOURCE, ROLE_MEMBER, out.account.address] }));
    }
    case "create": {
      const label = `svc-${Date.now().toString(36)}`;
      const hash = await op.writeContract({ address: SEPOLIA_V2.cascade, abi: CASCADE_V2_ABI, functionName: "register",
        args: [label, op.account.address, ZERO, ZERO, ROLE_RENEW, BigInt(Math.floor(Date.now() / 1000) + 30 * 86400)] });
      return mined(hash, { label });
    }
    case "join":
    case "leave":
      return mined(await op.writeContract({ address: team(a.team), abi: TEAM_ABI, functionName: a.action === "join" ? "grantRoles" : "revokeRoles",
        args: [TEAM_RESOURCE, ROLE_MEMBER, out.account.address] }));
    case "depth":
      if (a.depth !== 1 && a.depth !== 2) throw new Error("depth must be 1 or 2");
      return mined(await op.writeContract({ address: SEPOLIA_V2.cascade, abi: CASCADE_V2_ABI, functionName: "setDepth", args: [BigInt(a.depth)] }));
    case "setSubregistry":
    case "setResolver": {
      if ((await pub.getBalance({ address: out.account.address })) < parseEther("0.002")) {
        await pub.waitForTransactionReceipt({ hash: await op.sendTransaction({ to: out.account.address, value: parseEther("0.005") }) });
      }
      const req = a.action === "setSubregistry"
        ? { address: SEPOLIA_V2.cascade, abi: CASCADE_V2_ABI, functionName: "setSubregistry", args: [labelId(a.label), PLACEHOLDER] } as const
        : { address: SEPOLIA_V2.cascade, abi: CASCADE_V2_ABI, functionName: "setResolver", args: [labelId(a.label), PLACEHOLDER] } as const;
      const expectedRevertReason = await revertReason({ ...req, account: out.account });
      // Fixed gas so a refused write is mined as a failed transaction, like the v1 demo.
      return mined(await out.writeContract({ ...req, gas: 300_000n } as never), { label: a.label, expectedRevertReason });
    }
    case "hijack": {
      // The attack: as the outsider, add a team that says yes to everyone. Needs ROLE_SET_TEAM on root.
      const req = { address: SEPOLIA_V2.cascade, abi: CASCADE_V2_ABI, functionName: "addTeam", args: [SEPOLIA.attacker] } as const;
      const expectedRevertReason = await revertReason({ ...req, account: out.account });
      return mined(await out.writeContract({ ...req, gas: 200_000n } as never), { expectedRevertReason });
    }
    case "reset": {
      // One transaction at a time, each mined before the next: back-to-back sends from one account can
      // reuse a nonce on public RPCs.
      let last: V2Result | undefined;
      for (const t of ["dev-team", "sre"] as const) {
        const isMember = await pub.readContract({ address: team(t), abi: TEAM_ABI, functionName: "isMember", args: [out.account.address] });
        if (isMember) last = await mined(await op.writeContract({ address: team(t), abi: TEAM_ABI, functionName: "revokeRoles", args: [TEAM_RESOURCE, ROLE_MEMBER, out.account.address] }));
      }
      if ((await pub.readContract({ address: SEPOLIA_V2.cascade, abi: CASCADE_V2_ABI, functionName: "depth" })) !== 2n) {
        last = await mined(await op.writeContract({ address: SEPOLIA_V2.cascade, abi: CASCADE_V2_ABI, functionName: "setDepth", args: [2n] }));
      }
      return last ?? { noop: "Already at the start: outsider in no team, depth 2." };
    }
  }
}
