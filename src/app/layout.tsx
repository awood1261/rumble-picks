import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavBar } from "../components/NavBar";
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
  title: {
    default: "BoutPick",
    template: "BoutPick: %s",
  },
  description: "BoutPick predictions and live scoreboard.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://boutpick.com"
  ),
  icons: {
    icon: "/images/bp-logo.PNG",
    apple: "/images/bp-logo.PNG",
  },
  openGraph: {
    title: "BoutPick",
    description: "BoutPick predictions and live scoreboard.",
    type: "website",
    images: [
      {
        url: "/images/boutpick-og-image.png",
        width: 1200,
        height: 630,
        alt: "BoutPick",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BoutPick",
    description: "BoutPick predictions and live scoreboard.",
    images: ["/images/boutpick-og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
          <NavBar />
          {children}
        </div>
      </body>
    </html>
  );
}
