import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // Brand-fixed tokens — identical across modes
        brand: {
          green: "#1A7A3C",
          "green-bright": "#22C55E",
          red: "#C8102E",
          success: "#22C55E",
          warning: "#F59E0B",
          danger: "#C8102E",
          info: "#3B82F6",
          // Mode-aware tokens — resolved from CSS vars in globals.css
          bg: "rgb(var(--brand-bg) / <alpha-value>)",
          surface: "rgb(var(--brand-surface) / <alpha-value>)",
          "surface-elevated": "rgb(var(--brand-surface-elevated) / <alpha-value>)",
          border: "rgb(var(--brand-border) / <alpha-value>)",
          text: "rgb(var(--brand-text) / <alpha-value>)",
          muted: "rgb(var(--brand-muted) / <alpha-value>)",
          sidebar: "rgb(var(--sidebar-bg) / <alpha-value>)",
          topbar: "rgb(var(--topbar-bg) / <alpha-value>)",
        },
        background: "rgb(var(--brand-bg) / <alpha-value>)",
        foreground: "rgb(var(--brand-text) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--brand-surface) / <alpha-value>)",
          foreground: "rgb(var(--brand-text) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--brand-surface) / <alpha-value>)",
          foreground: "rgb(var(--brand-text) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "#1A7A3C",
          foreground: "#F5F5F5",
        },
        secondary: {
          DEFAULT: "rgb(var(--brand-surface) / <alpha-value>)",
          foreground: "rgb(var(--brand-text) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--brand-border) / <alpha-value>)",
          foreground: "rgb(var(--brand-muted) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "#C8102E",
          foreground: "#F5F5F5",
        },
        destructive: {
          DEFAULT: "#C8102E",
          foreground: "#F5F5F5",
        },
        border: "rgb(var(--brand-border) / <alpha-value>)",
        input: "rgb(var(--brand-border) / <alpha-value>)",
        ring: "#1A7A3C",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
        "2xl": "1rem",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "brand-glow": "0 0 0 1px rgba(26,122,60,0.35), 0 18px 40px -22px rgba(26,122,60,0.55)",
        "brand-glow-sm": "0 0 0 1px rgba(26,122,60,0.25)",
        "card-hover":
          "0 8px 32px -16px rgba(0,0,0,0.55), 0 0 0 1px rgba(26,122,60,0.25)",
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(at 12% 18%, rgba(26,122,60,0.18) 0px, transparent 55%), radial-gradient(at 88% 12%, rgba(200,16,46,0.10) 0px, transparent 55%), radial-gradient(at 60% 92%, rgba(34,197,94,0.10) 0px, transparent 55%)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out both",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    plugin(({ addVariant }) => {
      // `light:` variant — applies when <html> has class `light`.
      // Pairs symmetrically with Tailwind's built-in `dark:` (class strategy).
      addVariant("light", "html.light &");
    }),
  ],
};

export default config;
