"use client";

import { AnimatePresence, motion } from "framer-motion";

import { etherscanTx } from "@/lib/cascade/contracts";
import type { TraceState } from "@/lib/cascade/hooks";
import type { TraceNode } from "@/lib/cascade/trace";
import { IS_FORK } from "@/lib/cascade/wagmi";

/** Plain-language notes on what each real call in the trace means. */
function note(n: TraceNode): string | null {
  if (n.kind === "call") {
    if (n.fn === "setSubregistry") return "The outsider's write. Before it runs, ENS checks the name hasn't expired, then asks for the caller's roles — which goes through Cascade's one override, _getRoles.";
    if (n.fn === "roles" && n.contract === "OrgRegistry") return "Cascade asks the parent: which roles does the team hold on devops? Read-only, capped at 50k gas.";
    if (n.fn === "isMember") return "Cascade asks the team roster: is this caller a member? Read-only, capped at 30k gas.";
    if (n.fn === "grantRoles" && n.contract === "TeamRegistry") return "One ordinary EAC grant on the roster. Nothing is written to any name.";
    if (n.fn === "revokeRoles" && n.contract === "TeamRegistry") return "One ordinary EAC revoke on the roster. No per-name cleanup.";
    if (n.fn === "register") return "A new subname is created. Nobody is granted the editor role on it.";
    if (n.fn === "setTeam") return "An attempt to change which team Cascade reads. It needs ROLE_SET_TEAM on the registry.";
    if (n.fn === "setLabel") return "ENS stores the label text so the name can be read back.";
    // Roadmap (CascadeSubregistryV2)
    if (n.fn === "getSubregistry") return "Link check: does this ancestor really point down to the registry below it? A level only counts if it does.";
    if (n.fn === "getParent") return "Walk up one level of the name tree, using ENSv2's own parent pointer.";
    if (n.fn === "decodeParent") return "The ancestor's reply is decoded in a self-call, so malformed data can only end the walk.";
    if (n.fn === "roles" && n.contract === "AcmeLabsRegistry") return "Level 1: which roles does this team hold on platform? Read-only, capped.";
    if (n.fn === "roles" && n.contract === "EthRegistry") return "Level 2: which roles does this team hold on acme-labs.eth itself, two levels up?";
    if (n.fn === "isMemberWithin") return "The nested team asks its sub-team, passing the remaining depth down.";
    if (n.fn === "setResolver") return "The outsider's resolver write. Allowed only if a team grant at some level covers SET_RESOLVER.";
  }
  if (n.kind === "event" && n.fn === "SubregistryUpdated") return "Allowed — the subname's pointer was written.";
  if (n.kind === "event" && n.fn === "ResolverUpdated") return "Allowed — the subname's resolver was written.";
  if (n.kind === "event" && n.fn === "EACRolesChanged") return "EAC's own event for the membership change.";
  if (n.kind === "revert" && /EACUnauthorizedAccountRoles/.test(n.value ?? "")) return "No role → the call is refused before anything changes.";
  return null;
}

function Line({ n }: { n: TraceNode }) {
  const pad = { paddingLeft: `${n.depth * 20}px` };
  const tip = note(n);
  let body: React.ReactNode;
  if (n.kind === "call") {
    body = (
      <span className="break-words">
        <span className="text-ink">{n.contract}</span><span className="text-muted">.</span><span className="font-semibold text-cascade">{n.fn}</span>
        <span className="text-muted">({n.args})</span>
        {n.staticcall && <span className="ml-2 rounded bg-sunken px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-2">read-only</span>}
        <span className="ml-2 text-[11px] text-muted tabular">{n.gas?.toLocaleString()} gas</span>
      </span>
    );
  } else if (n.kind === "event") {
    body = <span className="break-words"><span className="text-ok">emit {n.fn}</span><span className="text-muted">({n.args})</span></span>;
  } else if (n.kind === "revert") {
    body = <span className="break-words font-semibold text-bad">↳ reverted: {n.value}</span>;
  } else if (n.kind === "return") {
    body = <span className="break-words text-ink-2">↳ returned {n.value}</span>;
  } else {
    body = <span className="text-muted">↳ done</span>;
  }
  return (
    <li className="flex flex-col gap-1 border-l border-line py-1.5 pl-3" style={pad}>
      <span className="font-mono text-[12px] leading-relaxed">{body}</span>
      {tip && <span className="text-xs leading-snug text-muted">{tip}</span>}
    </li>
  );
}

/** "Behind the scenes": the EVM's own call tree for the last action, plus the internal steps from source. */
export function TracePanel({ trace }: { trace: TraceState }) {
  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--line)] sm:p-6">
      <div className="flex flex-col gap-1">
        <span className="label">Behind the scenes</span>
        <p className="text-sm text-ink-2">The real smart-contract calls your last action made on ENSv2, replayed from the mined transaction.</p>
      </div>
      {!trace && <p className="rounded-2xl bg-paper p-4 text-sm text-muted">Do something in the drive above — the contract calls it makes will appear here, step by step.</p>}
      <AnimatePresence mode="wait">
        {trace && (
          <motion.div key={trace.hash} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
              <span className="text-sm font-medium">{trace.title}</span>
              <span className="flex items-center gap-2 font-mono text-[11px]">
                {trace.status && <span className={trace.status === "success" ? "text-ok" : "text-bad"}>{trace.status}</span>}
                {trace.gas && <span className="text-muted tabular">{Number(trace.gas).toLocaleString()} gas</span>}
                {!IS_FORK && <a href={etherscanTx(trace.hash)} target="_blank" rel="noreferrer" className="text-muted underline underline-offset-2 hover:text-cascade">{trace.hash.slice(0, 10)}… ↗</a>}
              </span>
            </div>
            {trace.loading && <p className="flex items-center gap-2 text-sm text-muted"><span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-r-transparent" /> Replaying the transaction…</p>}
            {trace.error && <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">Trace unavailable: {trace.error}</p>}
            {trace.data && (
              <>
                {trace.action === "write" && (
                  <div className="rounded-xl bg-paper px-3 py-2 font-mono text-[11px] leading-relaxed text-muted">
                    inside CascadeSubregistry (from the contract source, not separate calls):<br />
                    setSubregistry → _checkExpiryAndTokenRoles → _checkRoles → hasRoles → <span className="text-cascade">_getRoles (Cascade&apos;s override)</span>
                  </div>
                )}
                <ol className="flex flex-col">{trace.data.nodes.map((n, i) => <Line key={i} n={n} />)}</ol>
                {trace.data.mode === "quick" && (
                  <p className="text-xs text-muted">Quick replay: run on the state just before this block, without re-executing other transactions in the same block (the full replay wasn&apos;t available from this RPC).</p>
                )}
                <details className="text-xs text-muted">
                  <summary className="cursor-pointer hover:text-ink">Raw trace from cast run</summary>
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-paper p-3 font-mono text-[11px] leading-relaxed text-ink-2">{trace.data.raw}</pre>
                </details>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
