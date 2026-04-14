import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const image = await prisma.devRequestImage.findUnique({
      where: { id: params.id },
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
