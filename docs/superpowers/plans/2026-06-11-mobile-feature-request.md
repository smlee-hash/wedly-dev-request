# 기능요청 페이지 모바일 개선 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 휴대폰(좁은 화면)에서 기능요청 목록을 표 대신 카드로 보여주고, 입력 확인 단계의 중복(미리보기+편집)을 편집 한 칸으로 합친다. PC 화면은 변경하지 않는다.

**Architecture:** 단일 클라이언트 컴포넌트(`app/page.tsx`)에서 표 블록과 카드 블록을 둘 다 렌더하고 Tailwind 반응형 클래스로 폭에 따라 하나만 표시한다(`hidden md:block` / `md:hidden`). 펼친 내용 렌더러는 공용 컴포넌트로 추출해 표·카드가 공유한다.

**Tech Stack:** Next.js 14 (App Router), React 18, Tailwind CSS v3, WEDLY 디자인 토큰. 테스트 러너 없음 → 검증은 `npm run build` + 실제 브라우저(폭 ~375px) 확인.

**분기점:** 목록·입력 모두 `md`(768px). 미만 = 모바일(카드 / 편집 한 칸), 이상 = 기존 표 / 2열 미리보기. (설계서의 `sm`을 구현에서 `md`로 통일 — 9칸 표는 768px 미만에서도 좁고, 입력 분기점과 일치시킴.)

---

## File Structure

- Modify: `app/page.tsx`
  - 모듈 레벨에 `RequestBody` 컴포넌트 추가(내용 렌더러 추출)
  - 표의 펼침 행(558~572줄 IIFE)을 `<RequestBody />`로 교체
  - 표 컨테이너(479줄)에 `hidden md:block` 추가
  - 표 블록 뒤에 모바일 카드 블록(`md:hidden`) 추가
  - 입력 확인 단계 미리보기 칸(402줄)에 `hidden md:block` 추가
  - `InlineSelect` 드롭다운 항목 터치 영역 소폭 확대

다른 파일 변경 없음(API·데이터·팝업·첨부 흐름 그대로).

---

## Task 1: 펼친 내용 렌더러를 공용 컴포넌트로 추출

표·카드가 같은 내용 표시 로직을 공유하도록 추출한다. 동작 변화 없음(순수 리팩토링).

**Files:**
- Modify: `app/page.tsx` (모듈 레벨 컴포넌트 추가 + 표 펼침행 교체)

- [ ] **Step 1: `RequestBody` 컴포넌트 추가**

`app/page.tsx`에서 `InlineSelect` 함수 정의가 끝나는 줄(현재 630줄 `}`) 바로 다음에 아래를 추가:

```tsx
function RequestBody({ content }: { content: string }) {
  if (!content) return null;
  return (
    <>
      {content.split("\n").map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        if (trimmed.startsWith("***") && trimmed.endsWith("***")) return <h3 key={i} className="text-[15px] font-bold text-wedly-navy mb-1">{trimmed.replace(/\*{3}/g, "")}</h3>;
        if (trimmed.startsWith("**") && trimmed.includes("**:")) {
          const parts = trimmed.match(/^\*\*(.+?)\*\*[:\s]*(.*)/);
          if (parts) return <p key={i} className="text-[13px] leading-[1.7]"><span className="font-bold text-wedly-navy">{parts[1]}:</span> <span className="text-wedly-t1">{parts[2]}</span></p>;
        }
        if (/^\d+\./.test(trimmed)) return <p key={i} className="text-[13px] text-wedly-t1 leading-[1.7] pl-1">{trimmed}</p>;
        if (trimmed.startsWith("- ")) return <p key={i} className="text-[13px] text-wedly-t2 leading-[1.7] pl-4">{trimmed}</p>;
        if (trimmed === "---") return <hr key={i} className="my-2 border-wedly-bd" />;
        return <p key={i} className="text-[13px] text-wedly-t1 leading-[1.7]">{trimmed}</p>;
      })}
    </>
  );
}
```

- [ ] **Step 2: 표 펼침행의 인라인 렌더러를 교체**

현재 558~572줄(표 펼침행 안 흰 박스):
```tsx
                                <div className="bg-white rounded-lg border border-wedly-bd p-5 space-y-0.5">
                                  <h3 className="text-[15px] font-bold text-wedly-navy mb-2">{r.title}</h3>
                                  {r.content && (() => {
                                    return r.content.split("\n").map((line: string, i: number) => {
                                      // ... 7개 분기 ...
                                    });
                                  })()}
                                </div>
```
를 아래로 교체(IIFE 전체를 `<RequestBody />` 한 줄로):
```tsx
                                <div className="bg-white rounded-lg border border-wedly-bd p-5 space-y-0.5">
                                  <h3 className="text-[15px] font-bold text-wedly-navy mb-2">{r.title}</h3>
                                  {r.content && <RequestBody content={r.content} />}
                                </div>
```

- [ ] **Step 3: 빌드로 회귀 없음 확인**

Run: `npm run build`
Expected: 성공(에러 0). 타입 오류 없어야 함.

- [ ] **Step 4: 커밋**

```bash
git add app/page.tsx
git commit -m "refactor(dev-request): 펼친 내용 렌더러를 RequestBody 공용 컴포넌트로 추출"
```

---

## Task 2: 모바일 카드 목록 추가 + 표는 모바일에서 숨김

좁은 화면에서 표를 숨기고 카드 스택을 보여준다. 카드는 `InlineSelect`(칩 편집)·`RequestBody`(펼침)·`handleUpdate`/`handleDelete`/`expandedId`/`confirmDeleteId`를 그대로 재사용한다.

**Files:**
- Modify: `app/page.tsx` (479줄 표 컨테이너 + 583줄 이후 카드 블록)

- [ ] **Step 1: 표 컨테이너를 PC 전용으로**

현재 479줄:
```tsx
            <div className="overflow-x-auto rounded-lg border border-wedly-bd">
```
교체:
```tsx
            <div className="hidden md:block overflow-x-auto rounded-lg border border-wedly-bd">
```

- [ ] **Step 2: 표 블록 닫힘 직후 모바일 카드 블록 추가**

표 `</div>`(현재 583줄, `</table>` 다음의 컨테이너 닫는 `</div>`) 바로 다음 줄에 아래 블록을 추가:

```tsx
            {/* 모바일 카드 (md 미만) */}
            <div className="md:hidden space-y-2">
              {requests.map((r) => {
                const isOpen = expandedId === r.id;
                return (
                  <div key={r.id} className="rounded-xl border border-wedly-bd bg-white overflow-visible">
                    <div
                      onClick={() => setExpandedId(isOpen ? null : r.id)}
                      className={`p-3 cursor-pointer ${isOpen ? "bg-bg-blue/40" : ""}`}
                    >
                      {/* 윗줄: 번호 + 상태 */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-wedly-muted font-mono">#{r.no}</span>
                        <div onClick={(e) => e.stopPropagation()}>
                          <InlineSelect value={r.status} options={STATUS_OPTIONS} colors={STATUS_BADGE} onChange={(v) => handleUpdate(r.id, "status", v)} />
                        </div>
                      </div>
                      {/* 제목 */}
                      <div className="flex items-start gap-1.5">
                        <svg className={`w-3 h-3 mt-1 text-wedly-muted shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <h3 className="text-[14px] font-semibold text-wedly-navy leading-snug line-clamp-2">{r.title}</h3>
                      </div>
                      {/* 칩 줄 */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                        {r.app && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-bg-blue text-wedly-accent">{r.app.replace("wedly-", "")}</span>}
                        <InlineSelect value={r.category} options={CATEGORY_OPTIONS} colors={CATEGORY_COLORS} onChange={(v) => handleUpdate(r.id, "category", v)} />
                        <InlineSelect value={r.priority} options={PRIORITY_OPTIONS} colors={PRIORITY_COLORS} onChange={(v) => handleUpdate(r.id, "priority", v)} />
                      </div>
                      {/* 아랫줄: 요청자·날짜 + 더보기 */}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-wedly-muted">{r.requester} · {new Date(r.createdTime).toLocaleDateString("ko-KR")}</span>
                        <span className="text-[11px] font-medium text-wedly-accent">{isOpen ? "접기" : "더보기 ›"}</span>
                      </div>
                    </div>
                    {/* 펼침 */}
                    {isOpen && (
                      <div className="border-t border-wedly-bd px-3 py-3 bg-bg-blue/20">
                        <div className="flex items-center justify-end gap-2 mb-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${r.title}\n\n${r.content}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                            className="flex items-center gap-1 text-[11px] text-wedly-muted hover:text-wedly-accent transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                            {copied ? "복사됨" : "복사"}
                          </button>
                          {confirmDeleteId === r.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => { handleDelete(r.id); setConfirmDeleteId(null); setExpandedId(null); }} className="text-[10px] font-medium text-white bg-wedly-red px-2 py-1 rounded hover:bg-wedly-red/90">삭제</button>
                              <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] text-wedly-muted px-2 py-1 border border-wedly-bd rounded hover:bg-bg-gray">취소</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(r.id)} className="flex items-center gap-1 text-[11px] text-wedly-muted hover:text-wedly-red transition-colors">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              삭제
                            </button>
                          )}
                        </div>
                        <div className="bg-white rounded-lg border border-wedly-bd p-4 space-y-0.5">
                          {r.content ? <RequestBody content={r.content} /> : <p className="text-[12px] text-wedly-muted">내용 없음</p>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
```

설계 메모:
- 상태/카테고리/우선순위 칩과 그 묶음에 `stopPropagation`을 걸어, 칩을 눌러도 카드 펼침이 토글되지 않게 한다(칩은 값 변경만).
- 카드 컨테이너에 `overflow-visible`을 둬 `InlineSelect` 드롭다운(절대배치)이 잘리지 않게 한다.
- 삭제는 펼친 영역 안에만 두어 목록에서의 실수 탭을 막는다(`confirmDeleteId` 2단계 확인 그대로).
- 펼친 흰 박스에는 제목을 다시 쓰지 않는다(카드 머리줄에 이미 제목이 있음).

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 성공(에러 0).

- [ ] **Step 4: 로컬 육안 확인(선택)**

Run: `npm run dev` 후 브라우저를 좁게(또는 개발자도구 모바일) 열어 카드가 보이고, 칩 탭 시 드롭다운, 카드 탭 시 펼침 확인. (배포 후 정식 브라우저 QA는 Task 5)

- [ ] **Step 5: 커밋**

```bash
git add app/page.tsx
git commit -m "feat(dev-request): 모바일 목록을 카드로 표시 (md 미만), 표는 PC 전용"
```

---

## Task 3: 입력 확인 단계 — 모바일에서 미리보기 칸 숨김

확인 단계(STEP 3)의 2열(미리보기/편집) 중 읽기전용 미리보기를 모바일에서 숨겨 같은 글 중복을 없앤다.

**Files:**
- Modify: `app/page.tsx` (402줄 미리보기 칸)

- [ ] **Step 1: 미리보기 칸을 PC 전용으로**

현재 402줄:
```tsx
                    <div className="bg-bg-blue/60 rounded-lg border border-wedly-bd p-4 min-h-[320px]">
```
교체:
```tsx
                    <div className="hidden md:block bg-bg-blue/60 rounded-lg border border-wedly-bd p-4 min-h-[320px]">
```

설계 메모: 감싸는 그리드는 `grid-cols-1 md:grid-cols-2`이므로, 모바일(1열)에서 미리보기를 숨기면 편집 칸이 단독 전체폭으로 남는다. PC(md+)에서는 2열로 미리보기+편집 그대로.

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공(에러 0).

- [ ] **Step 3: 커밋**

```bash
git add app/page.tsx
git commit -m "feat(dev-request): 입력 확인 단계 모바일에서 편집 한 칸만 표시(미리보기 숨김)"
```

---

## Task 4: 칩 드롭다운 터치 영역 소폭 확대

모바일에서 손가락 탭이 쉽도록 드롭다운 항목 높이를 약간 키운다(PC에도 무해).

**Files:**
- Modify: `app/page.tsx` (`InlineSelect` 드롭다운 항목, 현재 617~624줄)

- [ ] **Step 1: 드롭다운 항목 패딩 확대**

현재 620줄 className의 `px-3 py-1.5`를 `px-3 py-2`로 변경:
```tsx
              className={`w-full text-left px-3 py-2 text-[11px] hover:bg-bg-gray transition-colors flex items-center gap-2 ${value === opt ? "font-semibold" : ""}`}
```
그리고 드롭다운 컨테이너(현재 615줄)의 `min-w-[120px]`를 `min-w-[130px]`로 소폭 확대:
```tsx
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white border border-wedly-bd rounded-lg shadow-lg py-1 min-w-[130px]">
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공(에러 0).

- [ ] **Step 3: 커밋**

```bash
git add app/page.tsx
git commit -m "style(dev-request): 칩 드롭다운 터치 영역 확대(모바일 조작성)"
```

---

## Task 5: 전체 검증 · 배포 · 브라우저 QA

**Files:** 없음(검증·배포만)

- [ ] **Step 1: raw 컬러 grep 검증 (브랜드 토큰만 사용 확인)**

Run:
```bash
grep -rnE "(bg|text|border|from|to)-(green|amber|red|sky|blue|indigo|violet|pink|gray|slate|zinc|orange|yellow|lime|emerald|teal|cyan|rose|fuchsia)-(50|100|200|300|400|500|600|700|800|900)" app/ 2>/dev/null
```
Expected: 결과 0줄(브랜드 그라디언트 예외 외). 있으면 WEDLY 토큰으로 치환 후 재검증.

- [ ] **Step 2: 최종 빌드**

Run: `npm run build`
Expected: 성공(에러 0).

- [ ] **Step 3: 푸시(Railway 자동배포)**

```bash
git push origin main
```
dev-request는 별도 `deploy-check.sh`가 없음 → Railway가 main 푸시 시 자동배포. 배포 완료는 `/api/build-id` 응답이 새 커밋으로 바뀌는지로 확인.

- [ ] **Step 4: 실제 브라우저 QA (폭 ~375px) — [BROWSER-QA] 필수 게이트**

`wedly-browser-qa` 스킬로 배포본을 모바일 폭으로 직접 조작:
- 목록이 카드로 보임(가로 스크롤 없음)
- 상태/카테고리/우선순위 칩 탭 → 드롭다운 → 값 변경이 화면·서버에 반영
- 카드 탭 → 펼침 → 전체 내용 + 복사(복사됨 표시) + 삭제(2단계) 동작
- '새 요청' → 내용 입력 → (AI 구조화 또는 바로 등록) → 확인 단계에서 **편집 한 칸만** 보임 → 노션 등록
- 데스크톱 폭(≥768px)에서 표·2열 미리보기 그대로(회귀 없음)
- 숨은 오류(errors) 0, 실패 통신(4xx/5xx) 0, 캡처 증거 확보

- [ ] **Step 5: (사용자 확인 후) 노션 QA 보드 등록 + 업데이트 팝업**

`wedly-notion-qa-board` 스킬 규칙에 따라 노션 등록은 AskUserQuestion으로 먼저 묻는다. 업데이트 팝업은 dev-request 자체 팝업 시스템(`APP_UPDATE_SECRET`) 사용 — 시크릿이 사용 가능할 때만. (둘 다 핵심 기능 외 사후 작업이라 사용자 확인 후 진행.)

---

## Self-Review (작성자 점검)

- **스펙 커버리지:** 목록 카드(A)=Task 2, 입력 한 칸(A)=Task 3, 렌더러 추출=Task 1, 터치 영역=Task 4, 분기 전략(md)=Task 2/3, 검증/QA=Task 5. 누락 없음.
- **플레이스홀더:** 없음(모든 코드 블록 실제 코드).
- **이름 일관성:** `RequestBody`(Task 1 정의 → Task 2 사용), `InlineSelect`/`handleUpdate`/`handleDelete`/`expandedId`/`confirmDeleteId`/`STATUS_OPTIONS`/`CATEGORY_OPTIONS`/`PRIORITY_OPTIONS`/`STATUS_BADGE`/`CATEGORY_COLORS`/`PRIORITY_COLORS` 모두 기존 정의와 일치.
- **위험:** 드롭다운 잘림(카드 `overflow-visible`로 대응), 긴 제목(`line-clamp-2`), 빈 내용("내용 없음" 분기), 삭제 실수 방지(펼침 안 배치 + 2단계).
