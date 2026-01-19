import Link from "next/link";

export const NavBar = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-900/80 bg-zinc-950/80 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300"
          href="/"
        >
          Rumble Picks
        </Link>
        <div className="flex flex-nowrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-zinc-300">
          <Link className="transition hover:text-amber-200" href="/picks">
            Picks
          </Link>
          <Link className="transition hover:text-amber-200" href="/scoreboard">
            Scores
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
  );
};
