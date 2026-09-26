// Terminal presentation for demo.ts. Nothing here touches the chain; callers pass in results.
//
// Flags: --fast   no pacing (default when stdout is not a TTY, e.g. piped to a log)
//        --step   wait for Enter between steps (for presenting live)
import { createInterface } from "node:readline/promises";
import pc from "picocolors";
import Table from "cli-table3";

const TTY = !!process.stdout.isTTY;
const FAST = process.argv.includes("--fast") || !TTY;
const STEP = process.argv.includes("--step") && process.stdin.isTTY;

export const sleep = (ms: number) => (FAST ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
const width = (s: string) => [...strip(s)].length;
const padEnd = (s: string, n: number, ch = " ") => s + ch.repeat(Math.max(0, n - width(s)));

/** Print lines with a short pause between them, so a live viewer can keep up. */
export async function say(...lines: string[]) {
  for (const l of lines) {
    console.log(l);
    await sleep(250);
  }
}

// ── categories ────────────────────────────────────────────────────────────────
export const native = (s: string) => pc.gray(`[NATIVE EAC] ${s}`);
export const cascade = (s: string) => pc.bold(pc.cyan(`[CASCADE] ${s}`));
export const ok = (s: string) => pc.green(`✓ ${s}`);
export const fail = (s: string) => pc.red(`✗ ${s}`);
export const target = (s: string) => pc.bold(pc.underline(s));
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-5)}`;

export async function divider(title: string) {
  const bar = "═".repeat(Math.max(4, Math.floor((64 - title.length - 2) / 2)));
  await say("", pc.bold(`${bar} ${title} ${bar}`));
}

export function box(title: string, rows: string[]) {
  const inner = Math.max(52, ...rows.map((r) => width(r) + 2), title.length + 4);
  console.log(pc.dim(`┌─ ${title} ${"─".repeat(inner - title.length - 3)}┐`));
  for (const r of rows) console.log(`${pc.dim("│")} ${padEnd(r, inner - 2)} ${pc.dim("│")}`);
  console.log(pc.dim(`└${"─".repeat(inner)}┘`));
}

// ── progress + persistent state, changed fields pulsed ────────────────────────
export type State = { target?: string; actor: string; member: boolean; lastWrite: string; members: string[] };

/** The step counter. With --step, waits for Enter first. `inline` puts the whole step on this one line. */
/** Between steps: wait for Enter with --step, otherwise a short pause. */
export async function pause(i: number) {
  if (STEP && i > 1) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    await rl.question(pc.dim("\n  ⏎  next step"));
    rl.close();
  } else await sleep(1000);
}

export async function progress(i: number, n: number, title: string, inline = false, wait = true) {
  if (wait) await pause(i);
  const dots = pc.cyan("●".repeat(i)) + pc.dim("○".repeat(n - i));
  if (inline) return console.log(`\n${pc.bold(`[${i}/${n}]`)} ${title}`);
  console.log(`\n${pc.bold(`[${i}/${n}]`)} ${pc.dim("─────")}${dots}${pc.dim("─".repeat(32))}`);
  console.log(pc.bold(title));
}

const stateFields = (s: State): [string, string, string][] => [
  ["target", "target:    ", s.target ? target(s.target) : pc.dim("(not created yet)")],
  ["actor", "actor:     ", `${short(s.actor)} (outsider)`],
  ["member", "member?    ", s.member ? pc.green("YES") : pc.red("NO")],
  ["lastWrite", "last write:", s.lastWrite],
  ["members", "members:   ", s.members.join(pc.dim(" → "))],
];
let shown: Record<string, string> = {};
/** Record `s` as what the viewer has seen, so the next box or line marks only later changes. */
export const noteState = (s: State) => { shown = Object.fromEntries(stateFields(s).map(([k, , v]) => [k, v])); };
const changedFields = (s: State) =>
  stateFields(s).filter(([k, , v]) => shown[k] !== undefined && strip(shown[k]!) !== strip(v)).map(([k, label, v]) => ({ k, label, from: shown[k]!, to: v }));

/** The full state box. Fields that changed since it was last shown read `old → new  ← just changed`. */
export async function stateBox(s: State) {
  const changed = new Map(changedFields(s).map((c) => [c.k, c]));
  box("Cascade state", stateFields(s).map(([k, label, v]) => {
    const c = changed.get(k);
    return c && k !== "members" ? `${pc.yellow(label)} ${pc.dim(strip(c.from))} ${pc.yellow("→")} ${pc.bold(v)}  ${pc.yellow("← just changed")}`
      : c ? `${pc.yellow(label)} ${v}  ${pc.yellow("← just changed")}` : `${label} ${v}`;
  }));
  noteState(s);
  await sleep(300);
}

/** Only what changed since the state was last shown, on one line. */
export async function stateLine(s: State) {
  const c = changedFields(s).filter((f) => f.k !== "members");
  noteState(s);
  if (c.length) await say(`  ${pc.dim("state:")} ${c.map((f) => `${f.label.replace(/:?\s*$/, "")} ${pc.dim(strip(f.from))} → ${pc.bold(f.to)}`).join(pc.dim("  ·  "))}`);
}

/** One transaction on one line; the hash links to the explorer in terminals that support it. */
export function txLine(ok_: boolean, what: string, gas: bigint | string, url: string, tag: (s: string) => string = (x) => x) {
  const hash = url.split("/").pop() ?? url;
  const shortHash = `${hash.slice(0, 10)}…`;
  const link = TTY && url.startsWith("http") ? `\x1b]8;;${url}\x07${shortHash}\x1b]8;;\x07` : url;
  return `  ${tag(ok_ ? ok(`${what}  gas ${gas}`) : fail(`${what}  gas ${gas}  (reverted)`))}  ${pc.dim(link)}`;
}

// ── hierarchy ─────────────────────────────────────────────────────────────────
export async function tree(org: string, team: string, child: string | undefined, note: string) {
  await say(
    "",
    `  ${org}`,
    `   └─ ${team}  ${pc.gray("[TeamRegistry holds ROLE_SET_SUBREGISTRY here]")}`,
    child ? `       └─ ${target(child)}  ${pc.cyan(`[${note}]`)}` : `       └─ ${pc.dim(`svc-…  [${note}]`)}`,
  );
}

// ── explain() ─────────────────────────────────────────────────────────────────
import type { Explanation } from "../core/cascade/index.js";
export type { Explanation };

const yn = (b: boolean) => (b ? pc.green("YES") : pc.red("NO"));
const lead = (text: string, verdict: string, w: number) => `${text} ${pc.dim("─".repeat(Math.max(2, w - width(text))))} ${verdict}`;

/**
 * The three checks drawn as the chain they are, each line printed while its own chain read is in
 * flight. `reads[i]` performs check i for real and returns its answer, or `undefined` when an earlier
 * check already decided the outcome — exactly the short-circuit `_evaluate` applies.
 */
export async function liveChecks(who: string, childLabel: string, reads: (() => Promise<boolean | undefined>)[], compactLine = false) {
  const W = 46;
  const rows = [
    { prefix: "  ┌─ ", text: "1. direct role on this name?", w: W },
    { prefix: "  └─→ ", text: "2. parent grants TeamRegistry the role?", w: W - 2 },
    { prefix: "      └─→ ", text: `3. TeamRegistry.isMember(${who})?`, w: W - 6 },
  ];
  const answers: (boolean | undefined)[] = [];
  if (compactLine) {
    for (const r of reads) answers.push(await r());
  } else {
    await say(`  ${cascade(`checking outsider → ${target(childLabel)}, one live read per line`)}`);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      if (TTY) process.stdout.write(`${r.prefix}${lead(r.text, pc.yellow("…"), r.w)}   ${pc.yellow("[checking…]")}`);
      const [a] = await Promise.all([reads[i]!(), sleep(400)]);
      answers.push(a);
      const line = `${r.prefix}${lead(r.text, a === undefined ? pc.dim("skipped") : yn(a), r.w)}`;
      if (TTY) process.stdout.write(`\r\x1b[2K${line}\n`);
      else console.log(line);
    }
  }
  const allowed = answers[0] === true || (answers[1] === true && answers[2] === true);
  const e = { native: !!answers[0], parentGrantsTeam: !!answers[1], member: !!answers[2], allowed } as Explanation;
  if (compactLine) {
    const v = (a: boolean | undefined) => (a === undefined ? "skip" : a ? "yes" : "no");
    await say(`  ${cascade(`checks (live reads): 1.${v(answers[0])} 2.${v(answers[1])} 3.${v(answers[2])} → allowed ${allowed ? pc.green("✓") : pc.red("✗")}`)}`);
  } else {
    await say(`${" ".repeat(W - 4)}→ allowed: ${allowed ? pc.bold(pc.green("TRUE")) : pc.bold(pc.red("false"))}`);
  }
  return e;
}

/** The same Explanation drawn statically (used by --recap). */
export async function explainStatic(e: Explanation, who: string, childLabel: string) {
  const W = 46;
  const s = pc.dim("skipped");
  await say(
    `  ${cascade(`explain(${who} → ${target(childLabel)})`)}`,
    `  ┌─ ${lead("1. direct role on this name?", yn(e.native), W)}`,
    `  └─→ ${lead("2. parent grants TeamRegistry the role?", e.native ? s : yn(e.parentGrantsTeam), W - 2)}`,
    `      └─→ ${lead(`3. TeamRegistry.isMember(${who})?`, e.native || !e.parentGrantsTeam ? s : yn(e.member), W - 6)}`,
    `${" ".repeat(W - 4)}→ allowed: ${e.allowed ? pc.bold(pc.green("TRUE")) : pc.bold(pc.red("false"))}`,
  );
}

/** Why access comes out the way it does: the two links that matter, lit when true, dim when false. */
export async function relationGraph(e: Explanation, childLabel: string, teamName: string) {
  const link = (on: boolean, text: string) => (on ? pc.bold(pc.green(`──${text}──>`)) : pc.dim(`╌╌${text}╌╌>`));
  const left = "  outsider ";
  const mid = ` TeamRegistry `;
  const l1 = link(e.member, "member of");
  const l2 = link(e.parentGrantsTeam, "holds role on");
  const top = `${left}${l1}${mid}${l2} ${teamName}`;
  const span = width(top) - 5 - 2;
  const label = ` computed access: ${e.allowed ? "✓" : "✗"} `;
  const dash = "─".repeat(Math.max(2, Math.floor((span - label.length) / 2)));
  const bottomInner = `${dash}${label}${"─".repeat(Math.max(2, span - dash.length - label.length))}`;
  const colored = e.allowed ? pc.green : pc.red;
  await say(
    "",
    top,
    `     │${" ".repeat(span)}│`,
    `     └${colored(bottomInner)}┘`,
    `${" ".repeat(Math.floor(width(top) / 2) - 6)}on ${target(childLabel)} ↑`,
  );
}

/** The relationship graph's top line, before and after: the one arrow that flipped is the mechanism. */
export async function relationDiff(label1: string, a: Explanation, label2: string, b: Explanation, teamName: string) {
  const link = (on: boolean, text: string) => (on ? pc.bold(pc.green(`──${text}──>`)) : pc.dim(`╌╌${text}╌╌>`));
  const line = (label: string, e: Explanation) =>
    `  ${padEnd(label, 18)}outsider ${link(e.member, "member of")} TeamRegistry ${link(e.parentGrantsTeam, "holds role on")} ${teamName}   access ${e.allowed ? pc.green("✓") : pc.red("✗")}`;
  await say("", `  ${cascade("same relationships, before vs now")}`, line(label1, a), line(label2, b));
}

export { compact } from "../core/cascade/index.js";

/** Two explain() results one above the other, with what changed marked. */
export async function explainDiff(label1: string, a: Explanation, label2: string, b: Explanation) {
  const keys = ["native", "parentGrantsTeam", "member"] as const;
  const cells = (e: Explanation, prev?: Explanation) =>
    keys.map((k, i) => {
      const v = `${i + 1}.${e[k] ? "yes" : "no"}`;
      return prev && prev[k] !== e[k] ? pc.bold(pc.yellow(v.toUpperCase())) : v;
    }).join("  ");
  const res = (e: Explanation, prev?: Explanation) =>
    prev && prev.allowed !== e.allowed ? pc.bold(e.allowed ? pc.green("→ TRUE") : pc.red("→ FALSE")) : `→ ${e.allowed}`;
  const l1 = `  ${padEnd(label1, 18)}${cells(a)}  ${res(a)}`;
  const l2 = `  ${padEnd(label2, 18)}${cells(b, a)}  ${res(b, a)}`;
  const k = keys.findIndex((key) => a[key] !== b[key]);
  const cell = (i: number) => `${i + 1}.${b[keys[i]!] ? "yes" : "no"}`;
  const col = 2 + 18 + keys.slice(0, Math.max(0, k)).reduce((n, _, i) => n + cell(i).length + 2, 0);
  const caret = k < 0 ? "" : `${" ".repeat(col)}${pc.yellow("^".repeat(cell(k).length))} ${pc.yellow("only this changed")}`;
  await say("", `  ${cascade("same target, before vs now")}`, l1, l2, caret);
}

/** The name tree twice, side by side, with the one changed line marked. */
export async function treeDiff(label1: string, a: Explanation, label2: string, b: Explanation, childShort: string) {
  const acc = (e: Explanation) => (e.allowed ? pc.green("[outsider access: ✓]") : pc.red("[outsider access: ✗]"));
  const left = [pc.bold(label1), "devops  [Team: role]", ` └─ ${childShort}  ${acc(a)}`];
  const COL = Math.max(...left.map(width)) + 6;
  const right = [pc.bold(label2), "devops  [Team: role]", ` └─ ${childShort}  ${acc(b)}`];
  const lines = left.map((l, i) => `  ${padEnd(l, COL)}${right[i]}`);
  const changedCol = 2 + COL + width(` └─ ${childShort}  `);
  const caret = a.allowed !== b.allowed ? `${" ".repeat(changedCol)}${pc.yellow("^".repeat(20))} ${pc.yellow("changed")}` : "";
  await say("", `  ${cascade("same tree, before vs now")}`, ...lines, caret);
}

/** Grant counts for keeping a team's access correct. Honest about the root-grant option stock EAC already has. */
export async function oldWayAside(teamSize = 5, subnames = 20, registries = 3) {
  await say(
    "",
    pc.dim("  ┄┄ what it takes to keep a team's access correct ┄┄"),
    pc.dim(`  team of ${teamSize}, ${subnames} subnames per registry, ${registries} registries the team manages:`),
    pc.dim(`    per-subname grants            ${teamSize} × ${subnames} × ${registries} = ${teamSize * subnames * registries} grants; every new subname needs ${teamSize} more`),
    pc.dim(`    root grants on each registry  ${teamSize} × ${registries} = ${teamSize * registries} grants; each join/leave touches all ${registries} registries`),
    `    ${pc.cyan("cascade")}                       ${pc.cyan(`${teamSize} memberships + ${registries} parent grants = ${teamSize + registries}; each join/leave is 1 tx`)}`,
    pc.dim("  root grants already cover future subnames — what Cascade adds is one roster shared by every registry."),
  );
}

// ── summary ──────────────────────────────────────────────────────────────────
export type Row = { step: number; action: string; explained: string; status: "success" | "reverted"; gas: string; url: string };

export function summary(rows: Row[]) {
  const t = new Table({ head: ["step", "action", "explain() said", "result", "gas"].map((h) => pc.bold(h)), style: { head: [], border: [] } });
  for (const r of rows) {
    t.push([r.step, r.action, r.explained, r.status === "success" ? pc.green("✓ success") : pc.red("✗ revert"), r.gas]);
  }
  console.log(t.toString());
  for (const r of rows) console.log(pc.dim(`  step ${r.step}: ${r.url}`));
}
