"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { APP_BASE_URL } from "../../lib/appConfig";

export default function QrPage() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(APP_BASE_URL, {
      width: 240,
      margin: 1,
      color: { dark: "#fbbf24", light: "#0a0a0a" },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
        <img
          className="h-16 w-auto sm:h-20"
          src="/images/rumble-picks-logo.png"
          alt="Rumble Picks"
        />
        <h1 className="mt-6 text-3xl font-semibold">Scan to join Rumble Picks</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Share this QR code to open the app on a phone and jump straight into
          the picks.
        </p>
        <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          {qrDataUrl ? (
            <img
              className="h-60 w-60 rounded-2xl border border-zinc-800 bg-zinc-950 p-3"
              src={qrDataUrl}
              alt="Rumble Picks QR code"
            />
          ) : (
            <div className="flex h-60 w-60 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-400">
              {error ? `QR error: ${error}` : "Generating QR code…"}
            </div>
          )}
        </div>
        <p className="mt-4 text-xs uppercase tracking-[0.3em] text-zinc-500">
          {APP_BASE_URL}
        </p>
      </main>
    </div>
  );
}
