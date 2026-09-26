import { NextResponse } from "next/server";

import { v2State } from "@/lib/cascade/v2server";

export const dynamic = "force-dynamic";

/** Live state of the roadmap tree (acme-labs.eth), for the outsider, on the given subname labels. */
export async function GET(req: Request) {
  const labels = (new URL(req.url).searchParams.get("labels") ?? "").split(",").filter((l) => /^svc-[0-9a-z]{1,16}$/.test(l)).slice(0, 12);
  try {
    return NextResponse.json(JSON.parse(JSON.stringify(await v2State(labels.length ? labels : ["svc-api"]), (_, v) => (typeof v === "bigint" ? v.toString() : v))));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message.split("\n")[0] }, { status: 500 });
  }
}
