/**
 * The live demo: the five-step deny → grant → allow → revoke → deny sequence.
 *
 *   npm run demo                                   # Sepolia (always sends; needs setup done)
 *   npm run demo -- --step                         # wait for Enter between steps (presenting live)
 *   npm run demo -- --fast                         # no pacing
 *   npm run demo -- --json                         # also print a machine-readable receipt line
 *   npm run demo -- --core                         # the five-step sequence only (skip steps 6–8)
 *   npm run demo -- --recap                        # replay the LAST run's visuals, no transactions
 *   npm run demo -- --rpc http://127.0.0.1:8545    # anvil fork rehearsal
 *
 * The two denied writes are SENT with a fixed gas limit rather than only simulated, so each
 * rejection is a failed transaction on Etherscan — not a claim that a call would have failed.
 *
 * After each write, the three checks are read one at a time from the chain, pinned to the write's
 * block, and then compared against explain() at the same block. The animation is those reads.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import pc from "picocolors";
import { BaseError, ContractFunctionRevertedError, parseEther, type Address, type Hex } from "viem";
import {
  ALL_ROLES, FORK, ORG, REGISTRY_ABI, ROLE_MEMBER, ROLE_RENEW, ROLE_SET_SUBREGISTRY, TEAM_LABEL, TEAM_RESOURCE, ZERO,
  artifact, explorer, labelId, loadBook, operator, outsider, pub,
} from "./lib.js";
import { agrees as agreesWith, checkReads, readExplain, type Answer } from "../core/cascade/index.js";
import {
  cascade, compact, divider, explainDiff, explainStatic, fail, liveChecks, native, ok, oldWayAside, pause, progress, relationDiff,
  relationGraph, say, short, noteState, stateBox, stateLine, summary, target, tree, treeDiff, txLine, type Explanation, type Row, type State,
} from "./ui.js";

const CORE = process.argv.includes("--core"); // the five-step sequence only, without the attack/edge-case steps
const N = CORE ? 5 : 8;
const TEAM_NAME = `${TEAM_LABEL}.${ORG}.eth`;
const LAST_RUN = FORK ? "deployments/fork-last-run.json" : "evidence/last-run.json";
type Receipt = { step: string; hash: Hex; status: string; gas: string; url: string };
type Run = { at: string; network: string; fqdn: string; label: string; explained: Record<number, Explanation>; rows: Row[]; members: string[]; receipts: Receipt[] };

/** --recap: every visual from the last recorded run, in full. Sends nothing and reads nothing from the chain. */
async function recap() {
  if (!existsSync(LAST_RUN)) throw new Error(`no recorded run at ${LAST_RUN} — run the demo first`);
  const run = JSON.parse(readFileSync(LAST_RUN, "utf8")) as Run;
  await divider(`RECAP — replay of the ${run.network} run at ${run.at}, no new transactions`);
  await say(`  target  ${target(run.fqdn)}`, `  members ${run.members.join(" → ")}`);
  for (const step of [2, 4, 5]) {
    await say("", pc.bold(`  step ${step}`));
    await explainStatic(run.explained[step]!, "outsider", run.label);
    await relationGraph(run.explained[step]!, run.label, TEAM_NAME);
  }
  await treeDiff("BEFORE (step 2)", run.explained[2]!, "NOW (step 4)", run.explained[4]!, `${run.label}…`);
  await relationDiff("before (step 2):", run.explained[2]!, "now    (step 4):", run.explained[4]!, TEAM_NAME);
  await explainDiff("before (step 2):", run.explained[2]!, "now    (step 4):", run.explained[4]!);
  await say("");
  summary(run.rows);
  await oldWayAside();
  if (run.receipts?.length) {
    await say("", pc.dim("  every transaction in that run:"));
    for (const r of run.receipts) await say(pc.dim(`    ${r.status.padEnd(8)} ${r.step.padEnd(22)} ${r.url}`));
  }
}

async function live() {
  const book = loadBook();
  if (!book.parent || !book.cascade || !book.team) throw new Error("run setup first");
  const { parent, cascade: cascadeAddr, team, attacker } = book as Required<typeof book>;
  const { abi: cascadeAbi } = artifact("CascadeSubregistry");
  const { abi: parentAbi } = artifact("PermissionedRegistry");
  const { abi: teamAbi } = artifact("TeamRegistry");
  const who = outsider.account.address;
  const label = `svc-${Date.now().toString(36)}`;
  const fqdn = `${label}.${TEAM_NAME}`;
  /** What the outsider's write sets the subname's subregistry to. Any address works; the write being allowed is the point. */
  const PLACEHOLDER = "0x000000000000000000000000000000000000dEaD" as Address;

  const receipts: Receipt[] = [];
  const rows: Row[] = [];
  const explained: Record<number, Explanation> = {};
  const state: State = { actor: who, member: false, lastWrite: "—", members: ["{}"] };

  async function send(step: string, hash: Hex) {
    const r = await pub.waitForTransactionReceipt({ hash });
    receipts.push({ step, hash, status: r.status, gas: String(r.gasUsed), url: explorer(hash) });
    return r;
  }

  /** The outsider's write, then the three checks read live at the write's block, cross-checked against explain(). */
  async function write(step: number, action: string, childId: bigint, detail: "full" | "compact") {
    await say(`  ${cascade(`outsider → setSubregistry(${target(fqdn)})`)}`);
    const hash = await outsider.writeContract({ address: cascadeAddr, abi: cascadeAbi, functionName: "setSubregistry", args: [childId, PLACEHOLDER], gas: 200_000n });
    const r = await send(action, hash);
    await say(txLine(r.status === "success", action, r.gasUsed, explorer(hash)));
    const at = { blockNumber: r.blockNumber };

    // The three checks and explain() come from the shared core, the same code the web UI runs.
    const ctx = { cascade: cascadeAddr, parent, team, childId, account: who, role: ROLE_SET_SUBREGISTRY, blockNumber: r.blockNumber };
    const answers: Answer[] = [];
    const reads = checkReads(pub, ctx).map((read) => async () => { const a = await read(); answers.push(a); return a; });
    const e = await liveChecks("outsider", label, reads, detail === "compact");
    const x = await readExplain(pub, ctx);
    const agrees = agreesWith(answers, x) && x.allowed === e.allowed;
    const matchesTx = x.allowed === (r.status === "success");
    // explain().allowed is hasRoles(), i.e. the same _getRoles hook the write path uses (by construction); the
    // three reads above are independent calls, so their agreement is observed, not guaranteed.
    await say(agrees && matchesTx
      ? pc.dim(`  explain() at block ${r.blockNumber} matches the tx result (same _getRoles hook as the write path) and these reads`)
      : `  ${fail(`MISMATCH at block ${r.blockNumber}: explain ${compact(x)} → ${x.allowed}, tx ${r.status}`)}`);

    state.lastWrite = r.status === "success" ? ok(`success (step ${step})`) : fail(`reverted (step ${step})`);
    rows.push({ step, action, explained: compact(x), status: r.status, gas: String(r.gasUsed), url: explorer(hash) });
    explained[step] = x;
    return { x, ok: r.status === "success" };
  }

  /** Why a call reverts, from a simulation against the latest block — decoded, not assumed. */
  async function revertReason(req: Parameters<typeof pub.simulateContract>[0]): Promise<string> {
    try {
      await pub.simulateContract(req);
      return "did not revert in simulation";
    } catch (err) {
      const r = err instanceof BaseError ? err.walk((x) => x instanceof ContractFunctionRevertedError) : null;
      if (r instanceof ContractFunctionRevertedError) return r.data?.errorName ?? r.reason ?? r.shortMessage;
      return (err as Error).message.split("\n")[0]!;
    }
  }

  /** An attempt expected to be refused: decode the reason, then send it anyway so the refusal is on-chain. */
  async function refused(step: number, action: string, who_: typeof operator, req: { address: Address; abi: typeof cascadeAbi; functionName: string; args: unknown[] }) {
    const reason = await revertReason({ ...req, account: who_.account } as never);
    const hash = await who_.writeContract({ ...req, gas: 200_000n } as never);
    const r = await send(action, hash);
    await say(txLine(r.status === "success", action, r.gasUsed, explorer(hash)), `  ${cascade(`revert reason: ${reason}`)}`);
    rows.push({ step, action, explained: "—", status: r.status, gas: String(r.gasUsed), url: explorer(hash) });
    return r.status;
  }

  await say(`Cascade demo — ${FORK ? "anvil fork of Sepolia" : "Sepolia"}`,
    pc.dim(`  org registry ${short(parent)} · CascadeSubregistry ${short(cascadeAddr)} · TeamRegistry ${short(team)} · outsider ${short(who)}`));

  const bal = await pub.getBalance({ address: who });
  if (bal < parseEther("0.002")) {
    const r = await send("fund outsider", await operator.sendTransaction({ to: who, value: parseEther("0.005") }));
    await say(txLine(r.status === "success", "fund outsider with 0.005 ETH", r.gasUsed, explorer(r.transactionHash)));
  }
  if (await pub.readContract({ address: team, abi: teamAbi, functionName: "isMember", args: [who] })) {
    throw new Error("outsider is already a member — revoke first");
  }

  // ── 1: setup, one line ─────────────────────────────────────────────────────
  const held = await pub.readContract({ address: parent, abi: REGISTRY_ABI, functionName: "hasRoles", args: [labelId(TEAM_LABEL), ROLE_SET_SUBREGISTRY, team] });
  if (!held) throw new Error("the parent does not grant TeamRegistry the role — run setup first");
  await progress(1, N, native(`setup, nothing new: TeamRegistry holds ROLE_SET_SUBREGISTRY on devops. ${pc.green("done.")}`), true);
  await say(`  ${cascade("the fallthrough is an override of EAC's own _getRoles hook — the extension point PermissionedRegistry itself uses to give approved operators the owner's roles")}`);

  // ── 2: headline = the failure, its checks, the relationship graph ──────────
  await divider("THE MECHANISM — everything below is Cascade");
  state.target = fqdn;
  await progress(2, N, "create a new subname, then the outsider attempts a write");
  await stateBox(state);
  const exp = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);
  const reg = await send("register subname", await operator.writeContract({ address: cascadeAddr, abi: cascadeAbi, functionName: "register",
    args: [label, operator.account.address, ZERO, ZERO, ROLE_RENEW, exp] }));
  await say(txLine(reg.status === "success", "register subname (nobody granted anything on it)", reg.gasUsed, explorer(reg.transactionHash), native));
  await tree(`${ORG}.eth`, TEAM_NAME, fqdn, "new — created just now");
  const before = (await write(2, "write as non-member", labelId(label), "full")).x;
  noteState(state); // seen: step 2 reverted
  await relationGraph(before, label, TEAM_NAME);

  // ── 3: one line ────────────────────────────────────────────────────────────
  await pause(3);
  const g = await send("grant MEMBER", await operator.writeContract({ address: team, abi: teamAbi, functionName: "grantRoles", args: [TEAM_RESOURCE, ROLE_MEMBER, who] }));
  await progress(3, N, `${txLine(g.status === "success", "grant outsider → MEMBER on TeamRegistry (one tx)", g.gasUsed, explorer(g.transactionHash), native).trimStart()}`, true, false);
  state.member = true;
  state.members.push("{outsider}");

  // ── 4: headline = the before/after diffs ───────────────────────────────────
  await progress(4, N, "the identical write again — same target, same caller");
  await stateLine(state);
  const w4 = await write(4, "write as member", labelId(label), "compact");
  const now = w4.x;
  noteState(state); // seen: step 4 succeeded — so step 5's box shows the flip back
  if (w4.ok) await say(`  ${cascade(`write succeeded — ${target(label)}'s subregistry pointer set to ${short(PLACEHOLDER)}, a demo placeholder`)}`);
  const hr = await pub.readContract({ address: cascadeAddr, abi: REGISTRY_ABI, functionName: "hasRoles", args: [labelId(label), ROLE_SET_SUBREGISTRY, who] });
  const [memberCap, parentCap] = await Promise.all(["MEMBER_CALL_GAS", "PARENT_CALL_GAS"].map((f) =>
    pub.readContract({ address: cascadeAddr, abi: cascadeAbi, functionName: f }) as Promise<bigint>));
  await say(`  ${cascade(`stock hasRoles(${label}, SET_SUBREGISTRY, outsider) = ${hr} — views agree with writes because the fallthrough lives in _getRoles`)}`,
    pc.dim(`  external call gas caps: isMember() ${memberCap}, parent roles() ${parentCap} (of ${rows.at(-1)!.gas} total for this write)`));
  await treeDiff("BEFORE (step 2)", before, "NOW (step 4)", now, `${label}…`);
  await relationDiff("before (step 2):", before, "now    (step 4):", now, TEAM_NAME);
  await explainDiff("before (step 2):", before, "now    (step 4):", now);

  // ── 5: headline = last write flips back ────────────────────────────────────
  await progress(5, N, "remove the outsider from the team, then the same write a third time");
  const rv = await send("revoke MEMBER", await operator.writeContract({ address: team, abi: teamAbi, functionName: "revokeRoles", args: [TEAM_RESOURCE, ROLE_MEMBER, who] }));
  await say(txLine(rv.status === "success", "revoke outsider's MEMBER on TeamRegistry", rv.gasUsed, explorer(rv.transactionHash), native));
  state.member = false;
  state.members.push("{}");
  await write(5, "write after revoke", labelId(label), "compact");
  await stateBox(state);

  if (!CORE) {
    await divider("ATTACKS & EDGE CASES — each one refused, on-chain");

    // ── 6: hijack the pointer ────────────────────────────────────────────────
    await progress(6, N, "outsider tries to point the fallthrough at an attacker's always-true team contract");
    await say(pc.dim(`  AlwaysTrueTeam ${short(attacker)} declares ITeam and answers isMember() = true for everyone`));
    await refused(6, "outsider setTeam(AlwaysTrueTeam)", outsider, { address: cascadeAddr, abi: cascadeAbi, functionName: "setTeam", args: [attacker] });
    const t6 = await pub.readContract({ address: cascadeAddr, abi: cascadeAbi, functionName: "team" });
    await say(`  ${cascade(`team pointer unchanged: ${short(t6 as string)} (TeamRegistry). setTeam needs ROLE_SET_TEAM on root; changes emit TeamPointerUpdated(old, new, by)`)}`);

    // ── 7: a wallet as the team ──────────────────────────────────────────────
    await progress(7, N, "even the operator, who holds ROLE_SET_TEAM, cannot set a plain wallet as the team");
    await refused(7, "operator setTeam(wallet)", operator, { address: cascadeAddr, abi: cascadeAbi, functionName: "setTeam", args: [who] });
    await say(`  ${cascade("setTeam also requires the contract to declare ITeam via ERC-165; the role holder remains the trust anchor, since a contract can lie about ERC-165")}`);

    // ── 8: the parent name is re-issued ──────────────────────────────────────
    await progress(8, N, "the parent re-issues devops: the team's grant must not survive into the new registration");
    const g8 = await send("grant MEMBER (step 8)", await operator.writeContract({ address: team, abi: teamAbi, functionName: "grantRoles", args: [TEAM_RESOURCE, ROLE_MEMBER, who] }));
    await say(txLine(g8.status === "success", "outsider is a member again, so only the parent changes", g8.gasUsed, explorer(g8.transactionHash), native));
    const un = await send("unregister devops", await operator.writeContract({ address: parent, abi: parentAbi, functionName: "unregister", args: [labelId(TEAM_LABEL)] }));
    await say(txLine(un.status === "success", "org registry unregisters devops", un.gasUsed, explorer(un.transactionHash), native));
    const re = await send("re-register devops", await operator.writeContract({ address: parent, abi: parentAbi, functionName: "register",
      args: [TEAM_LABEL, operator.account.address, cascadeAddr, ZERO, ALL_ROLES, BigInt(Math.floor(Date.now() / 1000) + 365 * 86400)] }));
    await say(txLine(re.status === "success", "org registry re-registers devops (same owner and subregistry, no team grant)", re.gasUsed, explorer(re.transactionHash), native));
    state.member = true;
    await stateLine(state);
    const x8 = (await write(8, "write after parent re-issue", labelId(label), "compact")).x;
    await relationGraph(x8, label, TEAM_NAME);
    await say(`  ${cascade("same pointer, same member — the grant was scoped to the old devops resource, so it no longer applies, like every native grant on it")}`);
    // restore the standing setup
    const rg = await send("restore: re-grant team", await operator.writeContract({ address: parent, abi: parentAbi, functionName: "grantRoles", args: [labelId(TEAM_LABEL), ROLE_SET_SUBREGISTRY, team] }));
    const rk = await send("restore: revoke MEMBER", await operator.writeContract({ address: team, abi: teamAbi, functionName: "revokeRoles", args: [TEAM_RESOURCE, ROLE_MEMBER, who] }));
    state.member = false;
    noteState(state);
    await say(pc.dim(`  restored for the next run: team re-granted on the new devops (${rg.status}), outsider's membership revoked (${rk.status})`));
  }

  // ── summary: table, then the context for what was just shown ───────────────
  await divider("SUMMARY");
  await say(`  target  ${target(fqdn)}`, `  members ${state.members.join(" → ")}`, "");
  summary(rows);
  await oldWayAside();
  const got = rows.map((r) => r.status);
  const want = CORE ? ["reverted", "success", "reverted"] : ["reverted", "success", "reverted", "reverted", "reverted", "reverted"];
  const held3 = JSON.stringify(got) === JSON.stringify(want);
  await say("",
    pc.dim("  scope: one hop only — a deeper tree needs a CascadeSubregistry, with its own team and parent, at each level that should inherit."),
    "", held3 ? ok(`every outcome as expected: ${got.join(" → ")}`) : fail(`expected ${want.join(" → ")}, got ${got.join(" → ")}`));

  const run: Run = { at: new Date().toISOString(), network: FORK ? "fork" : "sepolia", fqdn, label, explained, rows, members: state.members, receipts };
  writeFileSync(LAST_RUN, JSON.stringify(run, null, 2) + "\n");
  await say(pc.dim(`  full detail of this run: npm run demo -- --recap  (${LAST_RUN})`));
  if (process.argv.includes("--json")) console.log(JSON.stringify({ network: run.network, child: fqdn, receipts }));
  if (!held3) process.exit(1);
}

(process.argv.includes("--recap") ? recap() : live()).catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
