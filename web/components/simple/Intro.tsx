import { Reveal } from "../pitch/Reveal";

/** The whole idea, in the order a newcomer needs it: what it is, what's broken in ENS, what changes. */
export function Intro() {
  return (
    <section className="flex flex-col gap-14 pt-14 md:pt-20">
      <div className="flex max-w-4xl flex-col gap-6">
        <span className="label"><span className="text-cascade">Cascade</span> · team access for ENSv2 names</span>
        <h1 className="display text-[clamp(3rem,8vw,7rem)]">Share ENS names like a <span className="italic text-cascade">folder</span>.</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-ink-2">
          In a shared drive you share a folder with a group, and everyone in the group can edit every file inside — including files added later. Cascade brings that to ENSv2 names: a name trusts a team, and the team&apos;s members can manage every subname under it. Built into ENSv2&apos;s own access control, replacing nothing.
        </p>
      </div>

      <div id="problem" className="grid scroll-mt-24 gap-5 md:grid-cols-2">
        <Reveal className="flex flex-col gap-4 rounded-3xl bg-surface p-6 shadow-[inset_0_0_0_1px_var(--line)] sm:p-8">
          <span className="label">In ENS today</span>
          <p className="text-xl font-medium leading-snug">Like sharing <span className="text-bad">each file with each person.</span></p>
          <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-x-3 gap-y-2 font-mono text-xs">
            <span />{["svc-api", "svc-db", "svc-cdn"].map((n) => <span key={n} className="text-muted">{n}</span>)}
            {["Alice", "Bob"].map((p) => (
              <span key={p} className="contents">
                <span className="font-sans text-sm">{p}</span>
                {[0, 1, 2].map((i) => <span key={i} className="rounded bg-sunken px-2 py-1 text-ink-2">grant</span>)}
              </span>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-ink-2">Every ENS permission is one address on one name. Two people, three names: six separate grants. A new name needs new grants for everyone; someone leaving means finding and revoking each one.</p>
        </Reveal>
        <Reveal delay={0.08} className="flex flex-col gap-4 rounded-3xl bg-inv p-6 text-inv-fg sm:p-8">
          <span className="label !text-inv-muted">With Cascade</span>
          <p className="text-xl font-medium leading-snug">Like sharing <span className="text-inv-accent">the folder with a group</span>.</p>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="rounded bg-white/10 px-2 py-1">devops.acme-corp.eth</span>
            <span className="text-inv-muted">→ one grant →</span>
            <span className="rounded bg-white/10 px-2 py-1 text-inv-accent">devops team</span>
            <span className="text-inv-muted">→</span>
            <span className="rounded bg-white/10 px-2 py-1">Alice, Bob</span>
          </div>
          <p className="text-sm leading-relaxed text-inv-muted">One grant covers every name under devops, today&apos;s and tomorrow&apos;s. Joining or leaving is one change to the team. Everything EAC already does keeps working exactly as before.</p>
        </Reveal>
      </div>
    </section>
  );
}
