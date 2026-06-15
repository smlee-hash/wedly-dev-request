// 외부 시스템(노션 등)에 박는 "공개 베이스 URL" 계산.
//
// 왜 필요한가 (NO.48):
//   기능 요청 첨부 이미지를 노션에 넣을 때 주소를 `${baseUrl}/api/images/{id}` 로 만든다.
//   예전엔 baseUrl 을 `new URL(req.url)` 로 만들었는데, Railway 내부에서 앱이 보는 호스트가
//   `localhost:8080`(내부 포트)라 `https://localhost:8080/api/images/...` 가 노션에 박혀
//   노션 서버가 이미지를 못 가져와 깨졌다. 즉 **공개 주소에는 절대 내부주소가 들어가면 안 된다.**
//
// 신뢰 순서 (앞이 더 신뢰):
//   1) 명시 env (PUBLIC_BASE_URL / NEXT_PUBLIC_BASE_URL) — 운영자가 직접 지정한 값
//   2) RAILWAY_PUBLIC_DOMAIN — Railway 가 서비스 공개 도메인으로 항상 주입(헤더 의존 없음 → 가장 안정)
//   3) x-forwarded-host — 프록시가 넘긴 공개 호스트(헤더라 누락/오설정 가능)
//   4) req.url — 최후 폴백(내부주소일 수 있어 다른 후보가 전무할 때만)
//   각 후보가 내부주소(localhost 등)면 건너뛰고 다음 후보로 넘어간다.
//
// 순수 함수(전역 접근 없이 입력만 받음) — 단위 테스트가 쉽다.

// 노션 image 블록은 URL이 이미지 확장자(.png/.jpg ...)로 "끝나야" 이미지로 인정한다(확장자 없으면 거부).
// devRequestImage 의 mimeType → 붙일 확장자. 서빙(/api/images/[id])은 이 확장자를 떼고 id 로 조회한다.
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/tiff": "tiff",
};
/** mimeType → 노션이 인정하는 이미지 확장자. 이미지가 아니거나 모르면 "png"(노션이 콘텐츠 타입으로 렌더). */
export function imageExtForMime(mime: string | null | undefined): string {
  const m = (mime || "").toLowerCase().trim();
  return MIME_TO_EXT[m] || "png";
}

/** 경로 끝의 이미지 확장자를 떼어 실제 저장 id 를 돌려준다. 확장자 없으면 그대로. */
export function stripImageExt(idOrName: string): string {
  return (idOrName || "").replace(/\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff?|svg|ico)$/i, "");
}

/** 값이 내부/사설 주소(노션이 못 가져오는 주소)면 true. 호스트 단독 또는 전체 URL 모두 판정. */
export function isInternalHost(value: string | null | undefined): boolean {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  if (!v) return true;
  return (
    /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/.test(v) ||
    /\.railway\.internal(:|\/|$)/.test(v) ||
    /(^|\.)internal(:|\/|$)/.test(v)
  );
}

export type BaseUrlSources = {
  envBase?: string | null;            // process.env.PUBLIC_BASE_URL || NEXT_PUBLIC_BASE_URL
  railwayPublicDomain?: string | null; // process.env.RAILWAY_PUBLIC_DOMAIN (도메인만, 스킴 없음)
  forwardedHost?: string | null;       // req.headers x-forwarded-host
  forwardedProto?: string | null;      // req.headers x-forwarded-proto
  reqUrl?: string | null;              // req.url
};

/** 노션 등에 박을 공개 베이스 URL(끝 슬래시 없음). 내부주소는 절대 반환하지 않으려 노력한다. */
export function resolvePublicBaseUrl(s: BaseUrlSources): string {
  const strip = (x: string) => x.trim().replace(/\/+$/, "");

  // 1) 명시 env
  const env = strip(s.envBase || "");
  if (env && !isInternalHost(env)) return env;

  // 2) Railway 주입 공개 도메인 (가장 안정 — 헤더 의존 없음)
  const rw = (s.railwayPublicDomain || "").trim().replace(/^https?:\/\//, "");
  if (rw && !isInternalHost(rw)) return `https://${strip(rw)}`;

  // 3) 프록시가 넘긴 공개 호스트
  const fwdHost = (s.forwardedHost || "").trim();
  const fwdProto = (s.forwardedProto || "https").trim() || "https";
  if (fwdHost && !isInternalHost(fwdHost)) return `${fwdProto}://${fwdHost}`;

  // 4) 최후 폴백 — req.url (내부주소일 수 있음)
  try {
    if (s.reqUrl) {
      const u = new URL(s.reqUrl);
      return `${u.protocol}//${u.host}`;
    }
  } catch {
    /* ignore */
  }
  return "";
}
