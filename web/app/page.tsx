"use client";

import { useState } from "react";

import { ACTIONS } from "@/components/cascade/steps";
import { TopBar } from "@/components/cascade/TopBar";
import { DriveDemo } from "@/components/drive/DriveDemo";
import { DriveDemoV2 } from "@/components/drive/DriveDemoV2";
import { Architecture } from "@/components/simple/Architecture";
import { Intro, ProblemCards } from "@/components/simple/Intro";
import { MoreDetail } from "@/components/simple/MoreDetail";
import { TracePanel } from "@/components/simple/TracePanel";
import { TraceToast } from "@/components/simple/TraceToast";
import { useActors, useCascadeDemo, type ActionName } from "@/lib/cascade/hooks";
import { useV2Demo } from "@/lib/cascade/v2hooks";

type Tab = "cascade" | "single";

export default function Page() {
  const actors = useActors();
  const v2 = useV2Demo(); // the cascade drive: CascadeSubregistryV2 on acme-labs.eth
  const v1 = useCascadeDemo(actors?.outsider); // the one-folder drive: CascadeSubregistry on devops.acme-corp.eth
  const [tab, setTab] = useState<Tab>("cascade");
  const writesEnabled = actors?.writesEnabled ?? false;
  const lastHijack = v1.txs.find((t) => t.title === ACTIONS.hijack.logTitle);
  const actV1 = (a: ActionName, label?: string) => v1.act(a, { title: ACTIONS[a].logTitle, kind: ACTIONS[a].kind }, label);

  return (
    <>
      <TopBar outsider={actors?.outsider} operator={actors?.operator} writesEnabled={actors ? writesEnabled : undefined} />

      <main className="relative z-10 mx-auto flex max-w-7xl flex-col gap-20 px-4 pb-24 sm:px-8">
        <Intro />

        <ProblemCards />

        <section id="try" className="flex scroll-mt-20 flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex max-w-3xl flex-col gap-3">
              <span className="label">Try it · live on Sepolia</span>
              <h2 className="display text-[clamp(2.2rem,4.6vw,3.8rem)]">Share a folder, <span className="italic text-muted">and everything below follows.</span></h2>
            </div>
            <div role="tablist" aria-label="Demo" className="flex rounded-full bg-sunken p-1 text-sm">
              {([["cascade", "Cascade · folders inside folders"], ["single", "One folder"]] as const).map(([t, label]) => (
                <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)}
                  className={`rounded-full px-4 py-1.5 transition ${tab === t ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{label}</button>
              ))}
            </div>
          </div>

          {tab === "cascade" ? (
            <>
              {v2.readError && <p className="rounded-xl bg-bad-soft px-4 py-2 text-sm text-bad">Could not read the contracts: {v2.readError}</p>}
              <DriveDemoV2 state={v2.state} files={v2.files} target={v2.target} setTarget={v2.setTarget} pending={v2.pending}
                elapsed={v2.elapsed} last={v2.last} trace={v2.trace} act={v2.act} />
            </>
          ) : (
            <>
              <DriveDemo outsider={actors?.outsider} member={v1.live.member} grant={v1.live.parentGrantsTeam}
                subnames={v1.subnames} access={v1.access} target={v1.target} setTarget={v1.setTarget}
                stored={v1.target ? v1.live.storedRoles : undefined} effective={v1.target ? v1.live.effectiveRoles : undefined}
                pending={v1.pending} writesEnabled={writesEnabled} lastHijack={lastHijack} act={actV1} onReset={() => { actV1("reset"); }} />
              {v1.notice && <p className="rounded-xl bg-ok-soft px-4 py-2 text-sm text-ok">{v1.notice}</p>}
            </>
          )}
        </section>

        <section id="trace" className="scroll-mt-20">
          <TracePanel trace={tab === "cascade" ? v2.trace : v1.trace} />
        </section>

        <Architecture />

        <MoreDetail txs={v1.txs} member={v1.live.member} lastWrite={v1.lastWrite} cascadeLog={v2.log} />

        <TraceToast trace={tab === "cascade" ? v2.trace : v1.trace} />

        <footer className="flex flex-col gap-3 border-t border-line pt-8 text-sm text-muted">
          <span className="display text-4xl text-ink">ENS Drive<span className="text-cascade">.</span></span>
          <p className="max-w-3xl">Powered by Cascade, a ReBAC permission layer for ENSv2 · ENSv2 beta on Sepolia · built on <span className="font-mono">ensdomains/contracts-v2@48b3e2d</span> · up to 4 teams per folder, teams of teams, sharing that flows up to 3 folders down · not audited.</p>
        </footer>
      </main>
    </>
  );
}
