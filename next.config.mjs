/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // 모든 페이지에서 iframe 임베드 허용 (WEDLY 앱 전용)
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;
