"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type AuthMode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!ignore) {
        const email = data.session?.user.email ?? null;
        setSessionEmail(email);
        if (email) {
          router.push("/picks");
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user.email ?? null;
      setSessionEmail(email);
      if (email) {
        router.push("/picks");
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

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
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage("Check your inbox to confirm your account.");
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
            {sessionEmail ? "You are signed in" : "Welcome to Rumble Picks"}
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            {sessionEmail
              ? `Signed in as ${sessionEmail}`
              : "Sign in or create an account to start making picks."}
          </p>

          {!sessionEmail && (
            <form className="mt-8 space-y-5" onSubmit={onSubmit}>
              <div className="space-y-2 text-sm">
                <label className="block text-zinc-300" htmlFor="email">
                  Email
                </label>
                <input
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-zinc-100 outline-none transition focus:border-amber-400"
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 text-sm">
                <label className="block text-zinc-300" htmlFor="password">
                  Password
                </label>
                <input
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-zinc-100 outline-none transition focus:border-amber-400"
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <button
                className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full bg-amber-400 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={busy}
              >
                {mode === "sign-in" ? "Sign in" : "Create account"}
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
                    ? "Need an account?"
                    : "Already have an account?"}
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
                  {mode === "sign-in" ? "Sign up" : "Sign in"}
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
