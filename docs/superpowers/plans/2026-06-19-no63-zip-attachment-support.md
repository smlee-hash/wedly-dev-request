# NO.63 — 기능 요청 첨부 ZIP 지원 + 업로드 허용 로직 통일

요청(노션 [ERP] 개발요청 NO.63, 이아영): 기능 요청 등록 폼에서 알집(.zip) 첨부가 안 된다.
이미지·PDF 등 기존 형식과 동일하게 업로드/저장/조회 되게 하고, 업로드·저장 로직을 통일.
ERP·하이브·일루아 3앱 동일 적용.

## 구조 (조사 결과 — 추측 아님)
- 기능 요청 폼 = 별도 앱 `wedly-dev-request` 한 곳. ERP/하이브/일루아는 이 앱을
  `@wedly/ui-shared`의 `DevRequestPanel`이 **iframe**으로 임베드(앱별 사본 없음).
  → **dev-request 한 곳만 고치면 3앱에 동시 적용.**
- 비이미지 첨부(PDF·docx 등)는 이미 동작: 업로드 → DB(base64) 저장 → 노션에 `📎 파일명`
  다운로드 링크(`fileIds` 경로) → 조회 시 `Content-Disposition: attachment`로 내려받음.
  ZIP만 허용 목록에서 빠져 있어 막혔다.

## ZIP이 막히던 3곳 (모두 허용 목록 누락)
1. `app/page.tsx:339` 파일 선택창 `accept`에 `.zip` 없음 → 고를 수조차 없음.
2. `app/page.tsx:78-79` `isAllowedFile` — zip MIME·`.zip` 확장자 없음 → 드롭해도 조용히 걸러짐.
3. `app/api/dev-request/upload/route.ts:20` 서버 `ALLOWED_TYPES` — zip MIME 없음 → 서버가 건너뜀(skipped).
4. (덤) 안내 문구가 실제(10MB)와 다른 "5MB"로 표기·zip 미언급.

## 변경 (통일이 요청의 핵심 — 한 곳에서 규칙 관리)
1. **신규** `lib/upload-allow.ts` (순수 함수, 프론트·서버 공용):
   - `isAllowedUploadFile(name, type)` — 허용 MIME 접두사 또는 허용 확장자면 true.
   - `ALLOWED_MIME_PREFIXES` / `ALLOWED_EXTENSIONS` / `UPLOAD_ACCEPT_ATTR` 상수.
   - 기존 허용군(이미지·pdf·office·hwp) + **zip**(`application/zip`, `application/x-zip*`, `.zip`).
   - 확장자 보강: 브라우저가 zip의 MIME을 비워두거나 octet-stream으로 주는 경우 파일명으로 허용.
2. **신규** `lib/upload-allow.test.ts` (TDD) — `npx tsx`로 실행, 기존 테스트 패턴.
3. `app/page.tsx` — `isAllowedFile`를 공용 헬퍼로 교체, `accept`를 `UPLOAD_ACCEPT_ATTR`로,
   안내 문구를 "이미지·문서·압축(zip) 등 (최대 10MB)"로.
4. `app/api/dev-request/upload/route.ts` — `ALLOWED_TYPES`/`isAllowed`를 공용 헬퍼로 교체
   (서버도 확장자 보강 포함 → 프론트·서버 규칙 100% 일치).

## 안 바꾸는 것 (회귀 방지)
- 저장/조회/노션 등록 경로(fileIds → 📎 링크, attachment 헤더) 그대로 — 이미 동작.
- 용량 한도 10MB 그대로(형식 요청이지 용량 요청 아님). zip이 10MB 초과면 기존 정직 안내 그대로.
- 이미지 vs 파일 분기(imageIds/fileIds) 그대로 — zip은 비이미지라 자동으로 📎 링크.

## 검증
- 단위 테스트(zip 각종 MIME/확장자 허용, exe·미지원 거부, 기존 형식 유지).
- `npm run build` 통과.
- 배포 후 실제 브라우저(BROWSER-QA): 폼에서 .zip 선택→첨부됨→등록→노션에 📎 링크→다운로드.
- 노션 NO.63 댓글(WEDLY AI + 이아영) + 상태 검수요청.
