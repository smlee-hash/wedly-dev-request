import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripImageExt } from "@/lib/public-base-url";

export async function GET(
  _req: Request,
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
      headers["Content-Disposition"] = `attachment; filename="${image.id}"`;
    }

    return new NextResponse(buffer, { headers });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
