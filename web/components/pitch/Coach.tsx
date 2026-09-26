"use client";

import { AnimatePresence, motion } from "framer-motion";

import { STEPS } from "../cascade/steps";
import { EASE } from "./Reveal";

type Outcome = "success" | "reverted" | "error";

/** The guided walkthrough, docked above the board: what to do, why, what to expect, what happened. */
export function Coach({ guided, setGuided, index, setIndex, outcome, member, hasTarget, blocked }: {
  guided: boolean; setGuided: (g: boolean) => void; index: number; setIndex: (i: number) => void;
  outcome?: Outcome; member?: boolean; hasTarget: boolean; blocked: string | null;
}) {
  const toggle = (
    <div className="inline-flex rounded-full bg-sunken p-0.5 text-xs" role="tablist" aria-label="Mode">
      {([["Guided", true], ["Free play", false]] as const).map(([label, g]) => (
        <button key={label} type="button" role="tab" aria-selected={guided === g} onClick={() => setGuided(g)}
          className={`rounded-full px-3 py-1 font-medium transition ${guided === g ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{label}</button>
      ))}
    </div>
  );

  if (!guided) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">Free play — drag, drop and write in any order. Every action is a real transaction.</p>
        {toggle}
      </div>
    );
  }

  const step = STEPS[index]!;
  const last = index === STEPS.length - 1;
  const matched = outcome && outcome !== "error" && (!step.expect || outcome === step.expect);
  const warn =
    step.action === "write" && !hasTarget ? "There's no subname yet — go back to step 1." :
    step.action === "write" && step.expect === "reverted" && index < 3 && member ? "The outsider is still in the team from an earlier run. Switch to Free play, drag them out, then come back." :
    null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="label"><span className="text-cascade">{String(index + 1).padStart(2, "0")}</span> / {String(STEPS.length).padStart(2, "0")}</span>
          <div className="flex gap-1" aria-hidden>
            {STEPS.map((_, i) => (
              <motion.span key={i} className="h-[3px] rounded-full" initial={false}
                animate={{ width: i === index ? 28 : 12, backgroundColor: i < index ? "var(--ink)" : i === index ? "var(--cascade)" : "var(--line)" }}
                transition={{ duration: 0.5, ease: EASE }} />
            ))}
          </div>
        </div>
        {toggle}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <AnimatePresence mode="wait">
          <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45, ease: EASE }}
            className="flex flex-col gap-1.5">
            <h3 className="display text-3xl sm:text-4xl">{step.title}</h3>
            <p className="text-sm font-medium text-cascade">{step.how}</p>
            <p className="max-w-2xl text-sm leading-relaxed text-ink-2">{step.why}</p>
          </motion.div>
        </AnimatePresence>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          {!outcome && step.expect && (
            <span className="text-xs text-muted">Expect it to <span className={step.expect === "success" ? "text-ok" : "text-bad"}>{step.expect === "success" ? "succeed" : "revert"}</span></span>
          )}
          {outcome && (
            <motion.span initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
              className={`text-sm font-medium ${outcome === "error" ? "text-bad" : matched ? "text-ok" : "text-bad"}`}>
              {outcome === "error" ? "Didn't reach the chain — see the log." : matched ? (outcome === "success" ? "✓ Succeeded, as expected" : "✗ Reverted, as expected") : `Unexpected: ${outcome}`}
            </motion.span>
          )}
          <button type="button" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}
            className="rounded-full px-3 py-2 text-sm text-muted hover:text-ink disabled:opacity-0">Back</button>
          {last && outcome
            ? <button type="button" onClick={() => { setIndex(0); setGuided(false); }} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper">Finish</button>
            : <button type="button" onClick={() => setIndex(index + 1)} disabled={!outcome || last}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition disabled:opacity-25">Continue</button>}
        </div>
      </div>
      <AnimatePresence>
        {(warn || blocked) && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">{warn ?? blocked}</motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
