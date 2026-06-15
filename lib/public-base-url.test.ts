// 단위 테스트 — `npx tsx lib/public-base-url.test.ts` 로 실행.
// 핵심 보장: 어떤 경우에도 노션에 박는 공개 주소에 localhost(내부주소)가 들어가지 않는다.
import { resolvePublicBaseUrl, isInternalHost, imageExtForMime, stripImageExt } from "./public-base-url";

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

// isInternalHost
eq("internal: localhost:8080", isInternalHost("localhost:8080"), true);
eq("internal: https://localhost:8080", isInternalHost("https://localhost:8080"), true);
eq("internal: 127.0.0.1", isInternalHost("127.0.0.1:3000"), true);
eq("internal: railway.internal", isInternalHost("dev-request.railway.internal"), true);
eq("internal: empty", isInternalHost(""), true);
eq("public: railway.app", isInternalHost("wedly-dev-request-production.up.railway.app"), false);
eq("public: full url", isInternalHost("https://wedly-dev-request-production.up.railway.app"), false);

const PUBLIC = "https://wedly-dev-request-production.up.railway.app";

// 1) env 최우선 (정상 공개 주소면 그대로)
eq("env wins", resolvePublicBaseUrl({ envBase: "https://erp.wedly.kr/", railwayPublicDomain: "x.up.railway.app" }), "https://erp.wedly.kr");

// 2) env 가 localhost 면 무시 → RAILWAY_PUBLIC_DOMAIN 사용 (핵심: NO.48 의 진짜 회귀 방지)
eq("env=localhost ignored → railway", resolvePublicBaseUrl({ envBase: "http://localhost:8080", railwayPublicDomain: "wedly-dev-request-production.up.railway.app" }), PUBLIC);

// 3) env 없고 RAILWAY_PUBLIC_DOMAIN 있으면 그것 (헤더 무관)
eq("railway domain used", resolvePublicBaseUrl({ railwayPublicDomain: "wedly-dev-request-production.up.railway.app", forwardedHost: "localhost:8080", reqUrl: "http://localhost:8080/api/dev-request" }), PUBLIC);

// 4) RAILWAY 없으면 x-forwarded-host
eq("forwarded host used", resolvePublicBaseUrl({ forwardedHost: "wedly-dev-request-production.up.railway.app", forwardedProto: "https", reqUrl: "http://localhost:8080/x" }), PUBLIC);

// 5) 전부 내부주소뿐이면 최후 폴백(req.url) — 그래도 동작은 하되 내부주소
eq("all internal → reqUrl fallback", resolvePublicBaseUrl({ forwardedHost: "localhost:8080", reqUrl: "http://localhost:8080/api/dev-request" }), "http://localhost:8080");

// 6) ★핵심 회귀 시나리오: env 없음 + RAILWAY 있음 + req.url 이 localhost → 절대 localhost 안 박힘
eq("NO.48 regression guard", resolvePublicBaseUrl({ envBase: null, railwayPublicDomain: "wedly-dev-request-production.up.railway.app", forwardedHost: null, forwardedProto: null, reqUrl: "https://localhost:8080/api/dev-request" }).includes("localhost"), false);

// imageExtForMime — 노션이 이미지로 인정하려면 확장자가 필요
eq("ext png", imageExtForMime("image/png"), "png");
eq("ext jpeg→jpg", imageExtForMime("image/jpeg"), "jpg");
eq("ext webp", imageExtForMime("image/webp"), "webp");
eq("ext heic", imageExtForMime("image/heic"), "heic");
eq("ext unknown→png", imageExtForMime("application/octet-stream"), "png");
eq("ext null→png", imageExtForMime(null), "png");

// stripImageExt — 서빙 시 확장자 떼고 id 조회
eq("strip .png", stripImageExt("cmqejp7rm0002b4nzc8u02jps.png"), "cmqejp7rm0002b4nzc8u02jps");
eq("strip .jpg", stripImageExt("abc123.jpg"), "abc123");
eq("strip none (확장자 없으면 그대로)", stripImageExt("cmqejp7rm0002b4nzc8u02jps"), "cmqejp7rm0002b4nzc8u02jps");
eq("strip cuid 내부 점 없음 보존", stripImageExt("cm.weird"), "cm.weird"); // .weird 는 이미지확장자 아님 → 보존

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
