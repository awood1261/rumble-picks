import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
    default: "Rumble Picks",
    template: "Rumble Picks: %s",
  },
  description: "Royal Rumble prediction game and live scoreboard.",
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
          <header className="sticky top-0 z-50 border-b border-zinc-900/80 bg-zinc-950/80 backdrop-blur">
            <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
              <Link
                className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300"
                href="/"
              >
                Rumble Picks
              </Link>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                <Link className="transition hover:text-amber-200" href="/picks">
                  Picks
                </Link>
                <Link
                  className="transition hover:text-amber-200"
                  href="/scoreboard"
                >
                  Scoreboard
                </Link>
                <Link className="transition hover:text-amber-200" href="/admin">
                  Admin
                </Link>
                <Link className="transition hover:text-amber-200" href="/login">
                  Sign In
                </Link>
              </div>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
