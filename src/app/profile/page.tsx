"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.user) {
        router.push("/login");
        return;
      }
      if (ignore) return;
      setEmail(session.user.email ?? null);
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!ignore) {
        setDisplayName(profile?.display_name ?? "");
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [router]);

  const handleUpdate = async () => {
    setMessage(null);
    setBusy(true);
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) {
      setMessage("You need to be signed in to update your username.");
      setBusy(false);
      return;
    }
    const trimmed = displayName.trim();
    if (!trimmed) {
      setMessage("Username cannot be empty.");
      setBusy(false);
      return;
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", userId);
    if (profileError) {
      setMessage(profileError.message);
      setBusy(false);
      return;
    }
    const { error: authError } = await supabase.auth.updateUser({
      data: { display_name: trimmed },
    });
    if (authError) {
      setMessage(authError.message);
      setBusy(false);
      return;
    }
    setMessage("Username updated.");
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 py-24">
        <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-xl shadow-black/40">
          <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-3 text-sm text-zinc-400">
            Update your public username.
          </p>
          {email && (
            <p className="mt-2 text-xs text-zinc-500">Signed in as {email}</p>
          )}

          <div className="mt-8 space-y-3">
            <label className="text-sm text-zinc-300" htmlFor="displayName">
              Username
            </label>
            <input
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-amber-400"
              id="displayName"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-amber-400 text-sm font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              onClick={handleUpdate}
              disabled={busy}
            >
              {busy ? "Saving..." : "Save username"}
            </button>
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
