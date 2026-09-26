"use client";

import { AnimatePresence, motion } from "framer-motion";

import { STEPS } from "./steps";

type Props = {
  guided: boolean;
  setGuided: (g: boolean) => void;
  index: number;
  setIndex: (i: number) => void;
  outcome?: "success" | "reverted" | "error";
  member?: boolean;
  hasTarget: boolean;
};

export function GuidedWalkthrough({ guided, setGuided, index, setIndex, outcome, member, hasTarget }: Props) {
  if (!guided) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-rule bg-sunken px-3 py-2">
        <span className="text-sm text-muted">Free mode — every button is enabled.</span>
        <button type="button" onClick={() => setGuided(true)} className="text-sm font-medium text-cascade hover:underline">Start the guided walkthrough</button>
      </div>
    );
  }
  const step = STEPS[index]!;
  const last = index === STEPS.length - 1;
  const matched = outcome && (!step.expect || outcome === step.expect);
  // Preconditions left over from an earlier run, which would make a step show the wrong thing.
  const warn =
    step.expect === "reverted" && step.action === "write" && index < 3 && member ? "The outsider is still a member from an earlier run, so this write would succeed. Switch to free mode and remove them first, then come back." :
    step.action === "write" && !hasTarget ? "There's no subname yet. Go back to step 1." :
    null;
  return (
    <div className="rounded-md border-2 border-cascade bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-cascade">Guided · step {index + 1} of {STEPS.length}</span>
        <button type="button" onClick={() => setGuided(false)} className="text-xs text-muted hover:text-ink">Switch to free mode</button>
      </div>
      <div className="mb-3 flex gap-1" aria-hidden>
        {STEPS.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < index ? "bg-cascade" : i === index ? "bg-cascade/60" : "bg-rule"}`} />)}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={index} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">{step.title}</h3>
          <p className="text-sm leading-relaxed">{step.why}</p>
          {step.expect && <p className="text-xs text-muted">Expected result: <span className={step.expect === "success" ? "text-ok" : "text-bad"}>{step.expect === "success" ? "the transaction succeeds" : "the transaction reverts on-chain"}</span></p>}
          {warn && <p className="rounded bg-warn-soft px-2 py-1.5 text-xs text-warn">{warn}</p>}
          {!outcome && !warn && <p className="text-xs font-medium text-cascade">Press the highlighted button below.</p>}
          {outcome && (
            <p className={`text-sm font-medium ${matched ? "text-ok" : "text-bad"}`}>
              {outcome === "error" ? "The request failed before reaching the chain — see the transaction log." :
                matched ? `Done — the transaction ${outcome === "success" ? "succeeded" : "reverted"}, as expected.` : `Unexpected: the transaction ${outcome}. Check the log and the checks above.`}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="mt-3 flex justify-between">
        <button type="button" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} className="text-sm text-muted hover:text-ink disabled:opacity-40">Back</button>
        {last && outcome
          ? <button type="button" onClick={() => { setIndex(0); setGuided(false); }} className="rounded-md bg-cascade px-3 py-1.5 text-sm font-medium text-white">Finish</button>
          : <button type="button" onClick={() => setIndex(index + 1)} disabled={!outcome || last} className="rounded-md bg-cascade px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">Next step</button>}
      </div>
    </div>
  );
}
