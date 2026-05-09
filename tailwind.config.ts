import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 18px 45px rgba(30, 64, 175, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
