import { Reveal } from "../pitch/Reveal";

/** The whole idea in one screen: what it is, what's missing in ENS, what changes — then straight to the demo. */
export function Intro() {
  return (
    <section className="flex flex-col gap-10 pt-12 md:pt-16">
      <div className="flex max-w-4xl flex-col gap-5">
        <span className="label"><span className="text-cascade">ENS Drive</span> · Google Drive–style sharing for ENS names</span>
        <h1 className="display text-[clamp(3rem,8vw,7rem)]">Share ENS names like a <span className="italic text-cascade">folder</span>.</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-ink-2">
          Share a name with a team, and the team can manage every name under it — including names added later, and names in the folders below. Built into ENSv2&apos;s own access control, replacing nothing.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a href="#try" className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-cascade">Try it live ↓</a>
          <span className="flex items-center gap-2 text-sm text-muted"><span className="h-2 w-2 rounded-full bg-ok" aria-hidden /> Real contracts on the ENSv2 beta (Sepolia) · every click is a transaction</span>
        </div>
      </div>

      {/* The one message: ENSv2 has the tree; ENS Drive adds the permission layer (Cascade). */}
      <Reveal className="grid overflow-hidden rounded-3xl ring-1 ring-line md:grid-cols-3">
        <div className="flex flex-col gap-2 bg-surface p-6">
          <span className="flex items-center gap-2 text-sm font-medium"><span className="grid h-5 w-5 place-items-center rounded-full bg-ok-soft text-xs text-ok">✓</span>The directory tree</span>
          <p className="text-sm leading-relaxed text-ink-2"><span className="font-medium text-ink">ENSv2 already built it.</span> Every name can have its own registry, so names nest like folders: <span className="font-mono text-xs">orbit-dao.eth › protocol › vault</span>. But every folder is a separate registry with its own permission list — so a team&apos;s access multiplies with every folder.</p>
        </div>
        <div className="flex flex-col gap-2 border-t border-line bg-surface p-6 md:border-l md:border-t-0">
          <span className="flex items-center gap-2 text-sm font-medium"><span className="grid h-5 w-5 place-items-center rounded-full bg-bad-soft text-xs text-bad">✗</span>The sharing layer</span>
          <p className="text-sm leading-relaxed text-ink-2"><span className="font-medium text-ink">Missing.</span> Permissions are granted one address on one name. There&apos;s no way to share a folder with a group.</p>
          <p className="text-sm leading-relaxed text-ink-2">A web3 org's team of 5 managing 20 names across 3 folders: <span className="font-medium text-bad">300 grants</span>, and <span className="font-medium text-bad">60 revokes</span> when someone leaves. <span className="text-muted">(ENSv2&apos;s registry-wide grants cut it to 15 — but every join or leave still touches every folder. A worked example.)</span></p>
        </div>
        <div className="flex flex-col gap-2 border-t border-line bg-inv p-6 text-inv-fg md:border-t-0">
          <span className="flex items-center gap-2 text-sm font-medium"><span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-xs text-inv-accent">→</span>ENS Drive adds it</span>
          <p className="text-sm leading-relaxed text-inv-muted">With <span className="font-medium text-inv-fg">Cascade</span>, a permission layer on ENSv2&apos;s own access control using <span className="font-medium text-inv-fg">relationship-based access control (ReBAC)</span>: a name trusts a team, the team&apos;s members inherit, and sharing flows down the tree — checked live, nothing copied.</p>
        </div>
      </Reveal>
    </section>
  );
}

/** The before/after, for anyone who wants the problem spelled out — placed after the demo. */
export function ProblemCards() {
  return (
    <section id="problem" className="grid scroll-mt-24 gap-5 md:grid-cols-2">
      <Reveal className="flex flex-col gap-4 rounded-3xl bg-surface p-6 shadow-[inset_0_0_0_1px_var(--line)] sm:p-8">
        <span className="label">In ENS today</span>
        <p className="text-xl font-medium leading-snug">Like sharing <span className="text-bad">each file with each person.</span></p>
        <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-x-3 gap-y-2 font-mono text-xs">
          <span />{["vault", "oracle", "bridge"].map((n) => <span key={n} className="text-muted">{n}</span>)}
          {["Alice", "Bob"].map((p) => (
            <span key={p} className="contents">
              <span className="font-sans text-sm">{p}</span>
              {[0, 1, 2].map((i) => <span key={i} className="rounded bg-sunken px-2 py-1 text-ink-2">grant</span>)}
            </span>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-ink-2">Every ENS permission is one address on one name. Two people, three names: six separate grants. A new name needs new grants for everyone; someone leaving means finding and revoking each one — in every registry of the tree.</p>
      </Reveal>
      <Reveal delay={0.08} className="flex flex-col gap-4 rounded-3xl bg-inv p-6 text-inv-fg sm:p-8">
        <span className="label !text-inv-muted">With ENS Drive</span>
        <p className="text-xl font-medium leading-snug">Like sharing <span className="text-inv-accent">the folder with a group</span>.</p>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="rounded bg-white/10 px-2 py-1">orbit-dao.eth</span>
          <span className="text-inv-muted">→ one grant →</span>
          <span className="rounded bg-white/10 px-2 py-1 text-inv-accent">security-council</span>
          <span className="text-inv-muted">→</span>
          <span className="rounded bg-white/10 px-2 py-1">every name below</span>
        </div>
        <p className="text-sm leading-relaxed text-inv-muted">One grant covers every name under the folder, today&apos;s and tomorrow&apos;s, and flows into the folders below. Joining or leaving is one change to the team. Everything ENSv2&apos;s access control already does keeps working exactly as before.</p>
      </Reveal>
    </section>
  );
}
