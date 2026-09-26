"use client";

import { costOfAccess } from "@/lib/cascade/explain";

export function CostComparison() {
  const c = costOfAccess();
  return (
    <details className="group rounded-lg border border-rule bg-surface p-5">
      <summary className="cursor-pointer list-none text-lg font-semibold">
        <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
        What it takes to keep a team's access correct
      </summary>
      <p className="mt-3 text-sm text-muted">A team of {c.teamSize}, {c.subnames} subnames per registry, {c.registries} registries the team manages. The same numbers the terminal demo prints.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr><th className="py-2 pr-4 font-medium">Approach</th><th className="py-2 pr-4 font-medium">Grants to maintain</th><th className="py-2 font-medium">When someone joins or leaves</th></tr>
          </thead>
          <tbody>
            {c.rows.map((r) => (
              <tr key={r.approach} className={`border-t border-rule ${r.cascade ? "bg-cascade-soft" : ""}`}>
                <td className={`py-2 pr-4 ${r.cascade ? "font-semibold text-cascade" : ""}`}>{r.approach}</td>
                <td className="tabular py-2 pr-4 font-mono">{r.grants} <span className="text-xs text-muted">({r.formula})</span></td>
                <td className="py-2">{r.churn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm">{c.note}</p>
    </details>
  );
}
