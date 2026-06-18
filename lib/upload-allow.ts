// 기능 요청 첨부 허용 형식 — 프론트(파일 선택/드롭 필터)와 서버(업로드 저장)가 같은 규칙을 쓰도록 한 곳에 모은다.
// "업로드 및 저장 로직 통일"(NO.63). 위험 형식은 받지 않고, 이미지·문서·압축(zip)만 허용한다.
//
// 두 단계로 판정한다(둘 중 하나라도 통과하면 허용):
//  1) MIME 접두사 — 브라우저가 형식을 제대로 알아낸 경우.
//  2) 파일 확장자 — 브라우저가 MIME 을 비워두거나 octet-stream 으로 주는 경우의 보강.
//     특히 zip·hwp 는 OS/브라우저에 따라 MIME 이 제각각이라 확장자 보강이 필수다.

// 허용 MIME 접두사 (startsWith 로 비교)
export const ALLOWED_MIME_PREFIXES = [
  "image/",                                          // 모든 이미지 (png, jpeg, gif, webp ...)
  "application/pdf",                                 // PDF
  "application/vnd.openxmlformats-officedocument",   // docx, xlsx, pptx
  "application/vnd.ms-",                             // 구형 office (xls=ms-excel, ppt=ms-powerpoint)
  "application/msword",                             // 구형 doc
  "application/haansofthwp",                         // 한글 hwp
  "application/x-hwp",                              // 한글 hwp (변형 표기)
  "application/zip",                                 // 압축 zip (표준)
  "application/x-zip",                              // 압축 zip (변형: x-zip, x-zip-compressed 포함)
];

// 허용 확장자 (소문자, 점 제외)
export const ALLOWED_EXTENSIONS = ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "pdf", "hwp", "zip"];

const EXT_RE = new RegExp(`\\.(${ALLOWED_EXTENSIONS.join("|")})$`, "i");

/** 파일명·MIME 으로 첨부 허용 여부 판정 (프론트·서버 공용 단일 규칙). */
export function isAllowedUploadFile(name: string, type: string): boolean {
  const t = (type || "").toLowerCase();
  if (ALLOWED_MIME_PREFIXES.some((p) => t.startsWith(p))) return true;
  return EXT_RE.test(name || "");
}

/** 파일 선택창 accept 속성 — 화면과 한곳에서 관리해 어긋나지 않게. */
export const UPLOAD_ACCEPT_ATTR = "image/*,.doc,.docx,.pdf,.xls,.xlsx,.ppt,.pptx,.hwp,.zip";

/** 첨부 안내 문구 (화면 표시용). */
export const UPLOAD_HINT_TEXT = "이미지·문서·압축(zip) 등 첨부 가능 (최대 10MB)";

/**
 * 비이미지 첨부 다운로드 시 원래 파일명을 살리는 Content-Disposition 값.
 * zip 등은 확장자가 살아야 내려받은 뒤 바로 열 수 있다(원래는 내부 id 로만 저장돼 확장자가 없었음).
 * 한글 등 비ASCII 이름은 filename*(RFC 5987)로, 옛 클라이언트용 ASCII 폴백도 함께 준다.
 * 헤더 깨짐/주입 방지를 위해 경로구분자·따옴표·제어문자는 밑줄로 치환한다.
 */
export function buildContentDisposition(rawName: string | null | undefined, fallback: string): string {
  const cleaned = (rawName || "").replace(/[\\/\r\n"]/g, "_").trim();
  const safe = cleaned || fallback;
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_") || fallback;
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}
