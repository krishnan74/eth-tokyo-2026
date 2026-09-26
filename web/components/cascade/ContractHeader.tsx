"use client";

import { SEPOLIA } from "@/lib/cascade/contracts";
import { IS_FORK } from "@/lib/cascade/wagmi";

import { Address } from "./primitives";

export function ContractHeader({ outsider, operator, writesEnabled }: { outsider?: string | null; operator?: string | null; writesEnabled?: boolean }) {
  return (
    <header className="border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold tracking-tight">Cascade</h1>
            <span className="text-sm text-muted">team-governed subnames on ENSv2</span>
          </div>
          <p className="text-sm font-medium">
            {IS_FORK
              ? <span className="text-warn">Anvil fork of Sepolia — a rehearsal. Transactions are real on the fork only.</span>
              : <>Live contracts on Sepolia. Every action below is a real transaction.</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          <Address label="Org registry" value={SEPOLIA.parent} />
          <Address label="CascadeSubregistry" value={SEPOLIA.cascade} />
          <Address label="TeamRegistry" value={SEPOLIA.team} />
          {outsider && <Address label="Outsider" value={outsider} />}
          {operator && <Address label="Operator" value={operator} />}
          <span className="font-mono text-xs text-muted">network: {IS_FORK ? "anvil fork (chain 11155111)" : "Sepolia · ENSv2 beta deployment"}</span>
        </div>
        {writesEnabled === false && (
          <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
            Transactions are turned off on this server, so the buttons are disabled. Everything shown is still read live from the chain. Run it locally with <code className="font-mono">npm run ui</code> to drive the demo.
          </p>
        )}
      </div>
    </header>
  );
}
