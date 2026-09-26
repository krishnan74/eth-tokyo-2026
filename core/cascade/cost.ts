// "What it takes to keep a team's access correct" — the same numbers in the terminal and the UI.
// Honest about root grants, which stock EAC already offers and which already cover future subnames.
export function costOfAccess(teamSize = 5, subnames = 20, registries = 3) {
  return {
    teamSize, subnames, registries,
    rows: [
      { approach: "Per-subname grants", grants: teamSize * subnames * registries,
        formula: `${teamSize} × ${subnames} × ${registries}`, churn: `every new subname needs ${teamSize} more grants`, cascade: false },
      { approach: "Root grants on each registry", grants: teamSize * registries,
        formula: `${teamSize} × ${registries}`, churn: `each join or leave touches all ${registries} registries`, cascade: false },
      { approach: "Cascade", grants: teamSize + registries,
        formula: `${teamSize} memberships + ${registries} parent grants`, churn: "each join or leave is 1 transaction", cascade: true },
    ],
    note: "Root grants already cover future subnames. What Cascade adds is one roster shared by every registry.",
  };
}
