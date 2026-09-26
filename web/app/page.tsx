"use client";

import { useEffect, useState } from "react";

import { ActionPanel } from "@/components/cascade/ActionPanel";
import { ContractHeader } from "@/components/cascade/ContractHeader";
import { CostComparison } from "@/components/cascade/CostComparison";
import { ExplainPanel } from "@/components/cascade/ExplainPanel";
import { GuidedWalkthrough } from "@/components/cascade/GuidedWalkthrough";
import { LimitationsPanel } from "@/components/cascade/LimitationsPanel";
import { NameTree } from "@/components/cascade/NameTree";
import { Card } from "@/components/cascade/primitives";
import { RelationshipGraph } from "@/components/cascade/RelationshipGraph";
import { StateSummary } from "@/components/cascade/StateSummary";
import { ACTIONS, STEPS } from "@/components/cascade/steps";
import { TransactionLog } from "@/components/cascade/TransactionLog";
import { useActors, useCascadeDemo, type ActionName } from "@/lib/cascade/hooks";

export default function Page() {
  const actors = useActors();
  const demo = useCascadeDemo(actors?.outsider);
  const [guided, setGuided] = useState(true);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<number, "success" | "reverted" | "error">>({});

  // Guided mode is on by default for a first visit; remember the viewer's choice after that.
  useEffect(() => {
    try { const g = localStorage.getItem("cascade.guided"); if (g !== null) setGuided(g === "1"); } catch { /* default */ }
  }, []);
  const chooseGuided = (g: boolean) => {
    setGuided(g);
    if (g) { setIndex(0); setOutcomes({}); }
    try { localStorage.setItem("cascade.guided", g ? "1" : "0"); } catch { /* per-visit only */ }
  };

  async function onAct(a: ActionName) {
    const status = await demo.act(a, { title: ACTIONS[a].logTitle, kind: ACTIONS[a].kind });
    if (guided && STEPS[index]?.action === a && status) setOutcomes((o) => ({ ...o, [index]: status }));
  }

  const writesEnabled = actors?.writesEnabled ?? false;
  const stepAction = guided ? STEPS[index]!.action : null;
  const stepDone = guided && outcomes[index] !== undefined;

  return (
    <>
      <ContractHeader outsider={actors?.outsider} operator={actors?.operator} writesEnabled={actors ? writesEnabled : undefined} />
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
        {/* Its own grid, so the sticky side column can never slide over the sections below. */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <RelationshipGraph member={demo.live.member} parentGrantsTeam={demo.live.parentGrantsTeam}
            access={demo.target ? demo.live.targetAccess : undefined} target={demo.target} />
          <ExplainPanel runs={demo.runs} target={demo.target} onRecheck={demo.recheck} busy={!!demo.pending} />
          <NameTree subnames={demo.subnames} target={demo.target} targetAccess={demo.live.targetAccess} />
        </div>

        {/* State and actions stay on screen; the column scrolls on its own if taller than the window. */}
        <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pb-2">
          <StateSummary fqdn={demo.fqdn} member={demo.live.member} lastWrite={demo.lastWrite} />
          <Card eyebrow="Drive the demo" title="Actions">
            <div className="flex flex-col gap-3">
              <GuidedWalkthrough guided={guided} setGuided={chooseGuided} index={index} setIndex={setIndex}
                outcome={outcomes[index]} member={demo.live.member} hasTarget={!!demo.target} />
              <ActionPanel onAct={onAct} pending={demo.pending} hasTarget={!!demo.target} writesEnabled={writesEnabled}
                only={guided ? (stepDone ? "none" : stepAction) : null} />
            </div>
          </Card>
          <TransactionLog txs={demo.txs} />
        </aside>
        </div>

        <div className="flex flex-col gap-5">
          <LimitationsPanel />
          <CostComparison />
          <footer className="pb-6 text-xs text-muted">
            The same contracts, checks and numbers drive the terminal demo (<span className="font-mono">npm run demo</span>), which also runs the wallet-as-team and parent re-issue edge cases. Source for the checks: <span className="font-mono">core/cascade/explain.ts</span>, shared by both.
          </footer>
        </div>
      </main>
    </>
  );
}
