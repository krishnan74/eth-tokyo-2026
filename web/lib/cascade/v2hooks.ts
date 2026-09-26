"use client";

// Client state for the cascade drive: live reads of the acme-labs.eth tree from /api/v2/state, actions
// through /api/v2/action (the server waits for each receipt), and the `cast run` trace of the latest
// transaction.
import { useCallback, useEffect, useState } from "react";

import type { TraceState } from "./hooks";
import type { V2State } from "./v2server";

export type V2ActionName =
  | "create" | "setSubregistry" | "setResolver" | "joinDev" | "leaveDev" | "joinSre" | "leaveSre"
  | "moveDevToSre" | "moveSreToDev" | "depth1" | "depth2" | "hijack" | "reset";
export type V2Status = "success" | "reverted" | "error" | "noop" | undefined;
export type V2Result = { hash?: `0x${string}`; status?: "success" | "reverted"; gasUsed?: string; block?: string; label?: string; expectedRevertReason?: string; noop?: string; error?: string };

const FILES_KEY = "ens-drive:v2-files";
export const V2_TITLES: Record<V2ActionName, string> = {
  create: "New file in platform", setSubregistry: "Outsider edits the file", setResolver: "Outsider sets the file's resolver",
  joinDev: "Outsider added to dev-team", leaveDev: "Outsider removed from dev-team", joinSre: "Outsider added to sre (inside security)",
  leaveSre: "Outsider removed from sre", moveDevToSre: "Outsider moved from dev-team to sre", moveSreToDev: "Outsider moved from sre to dev-team",
  depth1: "Sharing stops flowing into subfolders", depth2: "Sharing flows into subfolders again",
  hijack: "Outsider tries to add an always-yes group", reset: "Start over",
};

function body(a: V2ActionName, label?: string): object {
  switch (a) {
    case "joinDev": return { action: "join", team: "dev-team" };
    case "leaveDev": return { action: "leave", team: "dev-team" };
    case "joinSre": return { action: "join", team: "sre" };
    case "leaveSre": return { action: "leave", team: "sre" };
    case "moveDevToSre": return { action: "move", from: "dev-team", to: "sre" };
    case "moveSreToDev": return { action: "move", from: "sre", to: "dev-team" };
    case "depth1": return { action: "depth", depth: 1 };
    case "depth2": return { action: "depth", depth: 2 };
    case "setSubregistry":
    case "setResolver": return { action: a, label };
    default: return { action: a };
  }
}

/** The external calls in a trace, in order — the one-line "what the contracts did" under each result. */
export function callPath(t: TraceState): string | null {
  if (!t?.data) return null;
  const calls = t.data.nodes.filter((n) => n.kind === "call" && n.depth > 0 && n.fn && !["setLabel", "decodeParent"].includes(n.fn));
  if (!calls.length) return null;
  return calls.map((n) => `${n.contract ? `${n.contract}.` : ""}${n.fn}`).join(" → ");
}

export function useV2Demo() {
  const [files, setFiles] = useState<string[]>(["svc-api"]);
  const [target, setTarget] = useState<string | null>("svc-api");
  const [state, setState] = useState<V2State | null>(null);
  const [readError, setReadError] = useState<string>();
  const [pending, setPending] = useState<V2ActionName | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [last, setLast] = useState<{ action: V2ActionName; result: V2Result; seconds: number } | null>(null);
  const [trace, setTrace] = useState<TraceState>(null);
  const [log, setLog] = useState<{ id: number; action: V2ActionName; result: V2Result }[]>([]);

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(FILES_KEY) ?? "[]");
      if (Array.isArray(v) && v.length) setFiles(["svc-api", ...v.filter((x: unknown) => typeof x === "string" && x !== "svc-api")]);
    } catch { /* per-viewer convenience only */ }
  }, []);

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => clearInterval(t);
  }, [startedAt]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/v2/state?labels=${files.join(",")}`, { cache: "no-store" });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`);
      setState(b);
      setReadError(undefined);
    } catch (e) {
      setReadError((e as Error).message);
    }
  }, [files]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, [refresh]);

  const act = useCallback(async (a: V2ActionName, label?: string): Promise<V2Status> => {
    setPending(a);
    const t0 = Date.now();
    setStartedAt(t0);
    setElapsed(0);
    let status: V2Status;
    try {
      const r = await fetch("/api/v2/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body(a, label)) });
      const res = (await r.json()) as V2Result;
      if (!r.ok) throw new Error(res.error ?? `HTTP ${r.status}`);
      setLast({ action: a, result: res, seconds: Math.round((Date.now() - t0) / 1000) });
      setLog((l) => [{ id: t0, action: a, result: res }, ...l].slice(0, 30));
      status = res.noop ? "noop" : res.status;
      if (res.label && a === "create") {
        const next = [...files.filter((f) => f !== res.label), res.label];
        setFiles(next);
        setTarget(res.label);
        try { localStorage.setItem(FILES_KEY, JSON.stringify(next.filter((f) => f !== "svc-api"))); } catch { /* ignore */ }
      }
      if (res.hash) {
        const hash = res.hash;
        const isWrite = a === "setSubregistry" || a === "setResolver" || a === "hijack";
        setTrace({ hash, action: isWrite ? "write" : "grant", title: V2_TITLES[a], status: res.status, gas: res.gasUsed, loading: true });
        fetch(`/api/trace?hash=${hash}&labels=${files.join(",")}`)
          .then((x) => x.json())
          .then((d) => setTrace((cur) => (cur?.hash === hash ? ({ ...cur, loading: false, ...(d.error ? { error: String(d.error) } : { data: d }) } as TraceState) : cur)))
          .catch((e) => setTrace((cur) => (cur?.hash === hash ? ({ ...cur, loading: false, error: String(e) } as TraceState) : cur)));
      }
    } catch (e) {
      const res = { error: (e as Error).message };
      setLast({ action: a, result: res, seconds: Math.round((Date.now() - t0) / 1000) });
      setLog((l) => [{ id: t0, action: a, result: res }, ...l].slice(0, 30));
      status = "error";
    } finally {
      setPending(null);
      setStartedAt(null);
      refresh();
    }
    return status;
  }, [files, refresh]);

  return { state, readError, files, target, setTarget, pending, elapsed, act, last, trace, log };
}
