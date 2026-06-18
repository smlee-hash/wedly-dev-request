import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripImageExt } from "@/lib/public-base-url";
import { buildContentDisposition } from "@/lib/upload-allow";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 노션 호환을 위해 URL 끝에 .png 등 확장자를 붙이므로, 조회 전에 확장자를 떼어 실제 id 로 찾는다.
    const id = stripImageExt(params.id);
    const image = await prisma.devRequestImage.findUnique({
      where: { id },
    });

    if (!image) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const buffer = Buffer.from(image.data, "base64");

    const headers: Record<string, string> = {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    };
    if (!image.mimeType.startsWith("image/")) {
      // 다운로드 파일명 — 노션 링크에 담아 보낸 원래 이름(?name=)을 살려 zip 등이 확장자와 함께 저장되게 한다.
      // 없으면(옛 링크) 기존처럼 내부 id 로 폴백 → 회귀 없음.
      const rawName = new URL(req.url).searchParams.get("name");
      headers["Content-Disposition"] = buildContentDisposition(rawName, image.id);
    }

    return new NextResponse(buffer, { headers });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
