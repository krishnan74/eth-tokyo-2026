import { NextResponse } from "next/server";

import { actors } from "@/lib/cascade/server";

export const dynamic = "force-dynamic";

/** Public addresses of the two demo accounts (derived server-side from the keys) and whether writes are on. */
export function GET() {
  return NextResponse.json(actors());
}
