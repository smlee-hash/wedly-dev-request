import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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
    const client = new Anthropic({ apiKey, maxRetries: 3, timeout: 30000 });

    const prompt = `사용자가 앱의 오류/개선 요청을 입력했습니다. 이것을 개발자가 바로 이해하고 작업할 수 있는 구조화된 요청서로 변환하고, 우선순위를 자동으로 판단해주세요.

**요청 내용:** ${content}

**출력 형식 (반드시 이 JSON 형식으로만 출력):**
\`\`\`json
{
  "title": "제목 (~기능 요청 / ~개선 요청 / ~버그 수정 / ~기능 추가 중 하나로 끝낼 것)",
  "content": "구조화된 요청서 본문",
  "priority": "우선순위 (최우선/높음/보통/낮음 중 하나)"
}
\`\`\`

**요청서 본문 작성 규칙:**
1. 첫 줄: ***제목*** (굵게+기울임)
2. 다음 줄: **목적**: 이 기능이 필요한 이유 1문장
3. 번호 리스트로 변경 포인트 정리 (하위 항목은 - 불릿)
4. 개발자 관점: "내가 불편해요" → "시스템이 어떻게 동작해야 하는지"
5. 주어는 시스템: "[필드명] 미갱신", "[버튼] 클릭 시 ~" 패턴
6. 극도로 간결하게 — 개발자가 30초 안에 파악 가능한 최소 정보만
7. 모호한 표현 제거, 구체적 필드명·화면명 사용
8. 표(테이블) 사용 금지, 불릿 리스트만 사용

**우선순위 판단 기준:**
- 최우선: 서비스 장애, 데이터 손실, 보안 이슈
- 높음: 핵심 기능 오류, 업무 차질 발생
- 보통: 일반 개선, 사소한 버그, UX 개선
- 낮음: 사소한 디자인 변경, 미래 개선 제안

반드시 위 JSON 형식으로만 출력하세요. 다른 텍스트 없이 JSON만 출력하세요.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text;

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ success: false, error: "AI 응답 파싱 실패" }, { status: 500 });
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
        title: parsed.title || "개발 요청",
        content: parsed.content || raw,
        priority: parsed.priority || "보통",
      },
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 529 || status === 503) {
      return NextResponse.json({ success: false, error: "AI 서버가 일시적으로 바쁩니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
    }
    if (status === 429) {
      return NextResponse.json({ success: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }
    if (status === 401) {
      return NextResponse.json({ success: false, error: "API 인증 오류. 관리자에게 문의하세요." }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: "요청서 생성 중 오류가 발생했습니다. 다시 시도해주세요." }, { status: 500 });
  }
}
