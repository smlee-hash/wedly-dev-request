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

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
