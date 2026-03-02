import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f6f3ea",
        ink: "#1f2a2e",
        coral: "#e86d4f",
        teal: "#1e6f77",
        sand: "#d7c7a2"
      },
      boxShadow: {
        soft: "0 16px 40px rgba(31, 42, 46, 0.14)"
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.65), transparent 45%), radial-gradient(circle at 80% 0%, rgba(232,109,79,0.18), transparent 35%), radial-gradient(circle at 15% 90%, rgba(30,111,119,0.22), transparent 40%)"
      }
    }
  },
  plugins: []
};

export default config;
