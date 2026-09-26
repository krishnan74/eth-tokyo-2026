import type { ActionName, Kind } from "@/lib/cascade/hooks";

/** Every action, with what it does stated before it runs. */
export const ACTIONS: Record<ActionName, { short: string; label: string; consequence: string; kind: Kind; logTitle: string }> = {
  create: { short: "New subname", label: "Create a new subname", kind: "native", logTitle: "Create a new subname under devops",
    consequence: "Registers svc-xxxx.devops.acme-corp.eth. Nobody is granted anything on it." },
  write: { short: "Write", label: "Write as the outsider", kind: "cascade", logTitle: "Outsider writes to the subname (setSubregistry)",
    consequence: "The outsider tries to repoint this subname. Whether it lands depends only on the team relationship." },
  grant: { short: "Add to team", label: "Add the outsider to the team", kind: "native", logTitle: "Add outsider to TeamRegistry (MEMBER)",
    consequence: "One ordinary EAC grant on TeamRegistry. Nothing is written to any subname." },
  revoke: { short: "Remove from team", label: "Remove the outsider from the team", kind: "native", logTitle: "Remove outsider from TeamRegistry",
    consequence: "One ordinary EAC revoke. No per-subname cleanup, because nothing was stored per subname." },
  hijack: { short: "Hijack pointer", label: "Point Cascade at an attacker's contract", kind: "cascade", logTitle: "Outsider tries setTeam(AlwaysTrueTeam)",
    consequence: "The outsider tries to swap the team for a contract that says everyone is a member. It should be refused." },
};

export type Step = { action: ActionName; title: string; how: string; why: string; expect?: "success" | "reverted" };

/** The guided order. Drag gestures carry the relationship changes; buttons carry the writes. */
export const STEPS: Step[] = [
  { action: "create", title: "Create a fresh subname", how: "Press “+ New subname” under devops.",
    why: "A name that didn't exist a moment ago. Nobody is granted anything on it — so any access later can't come from a grant on this name." },
  { action: "write", expect: "reverted", title: "The outsider tries to write", how: "Press “Write” on the new subname.",
    why: "The outsider isn't on the team, and holds no role on the name. EAC says no." },
  { action: "grant", title: "Drag the outsider into the team", how: "Drag the outsider chip into the TeamRegistry roster.",
    why: "One ordinary EAC grant on the roster. Watch every subname under devops unlock at once — none of them was touched." },
  { action: "write", expect: "success", title: "The same write again", how: "Press “Write” on the same subname.",
    why: "Same name, same address, same call. Only the relationship changed. EAC's stored grants for the outsider are still empty." },
  { action: "revoke", title: "Drag the outsider back out", how: "Drag the chip out of the roster, back to the left.",
    why: "One revoke. Every subname locks again immediately — nothing to clean up." },
  { action: "write", expect: "reverted", title: "The write fails again", how: "Press “Write” once more.",
    why: "No delay and nothing cached: access is computed from the relationship on every check." },
  { action: "hijack", expect: "reverted", title: "Try to hijack it", how: "Drag the attacker's contract onto the team socket.",
    why: "The obvious attack: point Cascade at a contract that says everyone is a member. Changing the team needs ROLE_SET_TEAM." },
];
