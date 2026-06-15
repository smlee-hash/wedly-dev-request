import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024; // 10MB per file (폰 사진 여유 — 예전 5MB는 카메라 사진이 자주 초과해 조용히 버려졌음)

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("images") as File[];

    if (!files.length) {
      return NextResponse.json({ success: false, error: "파일이 없습니다" }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json({ success: false, error: `최대 ${MAX_FILES}개까지 첨부 가능합니다` }, { status: 400 });
    }

    const ALLOWED_TYPES = ["image/", "application/pdf", "application/vnd.openxmlformats-officedocument", "application/vnd.ms-", "application/msword", "application/haansofthwp", "application/x-hwp"];
    const isAllowed = (t: string) => ALLOWED_TYPES.some((a) => t.startsWith(a));

    const results = [];
    // 건너뛴 파일을 모아 정직하게 알린다 — 예전엔 조용히 버려(continue) 사용자가 "올라간 줄" 알았음(사진 누락).
    const skipped: { name: string; reason: string }[] = [];
    for (const file of files) {
      const name = file.name || "파일";
      if (!isAllowed(file.type)) {
        skipped.push({ name, reason: `지원하지 않는 형식(${file.type || "알 수 없음"})` });
        continue;
      }
      if (file.size > MAX_SIZE) {
        skipped.push({ name, reason: `용량 초과 — 한 개당 최대 ${Math.round(MAX_SIZE / 1024 / 1024)}MB` });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");

      const record = await prisma.devRequestImage.create({
        data: { data: base64, mimeType: file.type },
      });

      results.push({ id: record.id, name: file.name, mimeType: file.type });
    }

    // 하나도 못 올렸으면 성공으로 위장하지 않는다(침묵 실패 방지).
    if (results.length === 0) {
      const reason = skipped.length > 0
        ? `첨부할 수 없는 파일입니다 — ${skipped.map((s) => `${s.name}(${s.reason})`).join(", ")}`
        : "첨부할 수 있는 파일이 없습니다.";
      return NextResponse.json({ success: false, error: reason }, { status: 400 });
    }

    // 일부만 올라간 경우 skipped 를 함께 반환 — 클라이언트가 "○개는 제외됨"을 안내할 수 있게.
    return NextResponse.json({ success: true, data: results, skipped });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
