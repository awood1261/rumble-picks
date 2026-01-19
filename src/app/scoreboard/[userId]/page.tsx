"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { EntrantCard } from "../../../components/EntrantCard";
import { scoringRules } from "../../../lib/scoringRules";

type PicksPayload = {
  entrants?: string[];
  final_four?: string[];
  winner?: string | null;
  entry_1?: string | null;
  entry_2?: string | null;
  entry_30?: string | null;
  most_eliminations?: string | null;
};

type EntrantRow = {
  id: string;
  name: string;
  promotion: string | null;
};

type EventRow = {
  id: string;
  name: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type RumbleEntryRow = {
  entrant_id: string;
  entry_number: number | null;
  eliminated_at: string | null;
  eliminations_count: number;
};

export default function ScoreboardPicksPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawUserId = params.userId;
  const userId =
    typeof rawUserId === "string"
      ? rawUserId
      : Array.isArray(rawUserId)
        ? rawUserId[0] ?? ""
        : "";
  const eventId = searchParams.get("event");
  const validEventId =
    eventId && eventId !== "undefined" && eventId !== "null" ? eventId : null;

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<PicksPayload | null>(null);
  const [entrants, setEntrants] = useState<EntrantRow[]>([]);
  const [rumbleEntries, setRumbleEntries] = useState<RumbleEntryRow[]>([]);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const entrantMap = useMemo(() => {
    return new Map(entrants.map((entrant) => [entrant.id, entrant]));
  }, [entrants]);

  const getEliminationKey = (entry: RumbleEntryRow) =>
    entry.eliminated_at ? new Date(entry.eliminated_at).getTime() : Number.MAX_SAFE_INTEGER;

  const actuals = useMemo(() => {
    const entrantSet = new Set(rumbleEntries.map((entry) => entry.entrant_id));
    const finalFour = [...rumbleEntries]
      .sort((a, b) => getEliminationKey(b) - getEliminationKey(a))
      .slice(0, 4)
      .map((entry) => entry.entrant_id);
    const winners = rumbleEntries.filter((entry) => !entry.eliminated_at);
    const winner = winners.length === 1 ? winners[0].entrant_id : null;
    const entry1 = rumbleEntries.find((entry) => entry.entry_number === 1)?.entrant_id ?? null;
    const entry2 = rumbleEntries.find((entry) => entry.entry_number === 2)?.entrant_id ?? null;
    const entry30 = rumbleEntries.find((entry) => entry.entry_number === 30)?.entrant_id ?? null;
    const maxElims = rumbleEntries.reduce(
      (max, entry) => Math.max(max, entry.eliminations_count ?? 0),
      0
    );
    const topElims = new Set(
      rumbleEntries
        .filter((entry) => entry.eliminations_count === maxElims)
        .map((entry) => entry.entrant_id)
    );

    return {
      entrantSet,
      finalFourSet: new Set(finalFour),
      winner,
      entry1,
      entry2,
      entry30,
      topElims,
      hasData: rumbleEntries.length > 0,
    };
  }, [rumbleEntries]);

  useEffect(() => {
    if (!validEventId) {
      setMessage("Missing event id.");
      setLoading(false);
      return;
    }

    const load = async () => {
      const [
        { data: pickRow, error: pickError },
        { data: eventRow },
        { data: profileRow },
        { data: entryRows, error: entryError },
      ] =
        await Promise.all([
          supabase
            .from("picks")
            .select("payload")
            .eq("event_id", validEventId)
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("events")
            .select("id, name")
            .eq("id", validEventId)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("id, display_name")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("rumble_entries")
            .select("entrant_id, entry_number, eliminated_at, eliminations_count")
            .eq("event_id", validEventId),
        ]);

      if (pickError) {
        setMessage(pickError.message);
        setLoading(false);
        return;
      }

      setPayload((pickRow?.payload as PicksPayload) ?? null);
      setEvent(eventRow ?? null);
      setProfile(profileRow ?? null);
      setRumbleEntries(entryRows ?? []);

      const ids = [
        ...(pickRow?.payload?.entrants ?? []),
        ...(pickRow?.payload?.final_four ?? []),
        pickRow?.payload?.winner,
        pickRow?.payload?.entry_1,
        pickRow?.payload?.entry_2,
        pickRow?.payload?.entry_30,
        pickRow?.payload?.most_eliminations,
      ]
        .filter(Boolean)
        .map(String);

      const uniqueIds = Array.from(new Set(ids));
      if (uniqueIds.length === 0) {
        setEntrants([]);
        setLoading(false);
        return;
      }

      const { data: entrantRows, error: entrantError } = await supabase
        .from("entrants")
        .select("id, name, promotion")
        .in("id", uniqueIds);

      if (entrantError) {
        setMessage(entrantError.message);
        setLoading(false);
        return;
      }

      if (entryError) {
        setMessage(entryError.message);
        setLoading(false);
        return;
      }

      setEntrants(entrantRows ?? []);
      setLoading(false);
    };

    load();
  }, [validEventId, userId]);

  const renderList = (
    ids: string[] | undefined,
    correctSet: Set<string>,
    points: number
  ) => {
    if (!ids || ids.length === 0) {
      return <p className="text-sm text-zinc-400">None selected.</p>;
    }
    return (
      <ul className="mt-4 space-y-2 text-sm text-zinc-200">
        {ids.map((id) => {
          const entrant = entrantMap.get(id);
          const isCorrect = actuals.hasData && correctSet.has(id);
          return (
            <li
              key={id}
              className={`rounded-xl border px-3 py-2 ${
                !actuals.hasData
                  ? "border-zinc-800"
                  : isCorrect
                    ? "border-emerald-400/60 bg-emerald-400/10"
                    : "border-red-500/50 bg-red-500/10"
              }`}
            >
              <EntrantCard
                name={entrant?.name ?? "Unknown"}
                promotion={entrant?.promotion}
              />
              {actuals.hasData && (
                <p
                  className={`mt-2 text-[10px] font-semibold uppercase tracking-wide ${
                    isCorrect ? "text-emerald-200" : "text-red-200"
                  }`}
                >
                  {isCorrect ? `+${points} pts` : "0 pts"}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
          <p>Loading picks…</p>
        </main>
      </div>
    );
  }

  if (message) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 text-center">
          <p>{message}</p>
        </main>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 text-center">
          <p>No picks found for this user.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Picks
          </p>
          <Link
            className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200 hover:text-amber-100"
            href={validEventId ? `/scoreboard?event=${validEventId}` : "/scoreboard"}
          >
            ← Back to scoreboard
          </Link>
          <h1 className="text-3xl font-semibold">
            {profile?.display_name ?? "Rumble Fan"}
          </h1>
          <p className="text-sm text-zinc-400">
            {event?.name ?? "Event"}
          </p>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-semibold">Entrants</h2>
            <p className="mt-2 text-sm text-zinc-400">
              {payload.entrants?.length ?? 0} selected
            </p>
            {renderList(payload.entrants, actuals.entrantSet, scoringRules.entrants)}
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-semibold">Final Four</h2>
            <p className="mt-2 text-sm text-zinc-400">
              {payload.final_four?.length ?? 0} selected
            </p>
            {renderList(payload.final_four, actuals.finalFourSet, scoringRules.final_four)}
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-semibold">Key Picks</h2>
            <div className="mt-4 space-y-3 text-sm text-zinc-200">
              {[
                ["Winner", payload.winner, actuals.winner, scoringRules.winner],
                ["Entry #1", payload.entry_1, actuals.entry1, scoringRules.entry_1],
                ["Entry #2", payload.entry_2, actuals.entry2, scoringRules.entry_2],
                ["Entry #30", payload.entry_30, actuals.entry30, scoringRules.entry_30],
                [
                  "Most eliminations",
                  payload.most_eliminations,
                  null,
                  scoringRules.most_eliminations,
                ],
              ].map(([label, value, actual, points]) => {
                const entrant = value ? entrantMap.get(String(value)) : null;
                const isCorrect =
                  actuals.hasData &&
                  (label === "Most eliminations"
                    ? value && actuals.topElims.has(String(value))
                    : value && actual === value);
                return (
                  <div
                    key={label}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                      !actuals.hasData
                        ? "border-zinc-800"
                        : isCorrect
                          ? "border-emerald-400/60 bg-emerald-400/10"
                          : "border-red-500/50 bg-red-500/10"
                    }`}
                  >
                    <span className="text-zinc-400">{label}</span>
                    <EntrantCard
                      name={entrant?.name ?? "Not set"}
                      promotion={entrant?.promotion}
                      className="justify-end"
                    />
                    {actuals.hasData && (
                      <span
                        className={`ml-3 text-[10px] font-semibold uppercase tracking-wide ${
                          isCorrect ? "text-emerald-200" : "text-red-200"
                        }`}
                      >
                        {isCorrect ? `+${points} pts` : "0 pts"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
