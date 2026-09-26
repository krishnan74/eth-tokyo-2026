import { ENS } from "@/lib/cascade/contracts";

import { SEPOLIA_V2 } from "../../../core/cascade/v2";
import { CopyAddress } from "../cascade/primitives";
import { Reveal } from "../pitch/Reveal";

const CONTRACTS = [
  { name: "acme-labs.eth registry", tag: "stock ENSv2", addr: SEPOLIA_V2.org, role: "An ordinary PermissionedRegistry, unmodified.",
    stores: ["the name platform (its files live in CascadeSubregistryV2)", "the grant: dev-team can edit on platform", "above it, the .eth registry holds security's grant on acme-labs"] },
  { name: "CascadeSubregistryV2", tag: "the one new registry", addr: SEPOLIA_V2.cascade, role: "The registry for platform.acme-labs.eth — ENS's own PermissionedRegistry, with the role lookup overridden.",
    stores: ["the files svc-…", "its teams: dev-team, security (up to 4)", "how many folders up sharing flows (depth 1–3)"], highlight: true },
  { name: "Team contracts", tag: "plain EAC", addr: SEPOLIA_V2.security, role: "Rosters. dev-team and sre are TeamRegistry; security is a NestedTeam that includes sre.",
    stores: ["one bit per person: member on / off", "security: its sub-teams (sre)", "Hats / Safe adapters fit the same one-function interface"] },
];

const PATH = [
  ["Outsider calls", "CascadeSubregistryV2.setSubregistry(svc-api)", "stock"],
  ["ENS checks", "the name exists and hasn't expired, then asks for the role", "stock"],
  ["Own roles?", "none stored for the outsider — keep going (owners stop here)", "cascade"],
  ["Level 1 · platform", "acme-labs registry points back down ✓ · dev-team's grant: can edit · is the outsider in dev-team? no", "cascade"],
  ["Level 2 · acme-labs.eth", ".eth registry points back down ✓ · security's grant: can edit · is the outsider in security? → sre: yes", "cascade"],
  ["Result", "covered → stop and allow · nothing covers it → reverted by ENS's own check", "stock"],
] as const;

export function Architecture() {
  return (
    <section id="under-the-hood" className="flex scroll-mt-24 flex-col gap-10">
      <div className="flex max-w-3xl flex-col gap-3">
        <span className="label">Under the hood</span>
        <h2 className="display text-[clamp(2.2rem,4.6vw,3.8rem)]">One new registry. <span className="italic text-muted">ENS&apos;s own check.</span></h2>
        <p className="text-base leading-relaxed text-ink-2">ENS Drive&apos;s permission layer is <span className="font-medium text-ink">Cascade</span>. ENS&apos;s own code still decides every write; Cascade changes the answer to the one question it asks — <span className="font-mono text-sm">&ldquo;does this account have this role here?&rdquo;</span> — by walking up the folders and asking each shared team about the caller.</p>
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
              <span className="label">Holds</span>
              <ul className="flex flex-col gap-1 text-sm text-ink-2">{c.stores.map((s) => <li key={s} className="flex gap-2"><span className="text-muted">·</span>{s}</li>)}</ul>
            </div>
            <div className="mt-auto border-t border-line pt-1"><CopyAddress label="Sepolia" value={c.addr} /></div>
          </Reveal>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Reveal className="flex flex-col gap-4">
          <span className="label">What happens when the outsider (in sre) edits a file</span>
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
          <p className="text-xs text-muted">Steps 3–5 are Cascade. Every outside call is read-only and gas-capped; if any fails, it counts as &ldquo;no&rdquo;. A team is only asked about membership if its grant could help, and the walk stops as soon as the role is covered.</p>
        </Reveal>

        <Reveal delay={0.08} className="flex flex-col gap-4">
          <span className="label">How the override works</span>
          <div className="flex flex-col items-stretch gap-2 font-mono text-[13px]">
            {[["EnhancedAccessControl", "ENS's access control — role lookup marked virtual", false], ["PermissionedRegistry", "overrides it: approved operators get the owner's roles", false], ["CascadeSubregistryV2", "overrides it again: members inherit what shared folders grant their team", true]].map(([n, d, h], i) => (
              <div key={String(n)} className="flex flex-col items-center gap-2">
                {i > 0 && <span className="text-muted" aria-hidden>↓ inherits</span>}
                <div className={`w-full rounded-2xl px-4 py-3 ${h ? "bg-inv text-inv-fg" : "bg-surface shadow-[inset_0_0_0_1px_var(--line)]"}`}>
                  <div>{n}</div>
                  <div className={`mt-0.5 font-sans text-xs ${h ? "text-inv-accent" : "text-muted"}`}>{d}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-ink-2">ENS&apos;s functions are unchanged. Because the lookup is <em>virtual</em>, every check inside ENS&apos;s code runs Cascade&apos;s version, which runs ENS&apos;s own first and only ever adds roles — never admin roles, never registry-wide roles. Proven with a symbolic checker for all inputs, and fuzzed against a full recomputation.</p>
          <p className="text-xs text-muted">Also live: the one-folder version (<span className="font-mono">CascadeSubregistry</span> on devops.acme-corp.eth) — the “One folder” tab above. The .eth registry: <span className="font-mono">{ENS.ethRegistry.slice(0, 8)}…</span></p>
        </Reveal>
      </div>
    </section>
  );
}
