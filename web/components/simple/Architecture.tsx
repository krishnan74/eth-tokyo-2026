import { SEPOLIA } from "@/lib/cascade/contracts";

import { CopyAddress } from "../cascade/primitives";
import { Reveal } from "../pitch/Reveal";

const CONTRACTS = [
  { name: "OrgRegistry", tag: "stock ENSv2", addr: SEPOLIA.parent, role: "The registry for acme-corp.eth.",
    stores: ["the name devops (its children live in CascadeSubregistry)", "the grant: TeamRegistry holds SET_SUBREGISTRY on devops"] },
  { name: "CascadeSubregistry", tag: "one override", addr: SEPOLIA.cascade, role: "The registry for devops.acme-corp.eth — ENS's PermissionedRegistry with _getRoles overridden.",
    stores: ["the subnames svc-…", "a pointer to the team (TeamRegistry)", "its parent: OrgRegistry, label devops"], highlight: true },
  { name: "TeamRegistry", tag: "plain EAC", addr: SEPOLIA.team, role: "The team roster.",
    stores: ["one bit per person: MEMBER on / off", "admins who may add and remove members"] },
];

const PATH = [
  ["Outsider calls", "CascadeSubregistry.setSubregistry(svc-…)", "stock"],
  ["ENS checks", "the name exists and hasn't expired", "stock"],
  ["ENS asks", "_checkRoles → hasRoles → _getRoles", "stock"],
  ["Cascade's _getRoles", "stored roles (none) + asks OrgRegistry.roles(devops, TeamRegistry)", "cascade"],
  ["…and asks", "TeamRegistry.isMember(outsider)", "cascade"],
  ["Result", "member → SET_SUBREGISTRY added → write allowed · not a member → reverted", "stock"],
] as const;

export function Architecture() {
  return (
    <section id="under-the-hood" className="flex scroll-mt-24 flex-col gap-10">
      <div className="flex max-w-3xl flex-col gap-3">
        <span className="label">Under the hood</span>
        <h2 className="display text-[clamp(2.2rem,4.6vw,3.8rem)]">Three contracts. <span className="italic text-muted">One overridden function.</span></h2>
        <p className="text-base leading-relaxed text-ink-2">ENS&apos;s own code decides every write. Cascade changes the answer to one question it asks — <span className="font-mono text-sm">&ldquo;what roles does this account have here?&rdquo;</span> — by adding the team&apos;s grant for members.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {CONTRACTS.map((c, i) => (
          <Reveal key={c.name} delay={i * 0.06} className={`flex flex-col gap-3 rounded-3xl p-6 ${c.highlight ? "bg-surface shadow-[inset_0_0_0_2px_var(--cascade)]" : "bg-surface shadow-[inset_0_0_0_1px_var(--line)]"}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[15px] font-medium">{c.name}</span>
              <span className={`font-mono text-[10.5px] uppercase tracking-[0.08em] ${c.highlight ? "text-cascade" : "text-muted"}`}>{c.tag}</span>
            </div>
            <p className="text-sm leading-relaxed text-ink-2">{c.role}</p>
            <div className="flex flex-col gap-1.5">
              <span className="label">Stores</span>
              <ul className="flex flex-col gap-1 text-sm text-ink-2">{c.stores.map((s) => <li key={s} className="flex gap-2"><span className="text-muted">·</span>{s}</li>)}</ul>
            </div>
            <div className="mt-auto border-t border-line pt-1"><CopyAddress label="Sepolia" value={c.addr} /></div>
          </Reveal>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Reveal className="flex flex-col gap-4">
          <span className="label">What happens when the outsider writes</span>
          <ol className="flex flex-col gap-2">
            {PATH.map(([who, what, kind], i) => (
              <li key={i} className={`grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 rounded-2xl px-4 py-3 ${kind === "cascade" ? "bg-cascade-soft" : "bg-surface shadow-[inset_0_0_0_1px_var(--line)]"}`}>
                <span className={`font-mono text-sm ${kind === "cascade" ? "text-cascade" : "text-muted"}`}>{i + 1}</span>
                <span className="flex flex-col">
                  <span className={`text-sm font-medium ${kind === "cascade" ? "text-cascade" : ""}`}>{who}</span>
                  <span className="font-mono text-[12px] leading-relaxed text-ink-2">{what}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted">Steps 4–5 are the only new logic. The two calls are read-only and gas-capped; if either fails, access is denied.</p>
        </Reveal>

        <Reveal delay={0.08} className="flex flex-col gap-4">
          <span className="label">How the override works</span>
          <div className="flex flex-col items-stretch gap-2 font-mono text-[13px]">
            {[["EnhancedAccessControl", "defines _getRoles — marked virtual", false], ["PermissionedRegistry", "overrides it: approved operators get the owner's roles", false], ["CascadeSubregistry", "overrides it again: members get the team's grant", true]].map(([n, d, h], i) => (
              <div key={String(n)} className="flex flex-col items-center gap-2">
                {i > 0 && <span className="text-muted" aria-hidden>↓ inherits</span>}
                <div className={`w-full rounded-2xl px-4 py-3 ${h ? "bg-inv text-inv-fg" : "bg-surface shadow-[inset_0_0_0_1px_var(--line)]"}`}>
                  <div>{n}</div>
                  <div className={`mt-0.5 font-sans text-xs ${h ? "text-inv-accent" : "text-muted"}`}>{d}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-ink-2">ENS&apos;s functions are unchanged. Because <span className="font-mono text-xs">_getRoles</span> is <em>virtual</em>, every check inside ENS&apos;s code automatically runs Cascade&apos;s version, which first runs ENS&apos;s own (<span className="font-mono text-xs">super</span>) and then adds the team&apos;s grant. Never admin roles, never registry-wide roles.</p>
        </Reveal>
      </div>
    </section>
  );
}
