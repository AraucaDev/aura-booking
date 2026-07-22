import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aura: {
          cream: "#FCF7F0",
          sand: "#EDD6AA",
          terracota: "#C39776",
          brown: "#7A4A1E",
        },
      },
      fontFamily: {
        display: ["var(--font-cormorant)", "Cormorant Garamond", "serif"],
        body: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 24px rgba(122, 74, 30, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
