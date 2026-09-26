// Server-only: the real execution trace of a demo transaction, replayed with Foundry's `cast run`
// against the chain right after it's mined. This is the EVM's own call tree — every external call,
// its gas, its return value, events and reverts — not a reconstruction.
//
// Needs Foundry on the machine running the UI (the same local-only setup the UI's transactions use),
// and recent chain state: free RPCs only keep recent blocks, so replay works for fresh transactions.
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { keccak256, toHex } from "viem";

import { ENS, PLACEHOLDER, SEPOLIA, roleNames } from "./contracts";
import { SEPOLIA_V2 } from "../../../core/cascade/v2";

export type TraceNode = {
  depth: number;
  kind: "call" | "return" | "revert" | "stop" | "event";
  contract?: string;
  fn?: string;
  args?: string;
  gas?: number;
  staticcall?: boolean;
  value?: string; // return value / event args / revert reason, humanised
};
/** "full": the block's earlier transactions were re-executed first (exact). "quick": replayed on the state
 *  before the block, without them — used when the full replay fails on a free RPC. */
export type TraceMode = "full" | "quick";
export type Trace = { ok: boolean; gasUsed?: number; nodes: TraceNode[]; raw: string; mode: TraceMode } | { error: string };

const RPC = process.env.CASCADE_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

/** Replay a mined transaction. `labels` are the demo's subname labels, so ids can be named. */
export async function traceTx(hash: string, people: Record<string, string>, labels: string[]): Promise<Trace> {
  const names: Record<string, string> = {
    [SEPOLIA.cascade]: "CascadeSubregistry", [SEPOLIA.parent]: "OrgRegistry", [SEPOLIA.team]: "TeamRegistry",
    [SEPOLIA.attacker]: "AlwaysTrueTeam", [ENS.labelStore]: "LabelStore", [PLACEHOLDER]: "placeholder",
    // Roadmap tree (acme-labs.eth), for traces from the /roadmap page.
    [SEPOLIA_V2.cascade]: "CascadeSubregistryV2", [SEPOLIA_V2.org]: "AcmeLabsRegistry", [ENS.ethRegistry]: "EthRegistry",
    [SEPOLIA_V2.devTeam]: "DevTeam", [SEPOLIA_V2.security]: "SecurityTeam", [SEPOLIA_V2.sre]: "SreTeam",
    "0x000000000000000000000000000000000000dEaD": "placeholder", ...people,
  };
  const args = ["run", hash, "--rpc-url", RPC, ...Object.entries(names).flatMap(([a, n]) => ["--labels", `${a}:${n}`])];
  const full = await castRun(args);
  if (!full.failed) return parse(full.text, names, labels, "full");
  const quick = await castRun([...args, "--quick"]);
  if (!quick.failed) return parse(quick.text, names, labels, "quick");
  return { error: quick.err ?? full.err ?? "replay failed" };
}

function castRun(args: string[]) {
  const env = { ...process.env, PATH: `${path.join(os.homedir(), ".foundry", "bin")}:${process.env.PATH ?? ""}`, NO_COLOR: "1" };
  return new Promise<{ text: string; failed: boolean; err?: string }>((resolve) => {
    execFile("cast", args, { env, timeout: 120_000, maxBuffer: 4 << 20 }, (err, stdout, stderr) => {
      const text = `${stdout}\n${stderr}`;
      // `cast run` exits non-zero when the replayed transaction itself reverted; that's still a trace.
      if (err && !/Traces:/.test(text)) resolve({ text, failed: true, err: firstError(text) ?? err.message });
      else resolve({ text, failed: false });
    });
  });
}

function firstError(text: string) {
  const line = text.split("\n").find((l) => /error/i.test(l));
  if (!line) return undefined;
  if (/historical state|not available|missing trie node/i.test(line)) return "The RPC no longer holds the state for this block — traces are only available for fresh transactions.";
  if (/ENOENT|not found/i.test(line)) return "Foundry's cast isn't installed on this machine.";
  return line.replace(/\x1b\[[0-9;]*m/g, "").trim().slice(0, 200);
}

// ── parsing ─────────────────────────────────────────────────────────────────

const TREE = /^[\s│├└─]*/;

function parse(text: string, names: Record<string, string>, labels: string[], mode: TraceMode): Trace {
  const clean = text.replace(/\x1b\[[0-9;]*m/g, "");
  const start = clean.indexOf("Traces:");
  const body = clean.slice(start + "Traces:".length).split("\n");
  const h = humaniser(labels, names);
  const nodes: TraceNode[] = [];
  const callAt: Record<number, TraceNode> = {}; // the open call at each depth, to read return values in context
  for (const line of body) {
    if (!line.trim()) continue;
    if (/^(Transaction|Error|Gas used)/.test(line.trim())) break;
    const prefix = line.match(TREE)?.[0] ?? "";
    const depth = Math.max(0, Math.round((prefix.length - 2) / 4));
    const c = line.slice(prefix.length);
    let m: RegExpMatchArray | null;
    if ((m = c.match(/^\[(\d+)\] (.+?)::(\w+)\((.*)\)( \[staticcall\])?$/))) {
      const node: TraceNode = { depth, kind: "call", gas: Number(m[1]), contract: h.contract(m[2]!), fn: m[3], args: h.args(m[4]!), staticcall: !!m[5] };
      callAt[depth] = node;
      nodes.push(node);
    } else if ((m = c.match(/^← \[(Return|Stop|Revert)\]\s*(.*)$/))) {
      const owner = callAt[depth - 1];
      if (m[1] === "Revert") nodes.push({ depth, kind: "revert", value: h.revert(m[2]!) });
      else if (m[1] === "Stop") nodes.push({ depth, kind: "stop" });
      else nodes.push({ depth, kind: "return", value: h.ret(m[2]!, owner?.fn) });
    } else if ((m = c.match(/^emit (\w+)\((.*)\)$/))) {
      nodes.push({ depth, kind: "event", fn: m[1], args: h.args(m[2]!) });
    }
  }
  const gas = clean.match(/Gas used:\s*(\d+)/);
  return { ok: !/Transaction failed/.test(clean), gasUsed: gas ? Number(gas[1]) : undefined, nodes, raw: clean.slice(start).trim(), mode };
}

/**
 * Turn raw values into names — only where the meaning is certain:
 * addresses → contract/person names; label ids and token ids → the label; a role bitmap only where the
 * value is known to be one (the return of roles(), the role in an EAC revert); a bool only for isMember.
 */
function humaniser(labels: string[], names: Record<string, string>) {
  const ids = new Map<bigint, string>();
  for (const l of ["devops", ...labels]) ids.set(BigInt(keccak256(toHex(l))), l);
  const LOW32 = (1n << 32n) - 1n;
  const byHigh = new Map<bigint, string>([...ids].map(([id, l]) => [id & ~LOW32, l]));
  const addr = Object.fromEntries(Object.entries(names).map(([a, n]) => [a.toLowerCase(), n]));
  const roles = (n: bigint) => { const r = roleNames(n); return r.length ? r.join(" | ") : n === 0n ? "none" : n.toString(); };

  const idName = (n: bigint) => {
    const exact = ids.get(n);
    if (exact) return `labelhash("${exact}")`;
    const tok = byHigh.get(n & ~LOW32);
    return tok ? `tokenId("${tok}")` : undefined;
  };
  const common = (s: string) =>
    s
      .replace(/(\w+): \[0x[0-9a-fA-F]{40}\]/g, "$1") // cast's "Label: [0x…]" → "Label"
      .replace(/0x[0-9a-fA-F]{40}\b/g, (a) => addr[a.toLowerCase()] ?? `${a.slice(0, 6)}…${a.slice(-4)}`)
      .replace(/0x([0-9a-fA-F]{64})\b/g, (w, hex: string) => idName(BigInt(`0x${hex}`)) ?? `${w.slice(0, 10)}…${w.slice(-6)}`)
      .replace(/\b(\d{12,})( \[[^\]]+\])?/g, (w, d: string) => idName(BigInt(d)) ?? w.replace(/ \[[^\]]+\]$/, ""));

  return {
    contract: (s: string) => addr[s.toLowerCase()] ?? s,
    args: common,
    ret: (raw: string, fn?: string) => {
      const hex = raw.match(/^0x[0-9a-fA-F]{64}$/)?.[0];
      if (hex && fn === "roles") return roles(BigInt(hex));
      if (hex && fn === "isMember") return BigInt(hex) === 1n ? "true" : "false";
      if (hex && (fn === "grantRoles" || fn === "revokeRoles")) return BigInt(hex) === 1n ? "true (changed)" : "false (no change)";
      return common(raw);
    },
    revert: (raw: string) => {
      // EACUnauthorizedAccountRoles(resource, roleBitmap, account): the middle value is a role bitmap.
      const m = raw.match(/^EACUnauthorizedAccountRoles\((\d+)(?: \[[^\]]+\])?, (\d+)(?: \[[^\]]+\])?, (0x[0-9a-fA-F]{40})\)$/);
      if (m) {
        const res = BigInt(m[1]!);
        return `EACUnauthorizedAccountRoles(${res === 0n ? "root" : idName(res) ?? m[1]}, ${roles(BigInt(m[2]!))}, ${addr[m[3]!.toLowerCase()] ?? m[3]})`;
      }
      return common(raw);
    },
  };
}
