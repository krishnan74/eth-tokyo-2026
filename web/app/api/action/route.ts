import { NextResponse } from "next/server";

import { WRITES_ENABLED, runAction, type ActionName } from "@/lib/cascade/server";

export const dynamic = "force-dynamic";

const ACTIONS: ActionName[] = ["create", "write", "grant", "revoke", "hijack"];

/**
 * Sends one demo transaction and returns its hash as soon as it is broadcast. The browser then waits for
 * the receipt itself, so nothing is shown as landed before it has.
 */
export async function POST(req: Request) {
  if (!WRITES_ENABLED) {
    return NextResponse.json({ error: "Transactions are disabled on this server. Run the UI locally (npm run ui), or set CASCADE_UI_WRITES=1." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { action?: string; label?: string };
  if (!ACTIONS.includes(body.action as ActionName)) return NextResponse.json({ error: "unknown action" }, { status: 400 });
  if (body.label !== undefined && !/^svc-[0-9a-z]{1,16}$/.test(body.label)) return NextResponse.json({ error: "bad label" }, { status: 400 });
  try {
    const r = await runAction(body.action as ActionName, body.label);
    return NextResponse.json(JSON.parse(JSON.stringify(r)));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message.split("\n")[0] }, { status: 500 });
  }
}
