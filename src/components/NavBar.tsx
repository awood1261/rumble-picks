"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { avatarSrcForKey } from "../lib/avatarOptions";

export const NavBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!ignore) {
        const userId = data.session?.user.id ?? null;
        setIsSignedIn(Boolean(userId));
        if (userId) {
          supabase
            .from("profiles")
            .select("is_admin, avatar_key")
            .eq("id", userId)
            .maybeSingle()
            .then(({ data: profile }) => {
              setIsAdmin(Boolean(profile?.is_admin));
              setAvatarKey(profile?.avatar_key ?? null);
            });
        } else {
          setIsAdmin(false);
          setAvatarKey(null);
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
          .select("is_admin, avatar_key")
          .eq("id", userId)
          .maybeSingle()
          .then(({ data: profile }) => {
            setIsAdmin(Boolean(profile?.is_admin));
            setAvatarKey(profile?.avatar_key ?? null);
          });
      } else {
        setIsAdmin(false);
        setAvatarKey(null);
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
      <nav className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-black/60 text-zinc-200 transition hover:border-amber-400 hover:text-amber-200 md:hidden"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen((prev) => !prev);
            setProfileMenuOpen(false);
          }}
        >
          <span className="text-lg">☰</span>
        </button>
        <Link
          className="absolute left-1/2 flex -translate-x-1/2 items-center md:static md:translate-x-0"
          href="/"
          aria-label="BoutPick"
        >
          <img
            className="h-8 w-auto sm:h-10"
            src="/images/bp-logo-text-only.png"
            alt="BoutPick"
          />
        </Link>
        <div className="flex flex-nowrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-zinc-300">
          <div className="hidden items-center gap-4 md:flex">
            <Link
              className={linkClass(pathname.startsWith("/shows"))}
              href="/shows"
              aria-current={pathname.startsWith("/shows") ? "page" : undefined}
            >
              Shows
            </Link>
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
              aria-current={
                pathname.startsWith("/scoreboard") ? "page" : undefined
              }
            >
              Scores
            </Link>
          </div>
          {!isSignedIn ? (
            <Link
              className="rounded-full border border-amber-400/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
              href="/login"
            >
              SIGN IN
            </Link>
          ) : (
            <div className="relative">
              <button
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-black/60 text-zinc-200 transition hover:border-amber-400 hover:text-amber-200 ${
                  pathname.startsWith("/profile")
                    ? "border-amber-400/70 text-amber-200"
                    : ""
                }`}
                type="button"
                aria-label="Open profile menu"
                aria-expanded={profileMenuOpen}
                onClick={() => {
                  setProfileMenuOpen((prev) => !prev);
                  setMenuOpen(false);
                }}
              >
                <img
                  src={avatarSrcForKey(avatarKey)}
                  alt="Profile avatar"
                  className="h-6 w-6"
                />
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-40 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2 text-xs uppercase tracking-wide text-zinc-200 shadow-xl shadow-black/40">
                  <Link
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 transition hover:bg-zinc-900/80 hover:text-amber-200"
                    href="/profile"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  {isAdmin && (
                    <Link
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 transition hover:bg-zinc-900/80 hover:text-amber-200"
                      href="/admin"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-zinc-900/80 hover:text-amber-200"
                    type="button"
                    onClick={async () => {
                      setProfileMenuOpen(false);
                      await handleSignOut();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
      {menuOpen && (
        <div className="border-t border-zinc-900/80 bg-zinc-950/95 px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-wide text-zinc-300">
            <Link
              className={linkClass(pathname.startsWith("/shows"))}
              href="/shows"
              onClick={() => setMenuOpen(false)}
              aria-current={pathname.startsWith("/shows") ? "page" : undefined}
            >
              Shows
            </Link>
            <Link
              className={linkClass(pathname.startsWith("/picks"))}
              href="/picks"
              onClick={() => setMenuOpen(false)}
              aria-current={pathname.startsWith("/picks") ? "page" : undefined}
            >
              Picks
            </Link>
            <Link
              className={linkClass(pathname.startsWith("/scoreboard"))}
              href="/scoreboard"
              onClick={() => setMenuOpen(false)}
              aria-current={
                pathname.startsWith("/scoreboard") ? "page" : undefined
              }
            >
              Scores
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
