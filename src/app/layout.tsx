import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { THEME_BOOT_SCRIPT } from "@/hooks/useTheme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JSIL·ASTRAL | Jindal Drilling",
  description:
    "JSIL·ASTRAL — Fleet Operations & Rig Governance Engine for Jindal Drilling & Industries Ltd.",
  applicationName: "JSIL·ASTRAL",
  authors: [{ name: "Jindal Drilling & Industries Ltd." }],
  keywords: [
    "Jindal Drilling",
    "Fleet Operations",
    "Offshore Rig Management",
    "Procurement",
    "Purchase Orders",
    "Rig Governance",
  ],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0D1B2A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-brand-bg text-brand-text antialiased">
        {children}
      </body>
    </html>
  );
}
