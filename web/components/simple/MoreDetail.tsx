"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";

import type { LastWrite, TxEntry } from "@/lib/cascade/hooks";
import { V2_TITLES, type V2ActionName, type V2Result } from "@/lib/cascade/v2hooks";

import { Activity } from "../cascade/Activity";
import { Context } from "../cascade/Context";
import { Fit, Problem } from "../pitch/Sections";

function Item({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-t border-line">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-6 py-5 text-left">
        <span className="flex flex-col gap-0.5">
          <span className="text-lg font-medium">{title}</span>
          <span className="text-sm text-muted">{hint}</span>
        </span>
        <span className={`text-2xl leading-none text-muted transition-transform duration-300 ${open ? "rotate-45" : ""}`} aria-hidden>+</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pb-12 pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Everything that isn't needed to understand the idea — kept, one click away. */
export function MoreDetail({ txs, member, lastWrite, cascadeLog }: { txs: TxEntry[]; member?: boolean; lastWrite: LastWrite; cascadeLog: { id: number; action: V2ActionName; result: V2Result }[] }) {
  return (
    <section id="more" className="flex scroll-mt-24 flex-col gap-6">
      <span className="label">More detail</span>
      <ul className="border-b border-line">
        <Item title="Why not root grants or a Safe?" hint="How teams work around EAC today, and what that costs."><Problem /></Item>
        <Item title="How it fits into EAC" hint="What stays exactly the same, and what changes."><Fit /></Item>
        <Item title="Limits and numbers" hint="Trust assumptions, gas, and the workarounds in numbers."><Context /></Item>
        <Item title="Transaction history" hint={`${cascadeLog.length + txs.length} transaction${cascadeLog.length + txs.length === 1 ? "" : "s"} from this browser.`}>
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <span className="label">Cascade drive</span>
              {!cascadeLog.length && <p className="text-sm text-muted">Nothing yet.</p>}
              <ol className="flex flex-col gap-1.5">
                {cascadeLog.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm ring-1 ring-line">
                    <span>{V2_TITLES[l.action]}</span>
                    <span className="flex items-center gap-3 font-mono text-[11px]">
                      <span className={l.result.error || l.result.status === "reverted" ? "text-bad" : "text-ok"}>{l.result.error ? "error" : l.result.noop ? "no-op" : l.result.status}</span>
                      {l.result.hash && <a href={`https://sepolia.etherscan.io/tx/${l.result.hash}`} target="_blank" rel="noreferrer" className="text-muted underline underline-offset-2">{l.result.hash.slice(0, 10)}… ↗</a>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col gap-2">
              <span className="label">One-folder drive</span>
              <Activity txs={txs} member={member} lastWrite={lastWrite} />
            </div>
          </div>
        </Item>
      </ul>
    </section>
  );
}
