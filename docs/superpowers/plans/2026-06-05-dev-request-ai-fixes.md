# 기능 요청 자동 생성 AI 수정 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기능 요청 자동 생성 AI에서 별표(`**`) 노출과 내용 과잉을 없애고, AI 구조화를 건너뛰는 `바로 등록` 경로를 추가한다.

**Architecture:** 두 파일만 수정. (1) 서버 지시문(`route.ts`)에서 마크다운 강조 사용을 금지하고 응답 직전 별표를 제거. (2) 화면(`page.tsx`)에 `바로 등록` 버튼과 확인 화면 제목 입력칸을 추가하고, 바로 등록 시 제목을 첫 줄에서 자동 제안.

**Tech Stack:** Next.js(App Router) + React + TypeScript, Anthropic SDK. 자동 테스트 도구 없음 → 검증은 `npm run build` + `next lint` + 핵심 정규식 단독 확인 + 미리보기.

> 참고: 대상 저장소는 **wedly-dev-request** (별도 repo, main 브랜치). 아래 경로는 이 repo 루트 기준.

---

### Task 1: 서버 지시문 정리 + 별표 제거 안전장치 (`route.ts`)

**Files:**
- Modify: `app/api/dev-request/structure/route.ts:19-57` (프롬프트 본문)
- Modify: `app/api/dev-request/structure/route.ts:86-94` (응답 반환부)

- [ ] **Step 1: 프롬프트 본문 규칙 교체**

`app/api/dev-request/structure/route.ts`의 `const prompt = ...` 블록(19-57행)을 아래로 교체. 핵심 변경: ① 제목 반복 금지(첫 줄 `***제목***` 규칙 삭제) ② 마크다운 강조·표 금지 명시 ③ 간결 규칙 강화.

```ts
    const prompt = `사용자가 앱의 오류/개선 요청을 입력했습니다. 이것을 개발자가 바로 이해하고 작업할 수 있는 구조화된 요청서로 변환하고, 우선순위를 자동으로 판단해주세요.

요청 내용: ${content}

출력 형식 (반드시 이 JSON 형식으로만 출력):
\`\`\`json
{
  "title": "제목 (~기능 요청 / ~개선 요청 / ~버그 수정 / ~기능 추가 중 하나로 끝낼 것)",
  "content": "구조화된 요청서 본문",
  "priority": "우선순위 (최우선/높음/보통/낮음 중 하나)",
  "category": "카테고리 (신규 기능/기능 개선/버그 수정/UI·UX/데이터/기타 중 하나)"
}
\`\`\`

카테고리 판단 기준:
- 신규 기능: 기존에 없던 완전히 새로운 기능 요청
- 기능 개선: 기존 기능의 동작 방식 변경, 성능 개선, 편의성 향상
- 버그 수정: 오류, 장애, 의도치 않은 동작 수정
- UI·UX: 디자인 변경, 레이아웃 조정, 사용성 개선 (기능 변경 없음)
- 데이터: 데이터 조회/수정/마이그레이션 관련
- 기타: 위 분류에 해당하지 않는 요청

요청서 본문(content) 작성 규칙:
1. 제목은 title 필드에만 넣는다. 본문 첫 줄에 제목을 반복하지 않는다.
2. 첫 줄은 "목적: <이 기능이 필요한 이유 한 문장>".
3. 그 다음 번호 목록(1. 2. 3.)으로 핵심 변경 포인트만 정리. 하위 항목이 꼭 필요할 때만 "- "로 한 단계까지.
4. 개발자 관점으로: "내가 불편해요" → "시스템이 어떻게 동작해야 하는지".
5. 주어는 시스템: "[필드명] 미갱신", "[버튼] 클릭 시 ~" 패턴.
6. 핵심 전달에 필요한 내용만 쓴다. 부연 설명·수식어·미사여구·배경 설명 금지. 한 항목은 한 줄.
7. 모호한 표현 제거, 구체적 필드명·화면명 사용.
8. 마크다운 강조 기호(*, **, ***, #, 백틱)와 표(테이블) 사용 절대 금지. 순수 평문으로만 작성.

우선순위 판단 기준:
- 최우선: 서비스 장애, 데이터 손실, 보안 이슈
- 높음: 핵심 기능 오류, 업무 차질 발생
- 보통: 일반 개선, 사소한 버그, UX 개선
- 낮음: 사소한 디자인 변경, 미래 개선 제안

반드시 위 JSON 형식으로만 출력하세요. 다른 텍스트 없이 JSON만 출력하세요.`;
```

- [ ] **Step 2: 별표 제거 헬퍼 추가**

같은 파일 상단(`export async function POST` 위, import 아래)에 순수 함수 추가:

```ts
// 마크다운 강조 별표(**, ***) 제거 — 단일 *는 보존(예: "3 * 4")
function stripBoldMarkers(s: string): string {
  return s.replace(/\*{2,}/g, "");
}
```

- [ ] **Step 3: 반환부에서 제목·본문에 안전장치 적용**

86-94행의 `return NextResponse.json({ success: true, data: { ... } })`를 아래로 교체:

```ts
    return NextResponse.json({
      success: true,
      data: {
        title: stripBoldMarkers(parsed.title || "개발 요청"),
        content: stripBoldMarkers(parsed.content || raw),
        priority: parsed.priority || "보통",
        category: (parsed as { category?: string }).category || "기타",
      },
    });
```

- [ ] **Step 4: 정규식 동작 단독 확인**

Run: `node -e "const f=s=>s.replace(/\*{2,}/g,''); console.log(f('***제목*** **목적**: 3 * 4 별점**5**'))"`
Expected 출력: `제목 목적: 3 * 4 별점5` (별표 2개 이상만 사라지고 단일 `*`는 남음)

---

### Task 2: `바로 등록` 동작 + 입력 화면 버튼 분리 (`page.tsx`)

**Files:**
- Modify: `app/page.tsx:154` 부근 (`handleStructure` 함수 바로 아래에 신규 함수 추가)
- Modify: `app/page.tsx:346-351` (입력 화면 버튼 영역)

- [ ] **Step 1: `handleDirectRegister` 함수 추가**

`handleStructure` 함수가 끝나는 지점(154행 `};` 다음 줄)에 아래 함수를 추가:

```ts
  // STEP 1→3: AI 없이 바로 확인 화면으로 (제목은 입력 첫 줄에서 자동 제안)
  const handleDirectRegister = () => {
    if (!rawContent.trim()) return;
    const firstLine =
      rawContent.split("\n").map((l) => l.trim()).find((l) => l.length > 0) || "";
    setStructuredTitle(firstLine.slice(0, 60));
    setStructuredContent(rawContent.trim());
    setPriority("보통");
    setCategory("기타");
    setSubmitResult(null);
    setStep("review");
  };
```

- [ ] **Step 2: 입력 화면 버튼 교체 (1개 → 2개 + 취소)**

346-351행의 버튼 묶음을 아래로 교체. `요청서 생성` → `AI 구조화 후 등록`(채운 버튼)으로 이름 변경, `바로 등록`(외곽선 버튼) 신규 추가:

```tsx
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button onClick={handleStructure} disabled={!rawContent.trim()} className="px-4 py-2 text-[13px] font-medium text-white bg-wedly-accent rounded-lg hover:bg-wedly-accent/90 disabled:opacity-50 transition-all">
                      AI 구조화 후 등록
                    </button>
                    <button onClick={handleDirectRegister} disabled={!rawContent.trim()} className="px-4 py-2 text-[13px] font-medium text-wedly-accent border border-wedly-accent rounded-lg hover:bg-bg-blue disabled:opacity-50 transition-all">
                      바로 등록
                    </button>
                    <button onClick={resetForm} className="px-4 py-2 text-[13px] text-wedly-muted border border-wedly-bd rounded-lg">취소</button>
                  </div>
```

---

### Task 3: 확인 화면 제목 입력칸 + 라벨 정리 + 등록 잠금 (`page.tsx`)

**Files:**
- Modify: `app/page.tsx:370-372` 부근 (확인 화면 상단, 미리보기 grid 직전)
- Modify: `app/page.tsx:391` (카테고리 라벨)
- Modify: `app/page.tsx:432` (노션에 등록 버튼)

- [ ] **Step 1: 확인 화면 상단에 제목 입력칸 추가**

확인 화면(`step === "review"`)에서 `<p className="text-[11px] text-wedly-muted mb-2">{appLabel}...</p>` 줄(370행) 바로 다음, 미리보기 grid(`<div className="grid grid-cols-1 md:grid-cols-2 gap-3">`, 372행) 직전에 아래 블록 삽입:

```tsx
                  <div className="mb-1">
                    <label className="text-[12px] font-medium text-wedly-t2 mb-1 block">제목</label>
                    <input
                      type="text"
                      value={structuredTitle}
                      onChange={(e) => setStructuredTitle(e.target.value)}
                      placeholder="요청 제목을 입력하세요"
                      className="w-full px-3 py-2 text-[13px] border border-wedly-bd rounded-lg focus:outline-none focus:border-wedly-accent transition-colors"
                    />
                  </div>
```

- [ ] **Step 2: 카테고리 라벨에서 "(AI 자동 분류)" 제거**

391행을 아래로 교체 (바로 등록 경로에선 AI 분류가 아니므로 보조문구 삭제):

```tsx
                      <label className="text-[12px] font-medium text-wedly-t2 mb-1.5 block">카테고리</label>
```

- [ ] **Step 3: 제목이 비면 `노션에 등록` 버튼 잠금**

432행의 등록 버튼 `disabled` 조건에 제목 빈값 검사 추가:

```tsx
                    <button onClick={handleSubmit} disabled={submitting || !structuredTitle.trim()} className="px-4 py-2 text-[13px] font-medium text-white bg-wedly-accent rounded-lg hover:bg-wedly-accent/90 disabled:opacity-50 transition-all">
                      {submitting ? "등록 중..." : "노션에 등록"}
                    </button>
```

---

### Task 4: 검증 (빌드 · 문법검사 · 디자인 토큰 · 미리보기)

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 빌드 성공 확인**

Run: `cd /Users/00.logico.l/wedly-dev-request && npm run build`
Expected: 오류 없이 빌드 완료 (`✓ Compiled` / 라우트 목록 출력)

- [ ] **Step 2: 문법/린트 확인**

Run: `cd /Users/00.logico.l/wedly-dev-request && npx next lint`
Expected: 이번에 추가한 코드에 오류 없음

- [ ] **Step 3: 내가 추가한 코드의 raw 컬러 점검**

Run: `cd /Users/00.logico.l/wedly-dev-request && git diff -- app/page.tsx | grep -E "^\+" | grep -nE "(bg|text|border|from|to)-(green|amber|red|sky|blue|indigo|violet|pink|gray|slate|zinc|orange|yellow|lime|emerald|teal|cyan|rose|fuchsia)-(50|100|200|300|400|500|600|700|800|900)"`
Expected: 출력 없음 (새로 추가한 줄은 모두 WEDLY 토큰 사용). 기존 줄의 raw 컬러는 이번 범위 밖.

- [ ] **Step 4: 미리보기로 동작 확인 (가능 시)**

`preview_start`로 dev 서버 기동(포트 3100) 후, 입력 화면에 `AI 구조화 후 등록`·`바로 등록` 두 버튼이 보이는지, `바로 등록` 클릭 시 확인 화면에 제목칸이 첫 줄로 채워지는지, 제목을 비우면 `노션에 등록`이 잠기는지 확인. 환경변수/DB 미설정으로 목록 조회가 비어도 입력→확인 흐름은 검증 가능. (서버 기동 불가 시 코드 자가검토로 대체)

---

### Task 5: 죽은 코드 확인 (wedly-erp 레거시 경로)

**Files:** 없음 (확인 전용)

- [ ] **Step 1: wedly-erp의 구조화 경로 사용처 확인**

Run: `grep -rn "api/dev-request/structure" /Users/00.logico.l/wedly-erp/src 2>/dev/null`
Expected: 호출하는 곳이 없으면(끼워넣기는 wedly-dev-request 자체 경로 사용) **범위 밖 — 건드리지 않음**. 만약 호출처가 있으면 동일 지시문 수정이 필요하므로 별도 보고.

---

### Task 6: 자가점검 → 배포

- [ ] **Step 1: 자가점검 사이클 1라운드**

핵심 5관점(정확도·엣지케이스·안정성·보안·연결기능)으로 변경분 점검. 발견 약점 즉시 수정. (page.tsx 변경이 작고 핵심 보안/결제 로직 아님 → code-reviewer 서브에이전트 생략 기준에 해당)

- [ ] **Step 2: 커밋 (코드 + 설계/계획 문서 함께)**

```bash
cd /Users/00.logico.l/wedly-dev-request
git add app/api/dev-request/structure/route.ts app/page.tsx docs/superpowers/specs docs/superpowers/plans
git commit -m "fix(dev-request): AI 요청서 별표 제거·간결화 + 바로 등록(AI 생략) 버튼·제목칸 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 3: 푸시 (자동 배포)**

```bash
cd /Users/00.logico.l/wedly-dev-request && git push origin main
```

- [ ] **Step 4: 업데이트 알림 등록**

이 앱 자체 알림 시스템(`/api/app-updates`)으로 등록. 카테고리 `improve`, 페이지 경로는 끼워넣기 페이지에 맞춰 지정. (정확한 등록 방식은 `app/api/app-updates` 라우트의 POST 형식을 확인 후 호출)

---

## Self-Review (작성자 점검)

- **Spec 커버리지:** ①별표 = Task1(Step1·2·3); ②간결화 = Task1(Step1, 규칙6+제목중복제거); ③버튼분리 = Task2; 바로등록 첫줄 제목 = Task2(Step1); 확인화면 제목칸 = Task3(Step1); 등록 잠금 = Task3(Step3). 모든 요구사항에 대응 task 존재.
- **Placeholder 점검:** TBD/TODO 없음. 모든 코드 단계에 실제 코드 포함.
- **타입/이름 일관성:** `handleDirectRegister`·`structuredTitle`·`structuredContent`·`stripBoldMarkers` 등 명칭이 task 전체에서 일치. 상태 변수는 기존 정의(`page.tsx:66-71`)와 동일.
- **엣지:** 첫 줄 빈 줄 처리(find 비어있지않은 줄), 60자 컷, 제목 빈값 등록 잠금, 단일 `*` 보존 — 모두 반영.
