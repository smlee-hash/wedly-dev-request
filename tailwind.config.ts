import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "wedly-navy": "#0A2244",
        "wedly-accent": "#006AFF",
        "wedly-green": "#2B8A3E",
        "wedly-orange": "#E8590C",
        "wedly-red": "#E03131",
        "wedly-gold": "#F59F00",
        "wedly-purple": "#7048E8",
        "wedly-muted": "#868E96",
        "wedly-t1": "#1A1A1A",
        "wedly-t2": "#495057",
        "wedly-bd": "#DEE2E6",
        "bg-blue": "#E7F0FF",
        "bg-green": "#EBFBEE",
        "bg-red": "#FFF0F0",
        "bg-yellow": "#FFF9DB",
        "bg-purple": "#F3F0FF",
        "bg-gray": "#F8F9FA",
      },
      fontFamily: {
        sans: ['"Noto Sans KR"', "sans-serif"],
      },
      letterSpacing: {
        wedly: "-0.02em",
      },
    },
  },
  plugins: [],
};

export default config;
