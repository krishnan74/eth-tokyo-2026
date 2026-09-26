"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Hex } from "viem";
import { usePublicClient, useReadContracts } from "wagmi";

import {
  CASCADE_ABI, REGISTRY_ABI, ROLE_SET_SUBREGISTRY, SEPOLIA, TEAM_ABI, TEAM_LABEL, TEAM_NAME, labelId,
} from "./contracts";
import { agrees, checkReads, decide, readExplain, type Answer, type Explanation } from "./explain";

export type ActionName = "create" | "write" | "grant" | "revoke" | "hijack";
export type Kind = "native" | "cascade";

export type TxEntry = {
  id: string;
  title: string;
  kind: Kind;
  status: "sending" | "pending" | "success" | "reverted" | "error";
  hash?: Hex;
  gas?: string;
  reason?: string;
  error?: string;
  at: number;
};

export type CheckRun = {
  id: string;
  label: string; // the subname checked
  trigger: string; // what prompted it, in plain words
  answers: (Answer | "checking" | "pending")[];
  explanation?: Explanation;
  agrees?: boolean;
  allowed?: boolean;
  block?: string;
  done: boolean;
};

export type LastWrite = { status: "success" | "reverted"; label: string; at: number } | null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);

function stored<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable: state lives for this visit only */ }
}

export function useActors() {
  const [actors, setActors] = useState<{ operator: Hex | null; outsider: Hex | null; writesEnabled: boolean } | null>(null);
  useEffect(() => {
    fetch("/api/actors").then((r) => r.json()).then(setActors).catch(() => setActors({ operator: null, outsider: null, writesEnabled: false }));
  }, []);
  return actors;
}

/** Live on-chain state behind the relationship graph, re-read every block-ish and after every transaction. */
export function useLiveState(outsider: Hex | null | undefined, target: string | null) {
  const enabled = !!outsider;
  const who = (outsider ?? "0x0000000000000000000000000000000000000000") as Hex;
  const q = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: SEPOLIA.team, abi: TEAM_ABI, functionName: "isMember", args: [who] },
      { address: SEPOLIA.parent, abi: REGISTRY_ABI, functionName: "roles", args: [labelId(TEAM_LABEL), SEPOLIA.team] },
      { address: SEPOLIA.cascade, abi: CASCADE_ABI, functionName: "team" },
      { address: SEPOLIA.cascade, abi: REGISTRY_ABI, functionName: "hasRoles", args: [labelId(target ?? "none"), ROLE_SET_SUBREGISTRY, who] },
      // What EAC itself stores for the outsider on the subname, vs what it effectively holds with Cascade.
      { address: SEPOLIA.cascade, abi: CASCADE_ABI, functionName: "nativeRoles", args: [labelId(target ?? "none"), who] },
      { address: SEPOLIA.cascade, abi: REGISTRY_ABI, functionName: "roles", args: [labelId(target ?? "none"), who] },
    ],
    query: { enabled, refetchInterval: 12_000 },
  });
  const r = q.data;
  const ok = <T,>(i: number) => (r?.[i]?.status === "success" ? (r[i]!.result as T) : undefined);
  const roles = ok<bigint>(1);
  return {
    loading: q.isLoading,
    member: ok<boolean>(0),
    parentGrantsTeam: roles === undefined ? undefined : (roles & ROLE_SET_SUBREGISTRY) === ROLE_SET_SUBREGISTRY,
    teamPointer: ok<Hex>(2),
    targetAccess: target ? ok<boolean>(3) : undefined,
    storedRoles: target ? ok<bigint>(4) : undefined,
    effectiveRoles: target ? ok<bigint>(5) : undefined,
    refetch: q.refetch,
  };
}

/** The outsider's live access on each subname — the same answer for all of them is the point. */
export function useSubnameAccess(outsider: Hex | null | undefined, labels: string[]) {
  const who = (outsider ?? "0x0000000000000000000000000000000000000000") as Hex;
  const q = useReadContracts({
    allowFailure: true,
    contracts: labels.map((l) => ({ address: SEPOLIA.cascade, abi: REGISTRY_ABI, functionName: "hasRoles" as const, args: [labelId(l), ROLE_SET_SUBREGISTRY, who] as const })),
    query: { enabled: !!outsider && labels.length > 0, refetchInterval: 12_000 },
  });
  const map: Record<string, boolean | undefined> = {};
  labels.forEach((l, i) => { const r = q.data?.[i]; map[l] = r?.status === "success" ? (r.result as boolean) : undefined; });
  return { access: map, refetch: q.refetch };
}

/** Everything the page drives: target subname, transactions, check runs, last write. */
export function useCascadeDemo(outsider: Hex | null | undefined) {
  const client = usePublicClient();
  const [target, setTarget] = useState<string | null>(null);
  const [subnames, setSubnames] = useState<string[]>([]);
  const [txs, setTxs] = useState<TxEntry[]>([]);
  const [runs, setRuns] = useState<CheckRun[]>([]);
  const [lastWrite, setLastWrite] = useState<LastWrite>(null);
  const [pending, setPending] = useState<ActionName | "recheck" | null>(null);
  const live = useLiveState(outsider, target);
  const visible = subnames.slice(0, 6);
  const perName = useSubnameAccess(outsider, visible);
  const hydrated = useRef(false);

  // Per-viewer convenience: keep this viewer's subnames and log across reloads.
  useEffect(() => {
    setTarget(stored("cascade.target", null));
    setSubnames(stored("cascade.subnames", []));
    setTxs(stored("cascade.txs", []));
    setLastWrite(stored("cascade.lastWrite", null));
    hydrated.current = true;
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    store("cascade.target", target);
    store("cascade.subnames", subnames);
    store("cascade.txs", txs.slice(0, 50));
    store("cascade.lastWrite", lastWrite);
  }, [target, subnames, txs, lastWrite]);

  const patchTx = (id: string, p: Partial<TxEntry>) => setTxs((l) => l.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const patchRun = (id: string, f: (r: CheckRun) => CheckRun) => setRuns((l) => l.map((r) => (r.id === id ? f(r) : r)));

  /** Run the three checks one read at a time (the "checking…" state is the read in flight), then explain(). */
  const runChecks = useCallback(async (label: string, trigger: string, blockNumber?: bigint) => {
    if (!client || !outsider) return;
    const id = uid();
    const fresh: CheckRun = { id, label, trigger, answers: ["pending", "pending", "pending"], done: false };
    setRuns((l) => [fresh, ...l].slice(0, 8));
    const ctx = { cascade: SEPOLIA.cascade, parent: SEPOLIA.parent, team: SEPOLIA.team, childId: labelId(label),
      account: outsider, role: ROLE_SET_SUBREGISTRY, blockNumber };
    const reads = checkReads(client, ctx);
    const answers: Answer[] = [];
    for (let i = 0; i < reads.length; i++) {
      patchRun(id, (r) => ({ ...r, answers: r.answers.map((a, j) => (j === i ? "checking" : a)) }));
      const [a] = await Promise.all([reads[i]!(), sleep(550)]);
      answers.push(a);
      patchRun(id, (r) => ({ ...r, answers: r.answers.map((x, j) => (j === i ? a : x)) }));
    }
    const x = await readExplain(client, ctx);
    patchRun(id, (r) => ({ ...r, explanation: x, agrees: agrees(answers, x), allowed: decide(answers),
      block: blockNumber === undefined ? undefined : String(blockNumber), done: true }));
  }, [client, outsider]);

  const act = useCallback(async (action: ActionName, meta: { title: string; kind: Kind }, label?: string) => {
    const name = label ?? target;
    if (!client) return;
    const id = uid();
    setPending(action);
    setTxs((l) => [{ id, title: meta.title, kind: meta.kind, status: "sending", at: Date.now() }, ...l]);
    try {
      const res = await fetch("/api/action", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, label: action === "write" ? name ?? undefined : undefined }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.funding) {
        setTxs((l) => [{ id: uid(), title: "Top up the outsider's gas from the operator", kind: "native", status: "success", hash: body.funding, at: Date.now() }, ...l]);
      }
      patchTx(id, { status: "pending", hash: body.hash });
      const receipt = await client.waitForTransactionReceipt({ hash: body.hash });
      const status = receipt.status === "success" ? "success" : "reverted";
      patchTx(id, { status, gas: String(receipt.gasUsed), reason: status === "reverted" ? body.expectedRevertReason : undefined });

      if (action === "create" && status === "success") {
        setTarget(body.label);
        setSubnames((l) => [body.label, ...l.filter((x) => x !== body.label)]);
      }
      if (action === "write" && name) {
        setTarget(name);
        setLastWrite({ status, label: name, at: Date.now() });
        await live.refetch();
        await runChecks(name, `after the write to ${name} in block ${receipt.blockNumber}`, receipt.blockNumber);
      } else {
        await live.refetch();
      }
      await perName.refetch();
      return status;
    } catch (err) {
      patchTx(id, { status: "error", error: (err as Error).message });
      return "error" as const;
    } finally {
      setPending(null);
    }
  }, [client, target, live, perName, runChecks]);

  const recheck = useCallback(async () => {
    if (!target) return;
    setPending("recheck");
    try { await runChecks(target, "re-checked now, read-only, no transaction"); } finally { setPending(null); }
  }, [target, runChecks]);

  const fqdn = target ? `${target}.${TEAM_NAME}` : null;
  return { target, setTarget, fqdn, subnames: visible, access: perName.access, txs, runs, lastWrite, pending, live, act, recheck };
}
