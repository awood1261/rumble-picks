import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">
          Royal Rumble Picks
        </p>
        <h1 className="mt-6 text-balance text-4xl font-semibold leading-tight sm:text-5xl">
          Make your picks. Track eliminations live. Crown the champ.
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-lg text-zinc-300">
          Sign in to submit your Royal Rumble predictions, watch the scoreboard
          update in real time, and see who nails the final four.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            className="inline-flex h-12 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300"
            href="/login"
          >
            Sign in to play
          </Link>
          <span className="text-sm text-zinc-400">
            No account? You can sign up in seconds.
          </span>
        </div>
      </main>
    </div>
  );
}
