"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

import type { LastWrite } from "@/lib/cascade/hooks";

/** Flashes when its value changes — the UI's "← just changed". */
function Field({ label, value, display }: { label: string; value: string; display: ReactNode }) {
  const prev = useRef(value);
  const changed = prev.current !== value;
  useEffect(() => { prev.current = value; }, [value]);
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-baseline gap-2">
      <dt className="text-xs text-muted">{label}</dt>
      <motion.dd key={value} className="min-w-0 rounded px-1 -mx-1 text-sm"
        initial={changed ? { backgroundColor: "var(--warn-soft)" } : false}
        animate={{ backgroundColor: "rgba(0,0,0,0)" }} transition={{ duration: 2.2 }}>
        {display}
        {changed && <motion.span className="ml-2 text-[11px] font-medium text-warn" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 1.8, duration: 0.6 }}>← just changed</motion.span>}
      </motion.dd>
    </div>
  );
}

export function StateSummary({ fqdn, member, lastWrite }: { fqdn: string | null; member?: boolean; lastWrite: LastWrite }) {
  return (
    <dl className="flex flex-col gap-2 rounded-md border border-rule bg-surface p-4">
      <span className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Current state</span>
      <Field label="target" value={fqdn ?? "none"}
        display={fqdn ? <span className="break-all font-mono font-medium underline decoration-2 underline-offset-2">{fqdn}</span> : <span className="text-muted">no subname yet</span>} />
      <Field label="outsider member?" value={String(member)}
        display={member === undefined ? <span className="text-muted">reading…</span> : member ? <span className="font-semibold text-ok">YES</span> : <span className="font-semibold text-bad">NO</span>} />
      <Field label="last write" value={lastWrite ? `${lastWrite.status}-${lastWrite.at}` : "none"}
        display={!lastWrite ? <span className="text-muted">none yet</span> :
          lastWrite.status === "success" ? <span className="font-semibold text-ok">✓ succeeded</span> : <span className="font-semibold text-bad">✗ reverted</span>} />
    </dl>
  );
}
