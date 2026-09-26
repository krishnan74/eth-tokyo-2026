"use client";

import { AnimatePresence, motion } from "framer-motion";

import { CHECKS } from "@/lib/cascade/explain";
import type { CheckRun } from "@/lib/cascade/hooks";

import { Card, Check, KindTag } from "./primitives";

function RunColumn({ run, previous, heading, dim }: { run: CheckRun; previous?: CheckRun; heading: string; dim?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-2 ${dim ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{heading}</span>
        <span className="text-xs text-muted">{run.trigger}</span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {CHECKS.map((c, i) => {
          const a = run.answers[i];
          const changed = previous?.done && run.done && previous.answers[i] !== a;
          return (
            <li key={c.key}
              className={`grid grid-cols-[1.25rem_1fr_auto] items-start gap-2 rounded-md px-2 py-1.5 ${a === "checking" ? "bg-warn-soft" : changed ? "bg-cascade-soft" : ""}`}>
              <span className="font-mono text-sm text-muted">{i + 1}.</span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm leading-snug">{c.question}</span>
                {!dim && <span className="font-mono text-[11px] leading-snug text-muted">{c.source}</span>}
              </span>
              <span className="flex flex-col items-end gap-0.5 pt-0.5">
                <Check v={a as never} />
                {changed && <span className="text-[10px] font-semibold uppercase tracking-wide text-cascade">changed</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center gap-2 px-2">
        <span className="text-sm">→ Access:</span>
        {run.done
          ? <span className={`font-mono text-sm font-semibold ${run.allowed ? "text-ok" : "text-bad"}`}>{run.allowed ? "allowed" : "denied"}</span>
          : <span className="font-mono text-sm text-muted">…</span>}
      </div>
      {run.done && !dim && (
        <p className={`px-2 text-xs ${run.agrees ? "text-muted" : "font-semibold text-bad"}`}>
          {run.agrees
            ? `The contract's explain()${run.block ? ` at block ${run.block}` : ""} agrees with these three reads. Its decision comes from the same _getRoles hook the write path uses.`
            : `MISMATCH: explain() disagrees with these reads${run.block ? ` at block ${run.block}` : ""}.`}
        </p>
      )}
    </div>
  );
}

export function ExplainPanel({ runs, target, onRecheck, busy }: { runs: CheckRun[]; target: string | null; onRecheck: () => void; busy: boolean }) {
  const [current, previous] = runs;
  return (
    <Card eyebrow="The reasoning, one live read per step" title={<span className="flex items-center gap-2">How the registry decides <KindTag kind="cascade" /></span>}
      action={
        <button type="button" onClick={onRecheck} disabled={!target || busy}
          className="shrink-0 rounded-md border border-rule px-2.5 py-1 text-xs font-medium hover:border-cascade hover:text-cascade disabled:cursor-not-allowed disabled:opacity-50">
          Re-check now (read-only)
        </button>
      }>
      {!current ? (
        <p className="text-sm text-muted">
          {target ? "Attempt a write, or re-check, to see the three checks run." : "Create a subname first. Each write then runs these three checks, one live chain read at a time:"}
        </p>
      ) : null}
      {!current && (
        <ol className="mt-2 flex flex-col gap-1 text-sm text-muted">
          {CHECKS.map((c, i) => <li key={c.key}>{i + 1}. {c.question}</li>)}
        </ol>
      )}
      <AnimatePresence initial={false}>
        {current && (
          <motion.div key={current.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-5 lg:flex-row">
            <RunColumn run={current} previous={previous} heading="Now" />
            {previous && <div className="hidden w-px bg-rule lg:block" />}
            {previous && <RunColumn run={previous} heading="Before" dim />}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
