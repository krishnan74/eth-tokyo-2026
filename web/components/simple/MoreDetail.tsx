"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";

import type { LastWrite, TxEntry } from "@/lib/cascade/hooks";

import { Activity } from "../cascade/Activity";
import { Context } from "../cascade/Context";
import { Ask, Fit, Problem, Roadmap } from "../pitch/Sections";

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
export function MoreDetail({ txs, member, lastWrite }: { txs: TxEntry[]; member?: boolean; lastWrite: LastWrite }) {
  return (
    <section id="more" className="flex scroll-mt-24 flex-col gap-6">
      <span className="label">More detail</span>
      <ul className="border-b border-line">
        <Item title="Why not root grants or a Safe?" hint="How teams work around EAC today, and what that costs."><Problem /></Item>
        <Item title="How it fits into EAC" hint="What stays exactly the same, and what changes."><Fit /></Item>
        <Item title="Roadmap" hint="From this one-hop MVP to full relationship-based access."><Roadmap /></Item>
        <Item title="Questions for the ENS team" hint="What decides where this goes next."><Ask /></Item>
        <Item title="Limits and numbers" hint="Trust assumptions, gas, and the workarounds in numbers."><Context /></Item>
        <Item title="Transaction history" hint={`${txs.length} transaction${txs.length === 1 ? "" : "s"} from this browser.`}><Activity txs={txs} member={member} lastWrite={lastWrite} /></Item>
      </ul>
    </section>
  );
}
