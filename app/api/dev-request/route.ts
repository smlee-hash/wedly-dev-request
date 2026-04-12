import { NextResponse } from "next/server";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_API = "https://api.notion.com/v1";
const DATABASE_ID = process.env.NOTION_DATABASE_ID || "93ae3ac1e9c64c879ec166ccc7fb1444";

let categoryPropertyEnsured = false;

async function ensureCategoryProperty() {
  if (categoryPropertyEnsured) return;
  try {
    const res = await fetch(`${NOTION_API}/databases/${DATABASE_ID}`, {
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": "2022-06-28" },
    });
    const db = await res.json();
    if (db.properties?.["카테고리"]) {
      categoryPropertyEnsured = true;
      return;
    }
    await fetch(`${NOTION_API}/databases/${DATABASE_ID}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        properties: {
          "카테고리": {
            select: {
              options: [
                { name: "신규 기능", color: "blue" },
                { name: "기능 개선", color: "yellow" },
                { name: "버그 수정", color: "red" },
                { name: "UI·UX", color: "pink" },
                { name: "데이터", color: "green" },
                { name: "기타", color: "gray" },
              ],
            },
          },
        },
      }),
    });
    categoryPropertyEnsured = true;
  } catch { /* ignore */ }
}

// GET: 요청 목록 조회 (?app=xxx 로 필터링)
export async function GET(req: Request) {
  if (!NOTION_TOKEN) {
    return NextResponse.json({ success: false, error: "NOTION_TOKEN 미설정" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const appFilter = searchParams.get("app");
  const pageFilter = searchParams.get("page");

  try {
    const conditions: Record<string, unknown>[] = [];
    if (appFilter) conditions.push({ property: "앱", select: { equals: appFilter } });
    if (pageFilter) conditions.push({ property: "세부 페이지", rich_text: { equals: pageFilter } });

    const body: Record<string, unknown> = {
      sorts: [{ property: "요청일시", direction: "descending" }],
      page_size: 50,
    };
    if (conditions.length === 1) body.filter = conditions[0];
    else if (conditions.length > 1) body.filter = { and: conditions };

    const res = await fetch(`${NOTION_API}/databases/${DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    const items = await Promise.all(
      (data.results || []).map(async (page: Record<string, unknown>) => {
        const props = page.properties as Record<string, Record<string, unknown>>;
        let content = "";
        try {
          const blocksRes = await fetch(`${NOTION_API}/blocks/${page.id}/children?page_size=50`, {
            headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": "2022-06-28" },
          });
          const blocksData = await blocksRes.json();
          content = (blocksData.results || [])
            .filter((b: Record<string, unknown>) => b.type === "paragraph")
            .map((b: Record<string, unknown>) => {
              const rt = (b as Record<string, Record<string, unknown>>).paragraph?.rich_text as Array<{ plain_text: string }> | undefined;
              return rt?.map((t) => t.plain_text).join("") || "";
            })
            .filter(Boolean)
            .join("\n");
        } catch { /* 블록 조회 실패 시 빈 내용 */ }

        let requesterName = (props["요청자"]?.rich_text as Array<{ plain_text: string }>)?.[0]?.plain_text || "";
        const lines = content.split("\n");
        if (!requesterName) {
          const requesterLine = lines.find((l: string) => l.startsWith("요청자:") || l.startsWith("요청자 :"));
          if (requesterLine) requesterName = requesterLine.replace(/^요청자\s*:\s*/, "").trim();
        }
        const cleanContent = lines
          .filter((l: string) => {
            const t = l.trim();
            if (t.startsWith("***") && t.endsWith("***")) return false;
            if (t.startsWith("요청자:") || t.startsWith("요청자 :")) return false;
            if (t === "---") return false;
            return true;
          })
          .join("\n")
          .replace(/^\n+|\n+$/g, "");

        return {
          id: page.id,
          title: (props["페이지"]?.title as Array<{ plain_text: string }>)?.[0]?.plain_text || "",
          content: cleanContent,
          priority: (props["우선 순위"]?.select as { name: string })?.name || "",
          status: (props["진행상태"]?.status as { name: string })?.name || "",
          category: (props["카테고리"]?.select as { name: string })?.name || "",
          app: (props["앱"]?.select as { name: string })?.name || "",
          page: (props["세부 페이지"]?.rich_text as Array<{ plain_text: string }>)?.[0]?.plain_text || "",
          no: props["NO"]?.number as number || 0,
          createdTime: props["요청일시"]?.created_time as string || "",
          requester: requesterName,
        };
      })
    );

    return NextResponse.json({ success: true, data: items });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// POST: 새 요청 등록
export async function POST(req: Request) {
  if (!NOTION_TOKEN) {
    return NextResponse.json({ success: false, error: "NOTION_TOKEN 미설정" }, { status: 500 });
  }

  const { title, content, priority, category, app, page, imageIds, requester } = await req.json();

  if (!title || !content) {
    return NextResponse.json({ success: false, error: "제목과 내용은 필수입니다" }, { status: 400 });
  }

  const requesterName = requester || "";
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  try {
    await ensureCategoryProperty();

    const queryRes = await fetch(`${NOTION_API}/databases/${DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        sorts: [{ property: "NO", direction: "descending" }],
        page_size: 1,
      }),
    });
    const queryData = await queryRes.json();
    const lastNo = (queryData.results?.[0]?.properties?.NO?.number as number) || 0;
    const newNo = lastNo + 1;

    const formattedContent = `${content}\n\n---\n요청자: ${requesterName || "알 수 없음"}`;

    const properties: Record<string, unknown> = {
      "페이지": { title: [{ text: { content: title } }] },
      "우선 순위": { select: { name: priority || "보통" } },
      "카테고리": { select: { name: category || "기타" } },
      "NO": { number: newNo },
      "요청자": { rich_text: [{ text: { content: requesterName || "알 수 없음" } }] },
    };
    if (app) properties["앱"] = { select: { name: app } };
    if (page) properties["세부 페이지"] = { rich_text: [{ text: { content: page } }] };

    const children: Record<string, unknown>[] = formattedContent.split("\n").filter(Boolean).map((line: string) => ({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: line } }],
      },
    }));

    if (imageIds && Array.isArray(imageIds) && imageIds.length > 0) {
      children.push({ object: "block", type: "divider", divider: {} });
      for (const id of imageIds) {
        children.push({
          object: "block",
          type: "image",
          image: { type: "external", external: { url: `${baseUrl}/api/images/${id}` } },
        });
      }
    }

    const res = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ parent: { database_id: DATABASE_ID }, properties, children }),
    });

    const data = await res.json();
    if (data.object === "error") {
      return NextResponse.json({ success: false, error: data.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { id: data.id, no: newNo } });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// PATCH: 요청 필드 수정 (카테고리, 우선순위, 상태)
export async function PATCH(req: Request) {
  if (!NOTION_TOKEN) {
    return NextResponse.json({ success: false, error: "NOTION_TOKEN 미설정" }, { status: 500 });
  }

  const { id, category, priority, status } = await req.json();
  if (!id) {
    return NextResponse.json({ success: false, error: "id는 필수입니다" }, { status: 400 });
  }

  const properties: Record<string, unknown> = {};
  if (category !== undefined) properties["카테고리"] = { select: { name: category } };
  if (priority !== undefined) properties["우선 순위"] = { select: { name: priority } };
  if (status !== undefined) properties["진행상태"] = { status: { name: status } };

  if (Object.keys(properties).length === 0) {
    return NextResponse.json({ success: false, error: "수정할 필드가 없습니다" }, { status: 400 });
  }

  try {
    const res = await fetch(`${NOTION_API}/pages/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ properties }),
    });

    const data = await res.json();
    if (data.object === "error") {
      return NextResponse.json({ success: false, error: data.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// DELETE: 요청 삭제
export async function DELETE(req: Request) {
  if (!NOTION_TOKEN) {
    return NextResponse.json({ success: false, error: "NOTION_TOKEN 미설정" }, { status: 500 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ success: false, error: "id는 필수입니다" }, { status: 400 });
  }

  try {
    const res = await fetch(`${NOTION_API}/pages/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ archived: true }),
    });

    const data = await res.json();
    if (data.object === "error") {
      return NextResponse.json({ success: false, error: data.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
