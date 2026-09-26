"use client";

// Client state for the v2 drive (roadmap branch): live reads of the acme-labs.eth tree from /api/v2/state,
// actions through /api/v2/action (the server waits for each receipt), and the `cast run` trace of the
// latest transaction.
import { useCallback, useEffect, useState } from "react";

import type { TraceState } from "./hooks";
import type { V2State } from "./v2server";

export type V2ActionName =
  | "create" | "setSubregistry" | "setResolver" | "joinDev" | "leaveDev" | "joinSre" | "leaveSre" | "depth1" | "depth2" | "hijack" | "reset";
export type V2Status = "success" | "reverted" | "error" | "noop" | undefined;
export type V2Result = { hash?: `0x${string}`; status?: "success" | "reverted"; gasUsed?: string; label?: string; expectedRevertReason?: string; noop?: string; error?: string };

const FILES_KEY = "ens-drive:v2-files";
const TITLES: Record<V2ActionName, string> = {
  create: "New file in platform", setSubregistry: "Outsider edits the file", setResolver: "Outsider sets the file's resolver",
  joinDev: "Outsider added to dev-team", leaveDev: "Outsider removed from dev-team", joinSre: "Outsider added to sre (inside security)",
  leaveSre: "Outsider removed from sre", depth1: "Stop sharing from acme-labs.eth reaching platform", depth2: "Let sharing from acme-labs.eth reach platform",
  hijack: "Outsider tries to add an always-yes group", reset: "Start over",
};

function body(a: V2ActionName, label?: string): object {
  switch (a) {
    case "joinDev": return { action: "join", team: "dev-team" };
    case "leaveDev": return { action: "leave", team: "dev-team" };
    case "joinSre": return { action: "join", team: "sre" };
    case "leaveSre": return { action: "leave", team: "sre" };
    case "depth1": return { action: "depth", depth: 1 };
    case "depth2": return { action: "depth", depth: 2 };
    case "setSubregistry":
    case "setResolver": return { action: a, label };
    default: return { action: a };
  }
}

export function useV2Demo() {
  const [files, setFiles] = useState<string[]>(["svc-api"]);
  const [target, setTarget] = useState<string | null>("svc-api");
  const [state, setState] = useState<V2State | null>(null);
  const [readError, setReadError] = useState<string>();
  const [pending, setPending] = useState<V2ActionName | null>(null);
  const [last, setLast] = useState<{ action: V2ActionName; result: V2Result } | null>(null);
  const [trace, setTrace] = useState<TraceState>(null);

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(FILES_KEY) ?? "[]");
      if (Array.isArray(v) && v.length) setFiles(v);
    } catch { /* per-viewer convenience only */ }
  }, []);

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
    let status: V2Status;
    try {
      const r = await fetch("/api/v2/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body(a, label)) });
      const res = (await r.json()) as V2Result;
      if (!r.ok) throw new Error(res.error ?? `HTTP ${r.status}`);
      setLast({ action: a, result: res });
      status = res.noop ? "noop" : res.status;
      if (res.label && a === "create") {
        const next = [...files.filter((f) => f !== res.label), res.label];
        setFiles(next);
        setTarget(res.label);
        try { localStorage.setItem(FILES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      }
      if (res.hash) {
        const hash = res.hash;
        const isWrite = a === "setSubregistry" || a === "setResolver" || a === "hijack";
        setTrace({ hash, action: isWrite ? "write" : "grant", title: TITLES[a], status: res.status, gas: res.gasUsed, loading: true });
        fetch(`/api/trace?hash=${hash}&labels=${files.join(",")}`)
          .then((x) => x.json())
          .then((d) => setTrace((cur) => (cur?.hash === hash ? ({ ...cur, loading: false, ...(d.error ? { error: String(d.error) } : { data: d }) } as TraceState) : cur)))
          .catch((e) => setTrace((cur) => (cur?.hash === hash ? ({ ...cur, loading: false, error: String(e) } as TraceState) : cur)));
      }
    } catch (e) {
      setLast({ action: a, result: { error: (e as Error).message } });
      status = "error";
    } finally {
      setPending(null);
      refresh();
    }
    return status;
  }, [files, refresh]);

  return { state, readError, files, target, setTarget, pending, act, last, trace };
}
