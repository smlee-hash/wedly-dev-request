// 일회용 복구 통로 — 과거 신고글에 박힌 내부주소(localhost:8080) 이미지/파일 주소를 공개주소로 바로잡는다.
//
// 배경(NO.48): 예전 코드가 노션 이미지/파일 주소를 `https://localhost:8080/api/images/{id}` 로 박아
//   노션이 못 가져와 사진이 다 깨졌다. 사진 원본(devRequestImage)은 그대로 남아 있으므로,
//   노션 블록의 "주소"만 공개주소로 바꿔주면 다시 보인다. (멱등 — 이미 공개주소면 건드리지 않음)
//
// 안전장치:
//   - 토큰 가드(?token=) 없으면 403.
//   - 기본은 미리보기(dry-run). 실제 수정은 ?apply=1 이 있어야 동작.
//   - /api/images/ 경로 + 내부주소인 것만 대상. 그 외 주소·블록은 절대 안 건드림.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePublicBaseUrl, isInternalHost, imageExtForMime, stripImageExt } from "@/lib/public-base-url";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_API = "https://api.notion.com/v1";
const DATABASE_ID = process.env.NOTION_DATABASE_ID || "93ae3ac1e9c64c879ec166ccc7fb1444";
const REPAIR_TOKEN = "wedly-img-repair-2026";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function notion(pathname: string, init?: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; ; i++) {
    const res = await fetch(`${NOTION_API}${pathname}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
        ...(init?.headers || {}),
      },
    });
    if (res.status === 429 && i < retries) {
      const ra = Number(res.headers.get("retry-after") || "1");
      await new Promise((r) => setTimeout(r, (ra + 0.3) * 1000));
      continue;
    }
    return res;
  }
}

const IMG_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff?)$/i;

// 하이퍼링크(파일 첨부)용: 내부주소 → 공개주소만 교정(확장자 불필요). 바꿀 필요 없으면 null.
function fixLinkUrl(url: string, base: string): string | null {
  try {
    const u = new URL(url);
    if (!u.pathname.startsWith("/api/images/")) return null;
    if (!isInternalHost(`${u.protocol}//${u.host}`) && !isInternalHost(u.host)) return null; // 이미 공개주소면 패스
    const next = `${base}${u.pathname}${u.search}`;
    return next !== url ? next : null;
  } catch {
    return null;
  }
}

// 이미지 블록용: (내부주소 또는 확장자 없음)이면 공개주소 + 이미지 확장자로 교정. 바꿀 필요 없으면 null.
async function fixImageUrl(url: string, base: string): Promise<string | null> {
  try {
    const u = new URL(url);
    if (!u.pathname.startsWith("/api/images/")) return null;
    const internal = isInternalHost(`${u.protocol}//${u.host}`) || isInternalHost(u.host);
    const hasExt = IMG_EXT_RE.test(u.pathname);
    if (!internal && hasExt) return null; // 이미 공개주소 + 확장자 → OK
    const id = stripImageExt(u.pathname.replace("/api/images/", ""));
    if (!id) return null;
    let ext = "png";
    try {
      const rec = await prisma.devRequestImage.findUnique({ where: { id }, select: { mimeType: true } });
      ext = imageExtForMime(rec?.mimeType);
    } catch { /* 기본 png */ }
    const next = `${base}/api/images/${id}.${ext}`;
    return next !== url ? next : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const reqUrl = new URL(req.url);
  if (reqUrl.searchParams.get("token") !== REPAIR_TOKEN) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }
  if (!NOTION_TOKEN) {
    return NextResponse.json({ success: false, error: "NOTION_TOKEN 미설정" }, { status: 500 });
  }

  const base = resolvePublicBaseUrl({
    envBase: process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL,
    railwayPublicDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
    forwardedHost: req.headers.get("x-forwarded-host"),
    forwardedProto: req.headers.get("x-forwarded-proto"),
    reqUrl: req.url,
  });
  if (!base || isInternalHost(base)) {
    return NextResponse.json({ success: false, error: `공개 baseUrl 미확보: "${base}"` }, { status: 500 });
  }

  const dryRun = reqUrl.searchParams.get("apply") !== "1"; // 기본 미리보기
  let pagesScanned = 0;
  let imageFixed = 0;
  let linkFixed = 0;
  const samples: string[] = [];
  const errors: string[] = [];

  try {
    let cursor: string | undefined;
    do {
      const qBody: Record<string, unknown> = { page_size: 100 };
      if (cursor) qBody.start_cursor = cursor;
      const qRes = await notion(`/databases/${DATABASE_ID}/query`, { method: "POST", body: JSON.stringify(qBody) });
      const qData = await qRes.json();
      if (qData.object === "error") { errors.push(`query: ${qData.message}`); break; }

      for (const page of qData.results || []) {
        pagesScanned++;
        let bcursor: string | undefined;
        do {
          const bRes = await notion(`/blocks/${page.id}/children?page_size=100${bcursor ? `&start_cursor=${bcursor}` : ""}`);
          const bData = await bRes.json();
          if (bData.object === "error") { errors.push(`blocks ${page.id}: ${bData.message}`); break; }

          for (const block of bData.results || []) {
            // 1) 이미지 블록 — 내부주소 또는 확장자 없음 → 공개주소 + 이미지 확장자
            if (block.type === "image" && block.image?.type === "external") {
              const old = block.image.external?.url || "";
              const next = await fixImageUrl(old, base);
              if (next) {
                if (samples.length < 6) samples.push(`IMG ${old} → ${next}`);
                if (!dryRun) {
                  const r = await notion(`/blocks/${block.id}`, { method: "PATCH", body: JSON.stringify({ image: { external: { url: next } } }) });
                  const rj = await r.json();
                  if (rj.object === "error") errors.push(`patch img ${block.id}: ${rj.message}`); else imageFixed++;
                } else imageFixed++;
              }
            }
            // 2) 문단 안 파일 링크
            if (block.type === "paragraph" && Array.isArray(block.paragraph?.rich_text)) {
              let changed = false;
              const rt = block.paragraph.rich_text.map((t: Record<string, unknown>) => {
                const txt = t.text as { content?: string; link?: { url?: string } } | undefined;
                const linkUrl = txt?.link?.url;
                if (t.type === "text" && linkUrl) {
                  const next = fixLinkUrl(linkUrl, base);
                  if (next) {
                    changed = true;
                    if (samples.length < 6) samples.push(`LINK ${linkUrl} → ${next}`);
                    return { type: "text", text: { content: txt?.content ?? "", link: { url: next } }, annotations: t.annotations };
                  }
                }
                return t;
              });
              if (changed) {
                if (!dryRun) {
                  const r = await notion(`/blocks/${block.id}`, { method: "PATCH", body: JSON.stringify({ paragraph: { rich_text: rt } }) });
                  const rj = await r.json();
                  if (rj.object === "error") errors.push(`patch link ${block.id}: ${rj.message}`); else linkFixed++;
                } else linkFixed++;
              }
            }
          }
          bcursor = bData.has_more ? bData.next_cursor : undefined;
        } while (bcursor);
      }
      cursor = qData.has_more ? qData.next_cursor : undefined;
    } while (cursor);
  } catch (err) {
    errors.push(`fatal: ${err instanceof Error ? err.message : String(err)}`);
  }

  return NextResponse.json({
    success: true,
    dryRun,
    base,
    pagesScanned,
    imageFixed,
    linkFixed,
    samples,
    errors: errors.slice(0, 15),
  });
}
