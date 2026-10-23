import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { UpdateBanner } from "@/components/update-banner";
import { IS_STAGING, StagingBanner } from "@/components/staging-banner";
import "./globals.css";

// Single typeface across the whole app — Elza (the brand's display font) is
// licensed for the logo/wordmark only, not for in-app typesetting. Inter is
// what the brand guide designates for UI/body text and suits this dense,
// data-heavy dashboard better than a display face would.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: IS_STAGING ? "STAGING · Kausar Group Excellence WebApp" : "Kausar Group Excellence WebApp",
  description: "Internal daie network dashboard for Kausar Group.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0029fc",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ServiceWorkerRegistration />
        <StagingBanner />
        <UpdateBanner />
        {children}
      </body>
    </html>
  );
}
