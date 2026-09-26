import { Card } from "./primitives";

const ITEMS: { title: string; body: string }[] = [
  { title: "One hop only",
    body: "The registry checks the immediate parent's grant. A grant two levels above a subname is not found. A deeper tree needs a CascadeSubregistry, with its own team and parent, at each level that should inherit." },
  { title: "Who can set the team pointer — the trust model",
    body: "Changing it needs ROLE_SET_TEAM on the registry; the address must be a contract that declares the team interface through ERC-165, and every change emits TeamPointerUpdated(old, new, by). A contract can lie about ERC-165, so whoever holds ROLE_SET_TEAM is trusted to choose a genuine team contract — the same trust you place in any namespace admin." },
  { title: "If the team contract is compromised or broken",
    body: "A rogue team admin can add members, who then get exactly the roles the parent granted the team — here, repointing subnames of devops, and so control of whatever sits beneath them — and nothing else: no registering, no granting, no touching devops itself. One revoke of the parent's grant cuts off every member. A team contract that reverts, loops or returns garbage fails closed, and native owners are unaffected." },
  { title: "Small teams",
    body: "TeamRegistry is ordinary EAC, so it inherits the limit of 15 accounts per role. It suits a team, not an org chart." },
  { title: "Parent name changing hands (Mutable Token IDs) — resolved",
    body: "The parent's grant is read live from devops's current registration. If devops is unregistered, expires or is re-registered, the team's authority ends, just as native grants do (terminal demo step 8, and tests). A transfer keeps the grant, as stock ENSv2 does for every delegate; the new owner can revoke it in one call." },
  { title: "Native owners pay a little too",
    body: "Because the logic sits in EAC's _getRoles hook, every role lookup on a subname can make two external calls — about 2,300 extra gas per write for native owners, measured locally." },
  { title: "explain() does not check expiry",
    body: "The write path rejects an expired name before checking roles; explain() reports roles only." },
  { title: "Beta deployment, and a server that signs",
    body: "This runs on the ENSv2 beta deployment on Sepolia, not production ENS. The demo's two accounts sign on this app's server with keys that never reach the browser, so transactions are enabled only when running locally. The browser reads the chain and waits for every receipt itself." },
];

export function LimitationsPanel() {
  return (
    <Card eyebrow="Named before anyone has to find them" title="Known limits and trust assumptions">
      <ul className="grid gap-4 md:grid-cols-2">
        {ITEMS.map((i) => (
          <li key={i.title} className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{i.title}</span>
            <span className="text-sm leading-relaxed text-muted">{i.body}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
