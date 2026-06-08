import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// 마크다운 강조 별표(**, ***) 제거 — 단일 *는 보존(예: "3 * 4")
function stripBoldMarkers(s: string): string {
  return s.replace(/\*{2,}/g, "");
}

// POST: 사용자 입력을 개발 요청서 형태로 구조화
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "ANTHROPIC_API_KEY 미설정" }, { status: 500 });
  }

  const { content } = await req.json();
  if (!content) {
    return NextResponse.json({ success: false, error: "내용은 필수입니다" }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey, maxRetries: 3, timeout: 50000 });

    const prompt = `사용자가 앱의 오류/개선 요청을 입력했습니다. 이것을 개발자가 바로 이해하고 작업할 수 있는 구조화된 요청서로 변환하고, 우선순위를 자동으로 판단해주세요.

**요청 내용:** ${content}

**출력 형식 (반드시 이 JSON 형식으로만 출력):**
\`\`\`json
{
  "title": "제목 (~기능 요청 / ~개선 요청 / ~버그 수정 / ~기능 추가 중 하나로 끝낼 것)",
  "content": "구조화된 요청서 본문",
  "priority": "우선순위 (최우선/높음/보통/낮음 중 하나)",
  "category": "카테고리 (신규 기능/기능 개선/버그 수정/UI·UX/데이터/기타 중 하나)"
}
\`\`\`

**카테고리 판단 기준:**
- 신규 기능: 기존에 없던 완전히 새로운 기능 요청
- 기능 개선: 기존 기능의 동작 방식 변경, 성능 개선, 편의성 향상
- 버그 수정: 오류, 장애, 의도치 않은 동작 수정
- UI·UX: 디자인 변경, 레이아웃 조정, 사용성 개선 (기능 변경 없음)
- 데이터: 데이터 조회/수정/마이그레이션 관련
- 기타: 위 분류에 해당하지 않는 요청

**요청서 본문 작성 규칙:**
1. 제목은 title 필드에만 넣는다. 본문 첫 줄에 제목을 반복하지 않는다.
2. 첫 줄: 목적: 이 기능이 필요한 이유 한 문장
3. 번호 리스트(1. 2. 3.)로 핵심 변경 포인트만 정리 (하위 항목이 꼭 필요할 때만 - 불릿 한 단계)
4. 개발자 관점: "내가 불편해요" → "시스템이 어떻게 동작해야 하는지"
5. 주어는 시스템: "[필드명] 미갱신", "[버튼] 클릭 시 ~" 패턴
6. 핵심 전달에 필요한 내용만. 부연 설명·수식어·미사여구·배경 설명 금지. 한 항목은 한 줄
7. 모호한 표현 제거, 구체적 필드명·화면명 사용
8. 마크다운 강조 기호(*, **, ***, #, 백틱)와 표(테이블) 사용 절대 금지. 순수 평문으로만 작성

**우선순위 판단 기준:**
- 최우선: 서비스 장애, 데이터 손실, 보안 이슈
- 높음: 핵심 기능 오류, 업무 차질 발생
- 보통: 일반 개선, 사소한 버그, UX 개선
- 낮음: 사소한 디자인 변경, 미래 개선 제안

반드시 위 JSON 형식으로만 출력하세요. 다른 텍스트 없이 JSON만 출력하세요.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    // 응답 첫 블록이 비어있거나 text가 아닐 때 옛 코드는 .text 접근에서 그대로 터졌다 → 가드
    const block = message.content[0] as { type?: string; text?: string } | undefined;
    const raw = block && block.type === "text" && block.text ? block.text : "";
    if (!raw) {
      console.error(
        "[dev-request/structure] AI 응답에 텍스트가 없음:",
        JSON.stringify({ stop_reason: message.stop_reason, content: message.content }).slice(0, 500)
      );
      return NextResponse.json({ success: false, error: "AI 응답이 비어 있습니다. 다시 시도해주세요." }, { status: 502 });
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[dev-request/structure] JSON 형태를 못 찾음. raw 앞부분:", raw.slice(0, 300));
      return NextResponse.json({ success: false, error: "AI 응답 파싱 실패. 다시 시도해주세요." }, { status: 502 });
    }

    let parsed: { title?: string; content?: string; priority?: string };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      const fixed = jsonMatch[0].replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
        match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
      );
      try {
        parsed = JSON.parse(fixed);
      } catch {
        parsed = { title: "개발 요청", content: raw.replace(/```json|```/g, "").trim(), priority: "보통" };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        title: stripBoldMarkers(parsed.title || "개발 요청"),
        content: stripBoldMarkers(parsed.content || raw),
        priority: parsed.priority || "보통",
        category: (parsed as { category?: string }).category || "기타",
      },
    });
  } catch (err: unknown) {
    const e = err as { status?: number; name?: string; message?: string };
    // 옛 코드는 여기서 원인을 한 줄도 안 남겨 재발 시 진단이 불가능했다 → 항상 기록
    console.error("[dev-request/structure] 구조화 실패:", {
      status: e?.status,
      name: e?.name,
      message: e?.message,
    });
    const status = e?.status;
    if (status === 529 || status === 503) {
      return NextResponse.json({ success: false, error: "AI 서버가 일시적으로 바쁩니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
    }
    if (status === 429) {
      return NextResponse.json({ success: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }
    if (status === 401) {
      return NextResponse.json({ success: false, error: "API 인증 오류. 관리자에게 문의하세요." }, { status: 500 });
    }
    // status 없는 연결/타임아웃 오류 — 사용자 오류 보고의 가장 유력한 일시적 원인
    const isConnIssue =
      e?.name === "APIConnectionTimeoutError" ||
      e?.name === "APIConnectionError" ||
      /timeout|timed out|fetch failed|ECONN|network|connection/i.test(e?.message || "");
    if (isConnIssue) {
      return NextResponse.json({ success: false, error: "AI 응답이 지연되어 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 504 });
    }
    return NextResponse.json({ success: false, error: "요청서 생성 중 오류가 발생했습니다. 다시 시도해주세요." }, { status: 500 });
  }
}
