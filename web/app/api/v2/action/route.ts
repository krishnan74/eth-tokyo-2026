import { NextResponse } from "next/server";

import { WRITES_ENABLED } from "@/lib/cascade/server";
import { v2Act, type V2Action } from "@/lib/cascade/v2server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LABEL = /^svc-[0-9a-z]{1,16}$/;

/** One roadmap-demo transaction; waits for the receipt. Local-only, like the v1 demo's writes. */
export async function POST(req: Request) {
  if (!WRITES_ENABLED) return NextResponse.json({ error: "Transactions are disabled on this server. Run the UI locally (npm run ui)." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  let a: V2Action;
  if (b.action === "create" || b.action === "reset" || b.action === "hijack") a = { action: b.action };
  else if ((b.action === "join" || b.action === "leave") && (b.team === "dev-team" || b.team === "sre")) a = { action: b.action, team: b.team };
  else if (b.action === "depth" && (b.depth === 1 || b.depth === 2)) a = { action: "depth", depth: b.depth };
  else if ((b.action === "setSubregistry" || b.action === "setResolver") && typeof b.label === "string" && LABEL.test(b.label)) a = { action: b.action, label: b.label };
  else return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json(await v2Act(a));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message.split("\n")[0] }, { status: 500 });
  }
}
