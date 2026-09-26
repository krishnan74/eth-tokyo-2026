"use client";

import { AnimatePresence, motion } from "framer-motion";

import { etherscanTx } from "@/lib/cascade/contracts";
import type { LastWrite, TxEntry } from "@/lib/cascade/hooks";
import { IS_FORK } from "@/lib/cascade/wagmi";

import { Flash } from "./primitives";

const DOT: Record<TxEntry["status"], string> = {
  sending: "bg-faint pulse", pending: "bg-warn pulse", success: "bg-ok", reverted: "bg-bad", error: "bg-bad",
};
const STATUS: Record<TxEntry["status"], string> = {
  sending: "sending", pending: "in mempool", success: "success", reverted: "reverted", error: "not sent",
};

function Chip({ label, value, tone, flashKey }: { label: string; value: string; tone: "ok" | "bad" | "muted"; flashKey: string }) {
  const color = { ok: "text-ok", bad: "text-bad", muted: "text-muted" }[tone];
  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-lg bg-surface px-3 py-2 ring-1 ring-line">
      <span className="label">{label}</span>
      <Flash value={flashKey}><span className={`text-sm font-semibold ${color}`}>{value}</span></Flash>
    </div>
  );
}

export function Activity({ txs, member, lastWrite }: { txs: TxEntry[]; member?: boolean; lastWrite: LastWrite }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Chip label="Member" flashKey={String(member)} value={member === undefined ? "…" : member ? "Yes" : "No"} tone={member === undefined ? "muted" : member ? "ok" : "bad"} />
        <Chip label="Last write" flashKey={lastWrite ? `${lastWrite.status}${lastWrite.at}` : "none"}
          value={!lastWrite ? "None" : lastWrite.status === "success" ? "Succeeded" : "Reverted"} tone={!lastWrite ? "muted" : lastWrite.status === "success" ? "ok" : "bad"} />
      </div>

      <div className="flex items-baseline justify-between">
        <span className="label">Activity</span>
        <span className="text-[11px] text-muted">{txs.length ? `${txs.length} transaction${txs.length > 1 ? "s" : ""}` : ""}</span>
      </div>
      {txs.length === 0 && <p className="text-sm text-muted">Transactions you send appear here, with gas and an Etherscan link.</p>}
      <ol className="relative flex flex-col">
        {txs.length > 0 && <span className="absolute bottom-3 left-[5px] top-3 w-px bg-line" aria-hidden />}
        <AnimatePresence initial={false}>
          {txs.map((t) => (
            <motion.li key={t.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="relative flex gap-3 pb-4 last:pb-0">
              <span className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-bg ${DOT[t.status]}`} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm leading-snug">{t.title}</span>
                <span className="flex flex-wrap gap-x-2 text-xs text-muted">
                  <span className={t.status === "success" ? "text-ok" : t.status === "reverted" || t.status === "error" ? "text-bad" : ""}>{STATUS[t.status]}</span>
                  {t.gas && <span className="tabular font-mono">{Number(t.gas).toLocaleString()} gas</span>}
                  {t.hash && (IS_FORK
                    ? <span className="font-mono">{t.hash.slice(0, 8)}… (fork)</span>
                    : <a href={etherscanTx(t.hash)} target="_blank" rel="noreferrer" className="font-mono underline decoration-line underline-offset-2 hover:text-cascade">{t.hash.slice(0, 8)}… ↗</a>)}
                </span>
                {t.reason && <span className="font-mono text-[11px] text-bad">{t.reason}</span>}
                {t.error && <span className="text-xs text-bad">{t.error}</span>}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}
