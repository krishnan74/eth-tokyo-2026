"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { CHECKS } from "@/lib/cascade/explain";
import type { CheckRun } from "@/lib/cascade/hooks";

const SHORT = ["Direct role", "Team grant", "Member"];

type A = CheckRun["answers"][number] | null;

function Mark({ a }: { a: A }) {
  if (a === "checking") return <span className="h-2 w-2 rounded-full bg-warn pulse" aria-label="checking" />;
  if (a === "pending" || a === undefined) return <span className="font-mono text-xs text-muted" aria-label="not read yet">·</span>;
  if (a === null) return <span className="font-mono text-xs text-muted" aria-label="skipped">–</span>;
  return a ? <span className="font-mono text-sm font-semibold text-ok">✓</span> : <span className="font-mono text-sm font-semibold text-bad">✗</span>;
}

const word = (a: A) => (a === true ? "yes" : a === false ? "no" : a === "checking" ? "reading chain…" : a === "pending" ? "" : "skipped");

/** The three checks as one pipeline: direct role → team grant → member = verdict. */
export function Checks({ runs, target, onRecheck, busy }: { runs: CheckRun[]; target: string | null; onRecheck: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [run, prev] = runs;
  // skipped answers arrive as `undefined` once done; before that a slot is "pending"
  const ans = (r: CheckRun | undefined, i: number): A => (!r ? "pending" : r.done && r.answers[i] === undefined ? null : r.answers[i]);

  return (
    <div className="rounded-xl border border-line bg-sunken/60">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-2">
        <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {SHORT.map((s, i) => {
            const a = ans(run, i);
            const was = prev?.done && run?.done ? ans(prev, i) : undefined;
            const changed = was !== undefined && was !== a;
            return (
              <li key={s} className="flex items-center gap-1.5">
                <span className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors ${a === "checking" ? "bg-warn-soft" : changed ? "bg-cascade-soft" : "bg-surface"} ring-1 ring-line`}>
                  <span className="font-mono text-[11px] text-muted">{i + 1}</span>
                  <span className="text-xs font-medium">{s}</span>
                  <Mark a={a} />
                  {changed && <span className="font-mono text-[10px] text-cascade">was {was === true ? "✓" : was === false ? "✗" : "–"}</span>}
                </span>
                {i < 2 && <span className="text-xs text-faint" aria-hidden>→</span>}
              </li>
            );
          })}
          <li className="flex items-center gap-1.5">
            <span className="text-xs text-faint" aria-hidden>=</span>
            <AnimatePresence mode="wait">
              <motion.span key={run ? `${run.id}-${run.done}` : "none"} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`rounded-lg px-2.5 py-1.5 font-mono text-xs font-semibold ${!run?.done ? "text-muted" : run.allowed ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
                {!run ? "not run yet" : !run.done ? "…" : run.allowed ? "allowed" : "denied"}
              </motion.span>
            </AnimatePresence>
          </li>
        </ol>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onRecheck} disabled={!target || busy} title="Run the three reads again, without a transaction"
            className="rounded-lg px-2.5 py-1.5 text-xs text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-40">Re-check</button>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            className="rounded-lg px-2.5 py-1.5 text-xs text-ink-2 hover:bg-surface hover:text-ink">{open ? "Hide details" : "Details"}</button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-line px-4 py-4">
              <ol className="flex flex-col gap-3">
                {CHECKS.map((c, i) => (
                  <li key={c.key} className="grid grid-cols-[1.25rem_1fr_auto] gap-x-2 gap-y-0.5">
                    <span className="font-mono text-xs text-muted">{i + 1}</span>
                    <span className="text-sm">{c.question}</span>
                    <span className="text-right text-xs text-ink-2">{word(ans(run, i))}</span>
                    <span />
                    <span className="col-span-2 font-mono text-[11px] text-muted">{c.source}</span>
                  </li>
                ))}
              </ol>
              {run && <p className="mt-4 text-xs text-muted">Run: {run.trigger}.{prev ? ` Compared with the previous run: ${prev.trigger}.` : ""}</p>}
              {run?.done && (
                <p className={`mt-1 text-xs ${run.agrees ? "text-muted" : "font-semibold text-bad"}`}>
                  {run.agrees
                    ? `The contract's own explain()${run.block ? ` at block ${run.block}` : ""} agrees with these three independent reads; its decision comes from the same _getRoles hook the write path uses.`
                    : `Mismatch: explain() disagrees with these reads${run.block ? ` at block ${run.block}` : ""}.`}
                </p>
              )}
              {!run && <p className="mt-4 text-xs text-muted">{target ? "Attempt a write or re-check to run them." : "Create a subname first."} Each check is its own chain read; later checks are skipped once an earlier one decides.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
