import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getBuildId() {
  try {
    return fs.readFileSync(
      path.join(process.cwd(), ".next", "BUILD_ID"),
      "utf8"
    ).trim();
  } catch {
    return "unknown";
  }
}

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ buildId: getBuildId() }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
