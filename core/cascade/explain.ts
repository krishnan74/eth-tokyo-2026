// The three-check reasoning chain, shared by the terminal demo and the web UI so the two can never
// disagree about what a check means or how it short-circuits.
//
// The chain mirrors CascadeSubregistry._getRoles:
//   1. does the account hold the role natively (on the name or root)?      → if yes, decided
//   2. does the parent grant the team this role on the registry's label?    → if no, decided
//   3. is the account a member of the team?
// Each check is an independent read (nativeRoles, parent.roles, team.isMember). explain() is then read
// separately; its `allowed` comes from hasRoles(), i.e. the same _getRoles hook the write path uses.
import { CASCADE_ABI, REGISTRY_ABI, TEAM_ABI, TEAM_LABEL, labelId } from "./contracts";

export type Explanation = { native: boolean; parentGrantsTeam: boolean; member: boolean; allowed: boolean };
export type Answer = boolean | undefined; // undefined = skipped, because an earlier check decided

/** Anything that can do a viem-style readContract (a viem PublicClient, or wagmi's). */
export type Reader = { readContract: (args: any) => Promise<unknown> };

export type CheckContext = {
  cascade: `0x${string}`;
  parent: `0x${string}`;
  team: `0x${string}`;
  childId: bigint;
  account: `0x${string}`;
  role: bigint;
  /** Pin every read to this block, e.g. the block of the write being explained. */
  blockNumber?: bigint;
};

/** The three checks, as plain-language questions. Index = check number − 1. */
export const CHECKS = [
  { key: "native", kind: "native", question: "Does the caller hold the role on this name directly?",
    source: "cascade.nativeRoles(name, caller) — stock EAC, nothing inherited" },
  { key: "parentGrantsTeam", kind: "cascade", question: "Does the parent grant TeamRegistry this role on devops?",
    source: "parent.roles(\"devops\", TeamRegistry) — read from devops's current registration" },
  { key: "member", kind: "cascade", question: "Is the caller a member of TeamRegistry?",
    source: "TeamRegistry.isMember(caller) — gas-capped, fails closed" },
] as const;

/**
 * One thunk per check, each performing its own read. Later thunks return `undefined` when an earlier
 * answer already decided the outcome — the same short-circuit `_getRoles` applies. Run them in order.
 */
export function checkReads(client: Reader, c: CheckContext): (() => Promise<Answer>)[] {
  const at = c.blockNumber === undefined ? {} : { blockNumber: c.blockNumber };
  let native: Answer, grant: Answer;
  return [
    async () => (native = has(await client.readContract({ ...at, address: c.cascade, abi: CASCADE_ABI, functionName: "nativeRoles", args: [c.childId, c.account] }), c.role)),
    async () => (native ? undefined : (grant = has(await client.readContract({ ...at, address: c.parent, abi: REGISTRY_ABI, functionName: "roles", args: [labelId(TEAM_LABEL), c.team] }), c.role))),
    async () => (native || !grant ? undefined : (await client.readContract({ ...at, address: c.team, abi: TEAM_ABI, functionName: "isMember", args: [c.account] })) as boolean),
  ];
}

const has = (bitmap: unknown, role: bigint) => ((bitmap as bigint) & role) === role;

/** What the three answers decide. */
export const decide = (a: Answer[]) => a[0] === true || (a[1] === true && a[2] === true);

/** The contract's own explanation, at the same block. */
export async function readExplain(client: Reader, c: CheckContext): Promise<Explanation> {
  const at = c.blockNumber === undefined ? {} : { blockNumber: c.blockNumber };
  return (await client.readContract({ ...at, address: c.cascade, abi: CASCADE_ABI, functionName: "explain", args: [c.childId, c.role, c.account] })) as Explanation;
}

/** Do the independent reads agree with explain()? Compares only what was actually read. */
export function agrees(a: Answer[], x: Explanation): boolean {
  return x.native === !!a[0] && x.allowed === decide(a)
    && (x.native || x.parentGrantsTeam === !!a[1])
    && (x.native || !x.parentGrantsTeam || x.member === !!a[2]);
}

export const compact = (e: Explanation) =>
  `${e.native ? "yes" : "no"} → ${e.parentGrantsTeam ? "yes" : "no"} → ${e.member ? "yes" : "no"}`;
