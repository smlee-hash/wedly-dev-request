import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateEmitter } from "@/lib/update-emitter";

const API_SECRET = process.env.APP_UPDATE_SECRET;

/** POST: 업데이트 알림 등록 (API 시크릿 키 인증) */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!API_SECRET || authHeader !== `Bearer ${API_SECRET}`) {
      return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, category, page } = body;

    if (!title || !description) {
      return NextResponse.json({ error: "title, description 필수" }, { status: 400 });
    }

    const update = await prisma.appUpdate.create({
      data: { title, description, category: category || "improve", page: page || null },
    });

    updateEmitter.emit("new-update", update);

    return NextResponse.json(update);
  } catch (error) {
    console.error("[AppUpdate] POST error:", error);
    return NextResponse.json({ error: "업데이트 등록 실패" }, { status: 500 });
  }
}

/** GET: 최신 업데이트 1건 조회 (?page= 로 해당 페이지 전용 조회) */
export async function GET(req: NextRequest) {
  try {
    const page = req.nextUrl.searchParams.get("page");
    const latest = await prisma.appUpdate.findFirst({
      where: page ? { page } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(latest || null);
  } catch (error) {
    console.error("[AppUpdate] GET error:", error);
    return NextResponse.json(null);
  }
}
