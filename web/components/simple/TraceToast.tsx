"use client";

// "What the contracts just did", in plain words, beside the drive while you use it — the short form of
// Behind the scenes. Sits outside the drive (fixed, bottom-right) and can be closed; a new action
// brings it back.
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import type { TraceState } from "@/lib/cascade/hooks";
import type { TraceNode } from "@/lib/cascade/trace";

const TEAM: Record<string, string> = { CoreDevs: "core-devs", SecurityCouncil: "security-council", Auditors: "auditors", TeamRegistry: "devops-team" };

function say(n: TraceNode): string | null {
  const c = n.contract ?? "";
  switch (n.fn) {
    case "getSubregistry": return "Does this folder really contain the next one?";
    case "getParent": return "Step up to the folder above";
    case "roles":
      if (c === "OrbitDaoRegistry") return "What does protocol grant this team?";
      if (c === "EthRegistry") return "What does orbit-dao.eth grant this team?";
      if (c === "OrgRegistry") return "What does devops grant the team?";
      return "What does the folder grant this team?";
    case "isMember": return `Is this person in ${TEAM[c] ?? "the team"}?`;
    case "isMemberWithin": return "security-council asks the team inside it, auditors";
    case "grantRoles": return "One membership change on the team — no name touched";
    case "revokeRoles": return "One membership change on the team — no name touched";
    case "register": return "A new file (subname) is created";
    case "setDepth": return "The cascade setting changes";
    case "addTeam": return "Tries to add a group — needs an admin role";
    case "setTeam": return "Tries to change the folder's group — needs an admin role";
    default: return null;
  }
}

export function TraceToast({ trace }: { trace: TraceState }) {
  const [closed, setClosed] = useState<string | null>(null);
  useEffect(() => { setClosed(null); }, [trace?.hash]);
  if (!trace || closed === trace.hash) return null;

  const calls = (trace.data?.nodes ?? []).filter((n) => n.kind === "call" && (n.depth > 0 || ["grantRoles", "revokeRoles", "register", "setDepth", "addTeam", "setTeam"].includes(n.fn ?? "")))
    .map((n) => ({ n, text: say(n) })).filter((x) => x.text).slice(0, 8);
  const refused = trace.status === "reverted";

  return (
    <AnimatePresence>
      <motion.aside key={trace.hash} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.35 }}
        aria-live="polite" className="fixed bottom-4 right-4 z-40 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl bg-surface p-4 shadow-2xl ring-1 ring-line">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="label">On-chain, just now</span>
            <span className="text-sm font-medium">{trace.title}</span>
          </div>
          <button type="button" onClick={() => setClosed(trace.hash)} aria-label="Close" className="rounded-full px-2 text-lg leading-none text-muted hover:text-ink">×</button>
        </div>
        {trace.loading && <p className="flex items-center gap-2 text-xs text-muted"><span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-r-transparent" /> Reading the contract calls from the mined transaction…</p>}
        {trace.error && <p className="text-xs text-muted">The call-by-call view isn&apos;t available for this one ({trace.error.slice(0, 80)}).</p>}
        {!!calls.length && (
          <ol className="flex flex-col gap-1.5">
            {calls.map(({ n, text }, i) => (
              <li key={i} className="grid grid-cols-[1.1rem_minmax(0,1fr)] gap-2 text-xs">
                <span className="font-mono text-cascade">{i + 1}</span>
                <span className="flex flex-col leading-snug">
                  <span className="text-ink-2">{text}</span>
                  <span className="truncate font-mono text-[10.5px] text-muted">{n.contract}.{n.fn}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        {trace.data && (
          <p className={`rounded-lg px-2.5 py-1.5 text-xs ${refused ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"}`}>
            {refused ? "Refused by ENS's own permission check — nothing changed." : "Allowed — the write went through."}
          </p>
        )}
        <a href="#trace" className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline">Full call tree, with gas and values ↓</a>
      </motion.aside>
    </AnimatePresence>
  );
}
