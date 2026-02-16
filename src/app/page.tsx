import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Home",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center px-6 py-6 sm:py-12 text-center">
        <img
          className="w-52 sm:w-xl"
          src="/images/bp-logo-text-tag.png"
          alt="BoutPick. Make Your Call"
        />
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">
          Card Wide Predictions
        </p>
        <h1 className="mt-6 text-balance text-4xl font-semibold leading-tight sm:text-5xl">
          Make your picks. Crown the champ.
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-lg text-zinc-300">
          Sign in to submit your predictions, watch the scoreboard
          update in real time, and see who has the best eye bell-to-bell.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            className="inline-flex h-12 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300"
            href="/login"
          >
            Sign in to play
          </Link>
          <Link
            className="inline-flex h-12 items-center justify-center rounded-full border border-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
            href="/scoreboard"
          >
            View scoreboard
          </Link>
          <Link
            className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-700 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-200"
            href="/picks"
          >
            Make picks
          </Link>
          <span className="text-sm text-zinc-400">
            No account? You can sign up in seconds.
          </span>
        </div>
        <Link
          className="mt-8 text-xs uppercase tracking-[0.3em] text-zinc-500 transition hover:text-amber-300"
          href="/admin"
        >
          Admin console
        </Link>
      </main>
    </div>
  );
}
