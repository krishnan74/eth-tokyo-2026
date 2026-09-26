"use client";

import { AnimatePresence, motion } from "framer-motion";

import { roleNames } from "@/lib/cascade/contracts";

import { Flash, Tip } from "./primitives";

function Roles({ bitmap, target, highlight }: { bitmap?: bigint; target: string | null; highlight?: boolean }) {
  if (!target) return <span className="text-xs text-muted">—</span>;
  if (bitmap === undefined) return <span className="text-xs text-muted">reading…</span>;
  const names = roleNames(bitmap);
  return (
    <AnimatePresence mode="wait">
      <motion.span key={names.join(",") || "none"} initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap gap-1.5">
        {names.length === 0
          ? <span className="font-mono text-xs text-muted">none</span>
          : names.map((n) => <span key={n} className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] ${highlight ? "bg-cascade-soft text-cascade" : "bg-sunken text-ink-2"}`}>{n}</span>)}
      </motion.span>
    </AnimatePresence>
  );
}

/**
 * The outsider's roles on the subname, twice: what EAC itself stores, and what it effectively holds with
 * Cascade. Joining and leaving the team never touches the first row — only the second changes.
 */
export function RolesStrip({ stored, effective, target }: { stored?: bigint; effective?: bigint; target: string | null }) {
  const inherited = stored !== undefined && effective !== undefined && (effective & ~stored) !== 0n;
  return (
    <div className="grid gap-px overflow-hidden rounded-xl bg-line ring-1 ring-line sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 bg-surface px-4 py-3">
        <span className="flex items-center gap-1.5">
          <span className="label">Stored in EAC</span>
          <Tip label="About stored roles">The outsider&apos;s own grants on this subname (and on the registry root), exactly as stock EAC keeps them. Read live from nativeRoles(). Cascade never writes here.</Tip>
        </span>
        <Flash value={String(stored)}><Roles bitmap={stored} target={target} /></Flash>
      </div>
      <div className="flex flex-col gap-1.5 bg-surface px-4 py-3">
        <span className="flex items-center gap-1.5">
          <span className={`label ${inherited ? "!text-cascade" : ""}`}>Effective, with Cascade</span>
          <Tip label="About effective roles">What the registry actually honours: the stored grants plus any role inherited through the team. Read live from the stock roles() view — which agrees with writes because Cascade lives in EAC&apos;s _getRoles hook.</Tip>
        </span>
        <Flash value={String(effective)}><Roles bitmap={effective} target={target} highlight={inherited} /></Flash>
      </div>
    </div>
  );
}
