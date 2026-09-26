/**
 * Live check of the roadmap deployment (after `npm run setup:v2 -- --write`).
 *
 *   npm run smoke:v2                                  # Sepolia
 *   npm run smoke:v2 -- --rpc http://127.0.0.1:8545   # anvil fork
 *
 * Denials are simulated (no gas spent on transactions that must fail); every allowed action is a real
 * transaction, and every membership is removed again at the end. Touches only the v2 tree.
 */
import { BaseError, ContractFunctionRevertedError, type Address, type Hex } from "viem";
import { ROLE_SET_SUBREGISTRY, explorer, labelId, operator, outsider, pub, artifact } from "./lib.js";
import { FILE_V2, ROLE_SET_RESOLVER, loadBookV2, saveBookV2, txKey, type BookV2 } from "./setup-v2.js";

const book = loadBookV2();
const { cascade, devTeam, sre } = book as Required<BookV2>;
if (!cascade) throw new Error("no v2 deployment in the book — run setup:v2 first");
const v2Abi = artifact("CascadeSubregistryV2").abi;
const teamAbi = artifact("TeamRegistry").abi;
const out = outsider.account.address;
const file = labelId(FILE_V2);
const t = (label: string) => console.log(`\n— ${label}`);

async function denied(what: string, req: object): Promise<void> {
  try {
    await pub.simulateContract({ ...req, account: outsider.account } as never);
    throw new Error(`expected ${what} to be refused, but it simulates OK`);
  } catch (err) {
    const r = err instanceof BaseError ? err.walk((x) => x instanceof ContractFunctionRevertedError) : null;
    if (!(r instanceof ContractFunctionRevertedError)) throw err;
    console.log(`    refused: ${what} (${r.data?.errorName ?? r.shortMessage})`);
  }
}

async function tx(who: typeof operator, name: string, req: object): Promise<bigint> {
  const { request } = await pub.simulateContract({ ...req, account: who.account } as never);
  const hash = (await who.writeContract(request as never)) as Hex;
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${name} reverted: ${hash}`);
  book.txs[txKey(book, `smoke: ${name}`)] = hash;
  saveBookV2(book);
  console.log(`    ${name}: gas ${r.gasUsed}  ${explorer(hash)}`);
  return r.gasUsed;
}

const member = (team: Address, grant: boolean) => ({ address: team, abi: teamAbi, functionName: grant ? "grantRoles" : "revokeRoles", args: [1n, 1n, out] });
const setSub = { address: cascade, abi: v2Abi, functionName: "setSubregistry", args: [file, "0x000000000000000000000000000000000000dEaD"] };
const setRes = { address: cascade, abi: v2Abi, functionName: "setResolver", args: [file, "0x000000000000000000000000000000000000dEaD"] };

async function explain(role: bigint) {
  const e = (await pub.readContract({ address: cascade, abi: v2Abi, functionName: "explain", args: [file, role, out] })) as
    { allowed: boolean; team: Address; level: bigint; ancestor: Address; label: string };
  console.log(`    explain: allowed=${e.allowed} team=${e.team.slice(0, 10)} level=${e.level} via ${e.label || "—"} @ ${e.ancestor.slice(0, 10)}`);
  return e;
}

async function main() {
  const funds = await pub.getBalance({ address: out });
  if (funds < 1_000_000_000_000_000n) throw new Error("outsider has under 0.001 ETH; fund it first");

  t("0. start clean: outsider in no team (the browser demo may have left them in one)");
  for (const [name, team] of [["dev-team", devTeam], ["sre", sre]] as const) {
    const isMember = await pub.readContract({ address: team, abi: teamAbi, functionName: "isMember", args: [out] });
    if (isMember) await tx(operator, `${name} remove outsider (clean start)`, member(team, false));
    else console.log(`    not in ${name}`);
  }

  t("1. outsider, in no team: both writes refused");
  await denied("setSubregistry", setSub);
  await denied("setResolver", setRes);

  t("2. join dev-team → SET_SUBREGISTRY via level 1 (platform), still no SET_RESOLVER");
  await tx(operator, "dev-team add outsider", member(devTeam, true));
  const e1 = await explain(ROLE_SET_SUBREGISTRY);
  if (!e1.allowed || e1.level !== 1n || e1.team.toLowerCase() !== devTeam.toLowerCase()) throw new Error("expected level-1 grant via dev-team");
  await tx(outsider as never, "outsider setSubregistry (via dev-team)", setSub);
  await denied("setResolver", setRes);

  t("3. join sre (inside security) → SET_RESOLVER via level 2 (acme-labs.eth), through the nested team");
  await tx(operator, "sre add outsider", member(sre, true));
  const e2 = await explain(ROLE_SET_RESOLVER);
  if (!e2.allowed || e2.level !== 2n || e2.team.toLowerCase() !== book.security!.toLowerCase()) throw new Error("expected level-2 grant via security");
  await tx(outsider as never, "outsider setResolver (via security ⊃ sre, two levels up)", setRes);

  t("4. native owner: fast path, no lookups");
  await tx(operator, "operator setSubregistry (native)", setSub);

  t("5. leave both teams → refused again");
  await tx(operator, "dev-team remove outsider", member(devTeam, false));
  await tx(operator, "sre remove outsider", member(sre, false));
  await denied("setSubregistry", setSub);
  await denied("setResolver", setRes);

  console.log("\nall roadmap checks passed on", process.argv.includes("--rpc") ? "the fork" : "Sepolia");
}

main().catch((e) => { console.error(`\n✗ ${e instanceof Error ? e.message : e}`); process.exit(1); });
