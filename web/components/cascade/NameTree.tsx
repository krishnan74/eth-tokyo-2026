"use client";

import { AnimatePresence, motion } from "framer-motion";

import { ORG, TEAM_NAME } from "@/lib/cascade/contracts";

import { Card, KindTag } from "./primitives";

export function NameTree({ subnames, target, targetAccess }: { subnames: string[]; target: string | null; targetAccess?: boolean }) {
  return (
    <Card eyebrow="Where everything sits" title="Name hierarchy">
      <ul className="flex flex-col gap-2 font-mono text-sm">
        <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-medium">{ORG}.eth</span>
          <span className="font-sans text-xs text-muted">the organisation — its registry is unmodified ENSv2 code</span>
          <KindTag kind="native" />
        </li>
        <li className="ml-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l border-rule pl-3">
          <span className="font-medium">{TEAM_NAME}</span>
          <span className="font-sans text-xs text-muted">TeamRegistry has editor rights here (ROLE_SET_SUBREGISTRY); its subnames live in CascadeSubregistry</span>
          <KindTag kind="cascade" />
        </li>
        <li className="ml-8 border-l border-rule pl-3">
          {subnames.length === 0 && <span className="font-sans text-xs text-muted">No subnames created yet. Each one you create appears here.</span>}
          <ul className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {subnames.map((s) => (
                <motion.li key={s} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={s === target ? "font-medium underline decoration-2 underline-offset-2" : "text-muted"}>{s}.{TEAM_NAME}</span>
                  {s === target
                    ? <span className="font-sans text-xs">
                        current target · outsider access{" "}
                        {targetAccess === undefined ? <span className="text-muted">reading…</span> : targetAccess ? <span className="font-semibold text-ok">✓</span> : <span className="font-semibold text-bad">✗</span>}
                      </span>
                    : <span className="font-sans text-xs text-muted">created earlier in this browser; nobody was ever granted anything on it</span>}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </li>
      </ul>
    </Card>
  );
}
