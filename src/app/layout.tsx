import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const description = "Text it like a person. It calls you, learns what you need, and gets it done.";
export const metadata: Metadata = {
  metadataBase: new URL("https://persona-onboarding-riyad.vercel.app"),
  title: "Persona — meet your assistant",
  description,
  openGraph: {
    title: "Persona — your personal intelligence",
    description,
    url: "/",
    siteName: "Persona",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Persona onboarding in iMessage" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Persona — your personal intelligence", description, images: ["/og.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
