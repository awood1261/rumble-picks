"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import {
  AVATAR_OPTIONS,
  DEFAULT_AVATAR_KEY,
  avatarSrcForKey,
} from "../../lib/avatarOptions";
import { containsProfanity } from "../../lib/profanityFilter";
import type { ChampionProfileClaim } from "../../lib/championTypes";
import posthog from "posthog-js";

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarKey, setAvatarKey] = useState(DEFAULT_AVATAR_KEY);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePassword, setUpgradePassword] = useState("");
  const [upgradeMarketingOptIn, setUpgradeMarketingOptIn] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [championClaims, setChampionClaims] = useState<ChampionProfileClaim[]>([]);

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
        .select("display_name, avatar_key")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!ignore) {
        setDisplayName(profile?.display_name ?? "");
        setAvatarKey(profile?.avatar_key ?? DEFAULT_AVATAR_KEY);
      }

      const response = await fetch("/api/champion/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      const payload = (await response.json()) as {
        error?: string;
        claims?: ChampionProfileClaim[];
      };
      if (!ignore && response.ok) {
        setChampionClaims(payload.claims ?? []);
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
    if (containsProfanity(trimmed)) {
      setMessage("Please choose a different username.");
      setBusy(false);
      return;
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ display_name: trimmed, avatar_key: avatarKey })
      .eq("id", userId);
    if (profileError) {
      setMessage(profileError.message);
      setBusy(false);
      return;
    }
    const { error: authError } = await supabase.auth.updateUser({
      data: { display_name: trimmed, avatar_key: avatarKey },
    });
    if (authError) {
      setMessage(authError.message);
      setBusy(false);
      return;
    }
    posthog.capture("profile_updated", { avatar_key: avatarKey });
    setMessage("Username updated.");
    setBusy(false);
  };

  const handleUpgrade = async () => {
    setMessage(null);
    setUpgradeBusy(true);
    if (!upgradeEmail.trim() || !upgradePassword.trim()) {
      setMessage("Email and password are required.");
      setUpgradeBusy(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({
      email: upgradeEmail.trim(),
      password: upgradePassword,
      data: {
        marketing_opt_in: upgradeMarketingOptIn,
      },
    });
    if (error) {
      setMessage(error.message);
      setUpgradeBusy(false);
      return;
    }
    posthog.capture("account_upgraded", { marketing_opt_in: upgradeMarketingOptIn });
    setMessage("Check your inbox to confirm your email.");
    setUpgradeBusy(false);
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

          {championClaims.length > 0 ? (
            <section className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-amber-300">
                    Championship History
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    This profile has claimed champion recognition.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-amber-400/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200">
                  Champion
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {championClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 py-3"
                  >
                    {claim.promotion_image_url ? (
                      <Image
                        src={claim.promotion_image_url}
                        alt={`${claim.promotion_name} logo`}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-xl border border-zinc-800 bg-zinc-900 object-contain p-1"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                        C
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-100">
                        {claim.promotion_name}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {claim.show_name
                          ? `${claim.show_name}${
                              claim.show_starts_at
                                ? ` • ${new Date(claim.show_starts_at).toLocaleDateString()}`
                                : ""
                            }`
                          : "Champion profile"}
                      </p>
                    </div>
                    <Image
                      src={avatarSrcForKey(claim.claimed_avatar)}
                      alt={`${claim.claimed_username} avatar`}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-full border border-zinc-700 bg-zinc-900"
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

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
            <div className="pt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-300">Avatar</label>
                <span className="text-xs text-zinc-500">Pick a look</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5">
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
            </div>
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-amber-400 text-sm font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              onClick={handleUpdate}
              disabled={busy}
            >
              {busy ? "Saving..." : "Save profile"}
            </button>
          </div>

          {!email && (
            <div className="mt-8 border-t border-zinc-800 pt-6">
              <h2 className="text-lg font-semibold text-zinc-100">
                Add email sign-in
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Link an email so you can recover your account on other devices.
              </p>
              <div className="mt-4 space-y-3">
                <div className="space-y-2 text-sm">
                  <label className="block text-zinc-300" htmlFor="upgradeEmail">
                    Email
                  </label>
                  <input
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-amber-400"
                    id="upgradeEmail"
                    type="email"
                    value={upgradeEmail}
                    onChange={(event) => setUpgradeEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2 text-sm">
                  <label
                    className="block text-zinc-300"
                    htmlFor="upgradePassword"
                  >
                    Password
                  </label>
                  <input
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-amber-400"
                    id="upgradePassword"
                    type="password"
                    value={upgradePassword}
                    onChange={(event) => setUpgradePassword(event.target.value)}
                  />
                </div>
                <label className="flex items-start gap-3 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
                    checked={upgradeMarketingOptIn}
                    onChange={(event) =>
                      setUpgradeMarketingOptIn(event.target.checked)
                    }
                  />
                  <span>
                    I want to receive updates about future shows and promotion news.
                  </span>
                </label>
                <button
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-amber-400 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                  type="button"
                  onClick={handleUpgrade}
                  disabled={upgradeBusy}
                >
                  {upgradeBusy ? "Updating..." : "Add email"}
                </button>
              </div>
            </div>
          )}

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
