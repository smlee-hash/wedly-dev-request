// 단위 테스트 — `npx tsx lib/upload-allow.test.ts` 로 실행.
// 핵심 보장(NO.63): 기능 요청 첨부 허용 규칙이 프론트·서버 한 곳(upload-allow)에서 동일하게 적용되고,
// 알집(.zip)이 브라우저가 MIME 을 어떻게 주든(application/zip · x-zip-compressed · 빈값/octet-stream) 허용된다.
// 기존 형식(이미지·pdf·office·hwp)은 그대로 허용되고, 위험·미지원 형식은 거부된다.
import { isAllowedUploadFile, UPLOAD_ACCEPT_ATTR, buildContentDisposition } from "./upload-allow";

let pass = 0;
let fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  if (got === want) {
    pass++;
  } else {
    fail++;
    console.error(`✗ ${name}\n   got:  ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`);
  }
}

// ── ZIP (NO.63 의 핵심) — 브라우저별로 MIME 표기가 제각각이라 모두 허용해야 한다 ──
eq("zip: application/zip", isAllowedUploadFile("자료.zip", "application/zip"), true);
eq("zip: x-zip-compressed(윈도우)", isAllowedUploadFile("자료.zip", "application/x-zip-compressed"), true);
eq("zip: x-zip", isAllowedUploadFile("자료.zip", "application/x-zip"), true);
eq("zip: MIME 빈값 + .zip 확장자", isAllowedUploadFile("자료.zip", ""), true);
eq("zip: octet-stream + .zip 확장자", isAllowedUploadFile("자료.zip", "application/octet-stream"), true);
eq("zip: 대문자 확장자 .ZIP", isAllowedUploadFile("BACKUP.ZIP", ""), true);

// ── 기존 허용 형식은 그대로(회귀 방지) ──
eq("image png", isAllowedUploadFile("a.png", "image/png"), true);
eq("image jpeg", isAllowedUploadFile("a.jpg", "image/jpeg"), true);
eq("pdf", isAllowedUploadFile("문서.pdf", "application/pdf"), true);
eq("docx", isAllowedUploadFile("문서.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), true);
eq("xlsx", isAllowedUploadFile("표.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), true);
eq("pptx", isAllowedUploadFile("발표.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"), true);
eq("xls(구형)", isAllowedUploadFile("표.xls", "application/vnd.ms-excel"), true);
eq("doc(구형)", isAllowedUploadFile("문서.doc", "application/msword"), true);
eq("hwp(haansoft)", isAllowedUploadFile("한글.hwp", "application/haansofthwp"), true);
eq("hwp(x-hwp)", isAllowedUploadFile("한글.hwp", "application/x-hwp"), true);
// 확장자 보강: office/pdf/hwp 도 MIME 빈값일 때 확장자로 허용
eq("docx: MIME 빈값 + 확장자", isAllowedUploadFile("문서.docx", ""), true);
eq("hwp: MIME 빈값 + 확장자", isAllowedUploadFile("한글.hwp", ""), true);

// ── 위험·미지원 형식은 거부 ──
eq("exe 거부", isAllowedUploadFile("악성.exe", "application/x-msdownload"), false);
eq("sh 거부", isAllowedUploadFile("script.sh", "application/x-sh"), false);
eq("MIME 빈값 + 미지원 확장자(.txt) 거부", isAllowedUploadFile("memo.txt", ""), false);
eq("MIME 빈값 + 확장자 없음 거부", isAllowedUploadFile("noname", ""), false);
eq("octet-stream + 미지원 확장자(.bin) 거부", isAllowedUploadFile("blob.bin", "application/octet-stream"), false);

// ── accept 속성에 zip 포함 확인 ──
eq("accept 에 .zip 포함", UPLOAD_ACCEPT_ATTR.includes(".zip"), true);
eq("accept 에 image/* 유지", UPLOAD_ACCEPT_ATTR.includes("image/*"), true);
eq("accept 에 .pdf 유지", UPLOAD_ACCEPT_ATTR.includes(".pdf"), true);
eq("accept 에 .hwp 유지", UPLOAD_ACCEPT_ATTR.includes(".hwp"), true);

// ── 다운로드 파일명 보존 (zip 이 확장자와 함께 내려받아져야 열린다) ──
eq("disposition: 한글 zip 은 filename* 에 원래이름 + ascii 폴백",
  buildContentDisposition("자료.zip", "id1"),
  `attachment; filename="__.zip"; filename*=UTF-8''${encodeURIComponent("자료.zip")}`);
eq("disposition: 영문 zip 그대로",
  buildContentDisposition("backup.zip", "id1"),
  `attachment; filename="backup.zip"; filename*=UTF-8''backup.zip`);
eq("disposition: 빈 이름 → id 폴백",
  buildContentDisposition("", "id1"),
  `attachment; filename="id1"; filename*=UTF-8''id1`);
eq("disposition: 따옴표/개행/경로 주입 제거",
  buildContentDisposition('a"\r\n/b.zip', "id1"),
  `attachment; filename="a____b.zip"; filename*=UTF-8''${encodeURIComponent("a____b.zip")}`);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
