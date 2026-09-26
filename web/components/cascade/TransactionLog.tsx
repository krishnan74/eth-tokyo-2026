"use client";

import { AnimatePresence, motion } from "framer-motion";

import { etherscanTx } from "@/lib/cascade/contracts";
import type { TxEntry } from "@/lib/cascade/hooks";
import { IS_FORK } from "@/lib/cascade/wagmi";

import { Card, KindTag } from "./primitives";

const STATUS: Record<TxEntry["status"], { text: string; cls: string }> = {
  sending: { text: "sending…", cls: "text-muted" },
  pending: { text: "waiting for block…", cls: "text-warn" },
  success: { text: "✓ success", cls: "text-ok" },
  reverted: { text: "✗ reverted", cls: "text-bad" },
  error: { text: "not sent", cls: "text-bad" },
};

export function TransactionLog({ txs }: { txs: TxEntry[] }) {
  return (
    <Card eyebrow="Every transaction, newest first" title="Transaction log">
      {txs.length === 0 && <p className="text-sm text-muted">Nothing sent yet. Each action you run appears here with its gas and an Etherscan link.</p>}
      <ol className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {txs.map((t) => (
            <motion.li key={t.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-1 rounded-md border border-rule px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm leading-snug">{t.title}</span>
                <span className={`shrink-0 font-mono text-xs font-semibold ${STATUS[t.status].cls}`}>{STATUS[t.status].text}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <KindTag kind={t.kind} />
                {t.gas && <span className="tabular font-mono">gas {Number(t.gas).toLocaleString()}</span>}
                {t.hash && (IS_FORK
                  ? <span className="font-mono">{t.hash.slice(0, 10)}… (fork)</span>
                  : <a href={etherscanTx(t.hash)} target="_blank" rel="noreferrer" className="font-mono underline underline-offset-2 hover:text-cascade">{t.hash.slice(0, 10)}… on Etherscan</a>)}
                <span>{new Date(t.at).toLocaleTimeString()}</span>
              </div>
              {t.reason && <span className="font-mono text-xs text-bad">revert reason: {t.reason}</span>}
              {t.error && <span className="text-xs text-bad">{t.error}</span>}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </Card>
  );
}
