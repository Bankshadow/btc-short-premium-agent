import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PlatformProviders from "@/components/platform/PlatformProviders";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BTC Premium Trading Desk",
  description:
    "Live multi-agent trading desk — bull/bear thesis, derivatives, risk veto, committee verdict. Analysis only.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full text-zinc-100">
        <PlatformProviders>{children}</PlatformProviders>
      </body>
    </html>
  );
}
