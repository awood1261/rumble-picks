"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export const NavBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let ignore = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!ignore) {
        const userId = data.session?.user.id ?? null;
        setIsSignedIn(Boolean(userId));
        if (userId) {
          supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", userId)
            .maybeSingle()
            .then(({ data: profile }) => {
              setIsAdmin(Boolean(profile?.is_admin));
            });
        } else {
          setIsAdmin(false);
        }
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null;
      setIsSignedIn(Boolean(userId));
      if (userId) {
        supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", userId)
          .maybeSingle()
          .then(({ data: profile }) => {
            setIsAdmin(Boolean(profile?.is_admin));
          });
      } else {
        setIsAdmin(false);
      }
    });
    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const linkClass = (isActive: boolean) =>
    `transition ${
      isActive
        ? "text-amber-200 underline decoration-amber-400/70 underline-offset-4"
        : "hover:text-amber-200"
    }`;

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
          <Link
            className={linkClass(pathname.startsWith("/picks"))}
            href="/picks"
            aria-current={pathname.startsWith("/picks") ? "page" : undefined}
          >
            Picks
          </Link>
          <Link
            className={linkClass(pathname.startsWith("/scoreboard"))}
            href="/scoreboard"
            aria-current={pathname.startsWith("/scoreboard") ? "page" : undefined}
          >
            Scores
          </Link>
          {isAdmin && (
            <Link
              className={linkClass(pathname.startsWith("/admin"))}
              href="/admin"
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
            >
              Admin
            </Link>
          )}
          {isSignedIn ? (
            <button
              className="rounded-full border border-amber-400/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
              type="button"
              onClick={handleSignOut}
            >
              SIGN OUT
            </button>
          ) : (
            <Link
              className="rounded-full border border-amber-400/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
              href="/login"
            >
              SIGN IN
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
};
