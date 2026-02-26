"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { APP_BASE_URL } from "../../lib/appConfig";
import {
  AVATAR_OPTIONS,
  DEFAULT_AVATAR_KEY,
} from "../../lib/avatarOptions";
import { containsProfanity } from "../../lib/profanityFilter";

type AuthMode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showId = searchParams.get("show");
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarKey, setAvatarKey] = useState(DEFAULT_AVATAR_KEY);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [requiresEmailRegistration, setRequiresEmailRegistration] =
    useState(true);
  const [showName, setShowName] = useState<string | null>(null);
  const [showPromotionLogo, setShowPromotionLogo] = useState<string | null>(null);
  const [showPromotionName, setShowPromotionName] = useState<string | null>(null);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  useEffect(() => {
    let ignore = false;
    const loadShow = async () => {
      if (!showId) {
        setRequiresEmailRegistration(true);
        setShowName(null);
        return;
      }
      const { data, error } = await supabase
        .from("shows")
        .select("id, name, requires_email_registration, promotion_id")
        .eq("id", showId)
        .maybeSingle();
      if (ignore) return;
      if (error || !data) {
        setRequiresEmailRegistration(true);
        setShowName(null);
        setShowPromotionLogo(null);
        setShowPromotionName(null);
        return;
      }
      setRequiresEmailRegistration(data.requires_email_registration ?? true);
      setShowName(data.name ?? null);
      if (data.promotion_id) {
        const { data: promotionRow, error: promotionError } = await supabase
          .from("promotions")
          .select("id, name, image_url")
          .eq("id", data.promotion_id)
          .maybeSingle();
        if (ignore) return;
        if (!promotionError && promotionRow) {
          setShowPromotionLogo(promotionRow.image_url ?? null);
          setShowPromotionName(promotionRow.name ?? null);
        } else {
          setShowPromotionLogo(null);
          setShowPromotionName(null);
        }
      } else {
        setShowPromotionLogo(null);
        setShowPromotionName(null);
      }
      setMode("sign-up");
    };
    loadShow();
    return () => {
      ignore = true;
    };
  }, [showId]);

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!ignore) {
        const session = data.session;
        const email = session?.user.email ?? null;
        setSessionEmail(email);
        if (session?.user) {
          router.push(showId ? `/picks?show=${showId}` : "/picks");
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user.email ?? null;
      setSessionEmail(email);
      if (session?.user) {
        router.push(showId ? `/picks?show=${showId}` : "/picks");
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, [router, showId]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setBusy(true);

    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setMessage("Signed in. Welcome back!");
      } else {
        const trimmed = displayName.trim();
        if (!trimmed) {
          setMessage("Username is required.");
          setBusy(false);
          return;
        }
        if (containsProfanity(trimmed)) {
          setMessage("Please choose a different username.");
          setBusy(false);
          return;
        }
        if (requiresEmailRegistration) {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: APP_BASE_URL,
              data: {
                display_name: trimmed,
                avatar_key: avatarKey,
                marketing_opt_in: marketingOptIn,
              },
            },
          });
          if (error) throw error;
          setMessage("Check your inbox to confirm your account.");
        } else {
          const { error } = await supabase.auth.signInAnonymously({
            options: {
              data: {
                display_name: trimmed,
                avatar_key: avatarKey,
                marketing_opt_in: marketingOptIn,
              },
            },
          });
          if (error) throw error;
          setMessage("You’re ready to make picks.");
        }
      }
    } catch (err) {
      const error = err as { message?: string };
      setMessage(error.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    setMessage(null);
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
    }
    setBusy(false);
  };


  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 py-24">
        <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-xl shadow-black/40">
          <h1 className="text-3xl font-semibold tracking-tight">
            {sessionEmail ? "You are signed in" : "Welcome to BoutPick"}
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            {sessionEmail
              ? `Signed in as ${sessionEmail}`
              : "Sign in or create an account to start making picks."}
          </p>
          {showName && !sessionEmail && (
            <div className="mt-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-200">
              {showPromotionLogo ? (
                <img
                  src={showPromotionLogo}
                  alt={showPromotionName ?? "Promotion"}
                  className="h-6 w-6 rounded-full border border-amber-400/40 object-cover"
                />
              ) : null}
              <span>{showName} registration</span>
            </div>
          )}

          {!sessionEmail && (
            <form className="mt-8 space-y-5" onSubmit={onSubmit}>
              {mode === "sign-up" && (
                <div className="space-y-2 text-sm">
                  <label className="block text-zinc-300" htmlFor="displayName">
                    Username
                  </label>
                  <input
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-base text-zinc-100 outline-none transition focus:border-amber-400"
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                  />
                </div>
              )}
              {mode === "sign-up" && (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <label className="block text-zinc-300">
                      Choose an avatar
                    </label>
                    <span className="text-xs text-zinc-500">Required</span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                    {AVATAR_OPTIONS.map((option) => {
                      const isActive = avatarKey === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition ${
                            isActive
                              ? "border-amber-400/70 bg-amber-400/10"
                              : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
                          }`}
                          onClick={() => setAvatarKey(option.key)}
                          aria-pressed={isActive}
                          aria-label={option.label}
                        >
                          <img
                            src={option.src}
                            alt={option.label}
                            className="h-10 w-10"
                            loading="lazy"
                          />
                        </button>
                      );
                    })}
                  </div>
                  <label className="flex items-start gap-3 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
                      checked={marketingOptIn}
                      onChange={(event) => setMarketingOptIn(event.target.checked)}
                    />
                    <span>
                      I want to receive updates about future shows and promotion news.
                    </span>
                  </label>
                </div>
              )}
              {(mode === "sign-in" || requiresEmailRegistration) && (
                <>
                  <div className="space-y-2 text-sm">
                    <label className="block text-zinc-300" htmlFor="email">
                      Email
                    </label>
                    <input
                      className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-base text-zinc-100 outline-none transition focus:border-amber-400"
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required={mode === "sign-in" || requiresEmailRegistration}
                    />
                  </div>
                  <div className="space-y-2 text-sm">
                    <label className="block text-zinc-300" htmlFor="password">
                      Password
                    </label>
                    <input
                      className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-base text-zinc-100 outline-none transition focus:border-amber-400"
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required={mode === "sign-in" || requiresEmailRegistration}
                    />
                  </div>
                </>
              )}

              <button
                className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full bg-amber-400 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={busy}
              >
                {mode === "sign-in"
                  ? "Sign in"
                  : requiresEmailRegistration
                    ? "Create account"
                    : "Continue"}
              </button>
            </form>
          )}

          {sessionEmail && (
            <button
              className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full border border-zinc-700 text-sm font-semibold uppercase tracking-wide text-zinc-100 transition hover:border-amber-400 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              onClick={onSignOut}
              disabled={busy}
            >
              Sign out
            </button>
          )}

          <div className="mt-6 text-center text-sm text-zinc-400">
            {!sessionEmail && (
              <>
                <span>
                  {mode === "sign-in"
                    ? requiresEmailRegistration
                      ? "Need an account?"
                      : "No email required?"
                    : requiresEmailRegistration
                      ? "Already have an account?"
                      : "Have an email account?"}
                </span>
                <button
                  className="ml-2 font-semibold text-amber-300 hover:text-amber-200"
                  type="button"
                  onClick={() =>
                    setMode((current) =>
                      current === "sign-in" ? "sign-up" : "sign-in"
                    )
                  }
                >
                  {mode === "sign-in"
                    ? requiresEmailRegistration
                      ? "Sign up"
                      : "Continue without email"
                    : "Sign in"}
                </button>
              </>
            )}
          </div>

          {message && (
            <p className="mt-4 rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200">
              {message}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
