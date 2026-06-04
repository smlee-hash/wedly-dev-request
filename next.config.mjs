/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // 모든 페이지에서 iframe 임베드 허용 (WEDLY 앱 전용)
        source: "/:path*",
        headers: [
          // X-Frame-Options 는 의도적으로 내보내지 않는다.
          // 표준값은 DENY / SAMEORIGIN 뿐이고 "모두 허용"을 뜻하는 값은 없다.
          // 과거의 "ALLOWALL" 은 비표준 무효값이라, Edge 등 일부 브라우저가
          // 이를 DENY(차단)로 해석해 iframe 임베드가 막혔다("이 콘텐츠는 차단되어
          // 있습니다"). iframe 허용은 아래 CSP frame-ancestors 로만 표현한다.
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        // ⚠️ 끼워넣기 대상 HTML 은 캐시하지 않는다.
        // 이 페이지는 기본적으로 cache-control: s-maxage=31536000(1년) 으로
        // 캐시되는데, 그러면 과거의 잘못된 헤더(예: X-Frame-Options: ALLOWALL)가
        // 엣지/브라우저 캐시에 1년간 살아남아, 일부 브라우저(Comet 등)가 옛 응답을
        // 꺼내 보며 iframe 을 계속 차단한다("이 콘텐츠는 차단되어 있습니다").
        // no-store 로 항상 최신 헤더를 받게 한다. (정적 자원 /_next/* 는 제외)
        source: "/",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
