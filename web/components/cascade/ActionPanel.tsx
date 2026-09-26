"use client";

import type { ActionName } from "@/lib/cascade/hooks";

import { KindTag } from "./primitives";
import { ACTIONS } from "./steps";

const ORDER: ActionName[] = ["create", "write", "grant", "revoke", "hijack"];

type Props = {
  onAct: (a: ActionName) => void;
  pending: string | null;
  /** In guided mode only this action is enabled. */
  only?: ActionName | "none" | null;
  hasTarget: boolean;
  writesEnabled: boolean;
};

export function ActionPanel({ onAct, pending, only, hasTarget, writesEnabled }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {ORDER.map((a) => {
        const def = ACTIONS[a];
        const needsTarget = a === "write" && !hasTarget;
        const highlighted = only === a;
        const disabled = !writesEnabled || !!pending || needsTarget || (only !== undefined && only !== null && only !== a);
        const isPending = pending === a;
        return (
          <div key={a} className={`rounded-md border p-3 transition-colors ${highlighted ? "border-cascade bg-cascade-soft" : "border-rule"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">{def.label} <KindTag kind={def.kind} /></span>
                <span className="text-xs leading-snug text-muted">{needsTarget ? "Create a subname first." : def.consequence}</span>
              </div>
              <button type="button" onClick={() => onAct(a)} disabled={disabled} aria-busy={isPending}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 ${def.kind === "cascade" ? "bg-cascade" : "bg-native"}`}>
                {isPending ? "Waiting for the chain…" : "Run"}
              </button>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted">Each button sends a real transaction and stays disabled until its receipt arrives. Nothing is shown as landed before it has.</p>
    </div>
  );
}
