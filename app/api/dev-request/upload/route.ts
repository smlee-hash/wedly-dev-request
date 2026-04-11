import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB per file

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

    const results = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > MAX_SIZE) continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");

      const image = await prisma.devRequestImage.create({
        data: { data: base64, mimeType: file.type },
      });

      results.push({ id: image.id });
    }

    return NextResponse.json({ success: true, data: results });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
