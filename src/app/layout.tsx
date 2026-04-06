import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MedIPTV - IPTV Player",
  description: "Modern IPTV player with HLS.js, Video.js, and HTML5 player support. Watch live TV, VOD, and series from M3U and Xtream playlists.",
  keywords: ["IPTV", "IPTVnator", "MedIPTV", "HLS", "M3U", "Xtream", "Live TV", "VOD", "Video Player"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-white`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
