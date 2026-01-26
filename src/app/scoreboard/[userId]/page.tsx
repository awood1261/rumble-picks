"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { EntrantCard } from "../../../components/EntrantCard";
import { scoringRules } from "../../../lib/scoringRules";

type RumblePick = {
  entrants: string[];
  final_four: string[];
  winner: string | null;
  entry_1: string | null;
  entry_2: string | null;
  entry_30: string | null;
  most_eliminations: string | null;
};

type PicksPayload = {
  rumbles: Record<string, RumblePick>;
  match_picks?: Record<string, string | null>;
  match_finish_picks?: Record<
    string,
    { method: string | null; winner: string | null; loser: string | null }
  >;
};

type EntrantRow = {
  id: string;
  name: string;
  promotion: string | null;
  image_url: string | null;
};

type EventRow = {
  id: string;
  name: string;
  show_id: string | null;
  rumble_gender: string | null;
};

type ShowRow = {
  id: string;
  name: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type RumbleEntryRow = {
  event_id: string;
  entrant_id: string;
  entry_number: number | null;
  eliminated_at: string | null;
  eliminations_count: number;
};

type MatchRow = {
  id: string;
  name: string;
  kind: string;
  winner_entrant_id: string | null;
  winner_side_id: string | null;
  finish_method: string | null;
  finish_winner_entrant_id: string | null;
  finish_loser_entrant_id: string | null;
};

type MatchSideRow = {
  id: string;
  match_id: string;
  label: string | null;
};

type MatchEntrantRow = {
  match_id: string;
  entrant_id: string;
  side_id: string | null;
};

const PICKS_POLL_INTERVAL_MS = 15000;

const emptyRumblePick: RumblePick = {
  entrants: [],
  final_four: [],
  winner: null,
  entry_1: null,
  entry_2: null,
  entry_30: null,
  most_eliminations: null,
};

const emptyActuals = {
  entrantSet: new Set<string>(),
  finalFourSet: new Set<string>(),
  winner: null,
  entry1: null,
  entry2: null,
  entry30: null,
  topElims: new Set<string>(),
  hasData: false,
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
  const showId = searchParams.get("show");
  const validShowId =
    showId && showId !== "undefined" && showId !== "null" ? showId : null;

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<PicksPayload | null>(null);
  const [entrants, setEntrants] = useState<EntrantRow[]>([]);
  const [rumbleEntries, setRumbleEntries] = useState<RumbleEntryRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [matchSides, setMatchSides] = useState<MatchSideRow[]>([]);
  const [matchEntrants, setMatchEntrants] = useState<MatchEntrantRow[]>([]);
  const [show, setShow] = useState<ShowRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const entrantMap = useMemo(() => {
    return new Map(entrants.map((entrant) => [entrant.id, entrant]));
  }, [entrants]);

  const matchSidesByMatch = useMemo(() => {
    return matchSides.reduce((map, side) => {
      if (!map[side.match_id]) {
        map[side.match_id] = [];
      }
      map[side.match_id].push(side);
      return map;
    }, {} as Record<string, MatchSideRow[]>);
  }, [matchSides]);

  const matchEntrantsByMatch = useMemo(() => {
    return matchEntrants.reduce((map, row) => {
      if (!map[row.match_id]) {
        map[row.match_id] = [];
      }
      map[row.match_id].push(row);
      return map;
    }, {} as Record<string, MatchEntrantRow[]>);
  }, [matchEntrants]);

  const matchWinnerMap = useMemo(() => {
    return new Map(matches.map((match) => [match.id, match.winner_side_id]));
  }, [matches]);

  const getEliminationKey = (entry: RumbleEntryRow) =>
    entry.eliminated_at ? new Date(entry.eliminated_at).getTime() : Number.MAX_SAFE_INTEGER;

  const actualsByEvent = useMemo(() => {
    const byEvent: Record<
      string,
      {
        entrantSet: Set<string>;
        finalFourSet: Set<string>;
        winner: string | null;
        entry1: string | null;
        entry2: string | null;
        entry30: string | null;
        topElims: Set<string>;
        hasData: boolean;
      }
    > = {};
    events.forEach((event) => {
      const eventEntries = rumbleEntries.filter(
        (entry) => entry.event_id === event.id
      );
      const entrantSet = new Set(eventEntries.map((entry) => entry.entrant_id));
      const finalFour = [...eventEntries]
        .sort((a, b) => getEliminationKey(b) - getEliminationKey(a))
        .slice(0, 4)
        .map((entry) => entry.entrant_id);
      const winners = eventEntries.filter((entry) => !entry.eliminated_at);
      const winner =
        eventEntries.length >= 30 && winners.length === 1
          ? winners[0].entrant_id
          : null;
      const entry1 =
        eventEntries.find((entry) => entry.entry_number === 1)?.entrant_id ??
        null;
      const entry2 =
        eventEntries.find((entry) => entry.entry_number === 2)?.entrant_id ??
        null;
      const entry30 =
        eventEntries.find((entry) => entry.entry_number === 30)?.entrant_id ??
        null;
      const maxElims = eventEntries.reduce(
        (max, entry) => Math.max(max, entry.eliminations_count ?? 0),
        0
      );
      const topElims = new Set(
        eventEntries
          .filter((entry) => entry.eliminations_count === maxElims)
          .map((entry) => entry.entrant_id)
      );

      byEvent[event.id] = {
        entrantSet,
        finalFourSet: new Set(finalFour),
        winner,
        entry1,
        entry2,
        entry30,
        topElims,
        hasData: eventEntries.length > 0,
      };
    });

    return byEvent;
  }, [events, rumbleEntries]);

  const load = useCallback(async () => {
    if (!validShowId) {
      setMessage("Missing show id.");
      setLoading(false);
      return;
    }
    const [
      { data: pickRow, error: pickError },
      { data: showRow },
      { data: eventRows },
      { data: profileRow },
      { data: matchRows, error: matchError },
    ] = await Promise.all([
      supabase
        .from("picks")
        .select("payload")
        .eq("show_id", validShowId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("shows")
        .select("id, name")
        .eq("id", validShowId)
        .maybeSingle(),
      supabase
        .from("events")
        .select("id, name, show_id, rumble_gender")
        .eq("show_id", validShowId),
      supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("matches")
        .select(
          "id, name, kind, winner_entrant_id, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id"
        )
        .eq("show_id", validShowId)
        .order("created_at", { ascending: true }),
    ]);

    if (pickError) {
      setMessage(pickError.message);
      setLoading(false);
      return;
    }

    const eventList = (eventRows ?? []) as EventRow[];
    setPayload((pickRow?.payload as PicksPayload) ?? null);
    setShow(showRow ?? null);
    setEvents(eventList);
    setProfile(profileRow ?? null);

    if (eventList.length === 0) {
      setRumbleEntries([]);
    } else {
      const eventIds = eventList.map((event) => event.id);
      const { data: entryRows, error: entryError } = await supabase
        .from("rumble_entries")
        .select("event_id, entrant_id, entry_number, eliminated_at, eliminations_count")
        .in("event_id", eventIds);
      if (entryError) {
        setMessage(entryError.message);
        setLoading(false);
        return;
      }
      setRumbleEntries((entryRows ?? []) as RumbleEntryRow[]);
    }
    const matchList = (matchRows ?? []) as MatchRow[];
    setMatches(matchList);

    if (matchError) {
      setMessage(matchError.message);
      setLoading(false);
      return;
    }

    if (matchList.length > 0) {
      const matchIds = matchList.map((match) => match.id);
      const [
        { data: matchSideRows, error: matchSideError },
        { data: matchEntrantRows, error: matchEntrantError },
      ] = await Promise.all([
        supabase
          .from("match_sides")
          .select("id, match_id, label")
          .in("match_id", matchIds),
        supabase
          .from("match_entrants")
          .select("match_id, entrant_id, side_id")
          .in("match_id", matchIds),
      ]);
      if (matchSideError) {
        setMessage(matchSideError.message);
        setLoading(false);
        return;
      }
      if (matchEntrantError) {
        setMessage(matchEntrantError.message);
        setLoading(false);
        return;
      }
      setMatchSides((matchSideRows ?? []) as MatchSideRow[]);
      setMatchEntrants((matchEntrantRows ?? []) as MatchEntrantRow[]);
    } else {
      setMatchSides([]);
      setMatchEntrants([]);
    }

    const matchFinishIds = Object.values(
      pickRow?.payload?.match_finish_picks ?? {}
    )
      .flatMap((pick) => [pick?.winner, pick?.loser])
      .filter(Boolean);
    const rumblePickIds = Object.values(pickRow?.payload?.rumbles ?? {}).flatMap(
      (rumble) => [
        ...(rumble?.entrants ?? []),
        ...(rumble?.final_four ?? []),
        rumble?.winner,
        rumble?.entry_1,
        rumble?.entry_2,
        rumble?.entry_30,
        rumble?.most_eliminations,
      ]
    );
    const ids = [...rumblePickIds, ...matchFinishIds]
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
      .select("id, name, promotion, image_url")
      .in("id", uniqueIds);

    if (entrantError) {
      setMessage(entrantError.message);
      setLoading(false);
      return;
    }

    setEntrants(entrantRows ?? []);
    setLoading(false);
  }, [validShowId, userId]);

  useEffect(() => {
    load();

    if (!validShowId) {
      return;
    }

    const interval = setInterval(() => {
      load();
    }, PICKS_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [load, validShowId]);

  const renderList = (
    ids: string[] | undefined,
    correctSet: Set<string>,
    points: number,
    actualsHasData: boolean
  ) => {
    if (!ids || ids.length === 0) {
      return <p className="text-sm text-zinc-400">None selected.</p>;
    }
    return (
      <ul className="mt-4 space-y-2 text-sm text-zinc-200">
        {ids.map((id) => {
          const entrant = entrantMap.get(id);
          const isCorrect = actualsHasData && correctSet.has(id);
          return (
            <li
              key={id}
              className={`rounded-xl border px-3 py-2 ${
                !actualsHasData
                  ? "border-zinc-800"
                  : isCorrect
                    ? "border-emerald-400/60 bg-emerald-400/10"
                    : "border-red-500/50 bg-red-500/10"
              }`}
            >
              <EntrantCard
                name={entrant?.name ?? "Unknown"}
                promotion={entrant?.promotion}
                imageUrl={entrant?.image_url}
              />
              {actualsHasData && (
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
            href={validShowId ? `/scoreboard?show=${validShowId}` : "/scoreboard"}
          >
            ← Back to scoreboard
          </Link>
          <h1 className="text-3xl font-semibold">
            {profile?.display_name ?? "Rumble Fan"}
          </h1>
          <p className="text-sm text-zinc-400">
            {show?.name ?? "Show"}
          </p>
        </header>

        {events.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-sm text-zinc-400">No rumble events found.</p>
          </section>
        ) : (
          events.map((event) => {
            const rumblePick = payload.rumbles?.[event.id] ?? emptyRumblePick;
            const actuals = actualsByEvent[event.id] ?? emptyActuals;
            return (
              <section key={event.id} className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
                    {event.rumble_gender ? `${event.rumble_gender} rumble` : "Rumble"}
                  </p>
                  <h2 className="text-lg font-semibold">{event.name}</h2>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <h3 className="text-lg font-semibold">Entrants</h3>
                    <p className="mt-2 text-sm text-zinc-400">
                      {rumblePick.entrants.length} selected
                    </p>
                    {renderList(
                      rumblePick.entrants,
                      actuals.entrantSet,
                      scoringRules.entrants,
                      actuals.hasData
                    )}
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <h3 className="text-lg font-semibold">Final Four</h3>
                    <p className="mt-2 text-sm text-zinc-400">
                      {rumblePick.final_four.length} selected
                    </p>
                    {renderList(
                      rumblePick.final_four,
                      actuals.finalFourSet,
                      scoringRules.final_four,
                      actuals.hasData
                    )}
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <h3 className="text-lg font-semibold">Key Picks</h3>
                    <div className="mt-4 space-y-3 text-sm text-zinc-200">
                      {[
                        ["Winner", rumblePick.winner, actuals.winner, scoringRules.winner],
                        ["Entry #1", rumblePick.entry_1, actuals.entry1, scoringRules.entry_1],
                        ["Entry #2", rumblePick.entry_2, actuals.entry2, scoringRules.entry_2],
                        ["Entry #30", rumblePick.entry_30, actuals.entry30, scoringRules.entry_30],
                        [
                          "Most eliminations",
                          rumblePick.most_eliminations,
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
                </div>
              </section>
            );
          })
        )}

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold">Match Picks</h2>
          {matches.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No matches available.</p>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-zinc-200">
              {matches.map((match) => {
                const pick = payload.match_picks?.[match.id] ?? null;
                const winner = matchWinnerMap.get(match.id) ?? null;
                const sides = matchSidesByMatch[match.id] ?? [];
                const pickSide = pick
                  ? sides.find((side) => side.id === pick)
                  : null;
                const pickLabel = pickSide?.label?.trim() || "Selected side";
                const pickEntrants = pick
                  ? (matchEntrantsByMatch[match.id] ?? [])
                      .filter((row) => row.side_id === pick)
                      .map((row) => entrantMap.get(row.entrant_id))
                      .filter(Boolean)
                  : [];
                const entrantCount = (matchEntrantsByMatch[match.id] ?? []).length;
                const finishPick = payload.match_finish_picks?.[match.id];
                const finishMethod = finishPick?.method ?? null;
                const finishWinner = finishPick?.winner
                  ? entrantMap.get(finishPick.winner)
                  : null;
                const finishLoser = finishPick?.loser
                  ? entrantMap.get(finishPick.loser)
                  : null;
                const finishMethodCorrect =
                  match.finish_method && finishMethod
                    ? match.finish_method === finishMethod
                    : false;
                const finishWinnerCorrect =
                  match.finish_winner_entrant_id && finishPick?.winner
                    ? match.finish_winner_entrant_id === finishPick.winner
                    : false;
                const finishLoserCorrect =
                  match.finish_loser_entrant_id && finishPick?.loser
                    ? match.finish_loser_entrant_id === finishPick.loser
                    : false;
                const isCorrect = winner && pick ? winner === pick : false;
                return (
                  <div
                    key={match.id}
                    className={`rounded-xl border px-3 py-2 ${
                      !winner
                        ? "border-zinc-800"
                        : isCorrect
                          ? "border-emerald-400/60 bg-emerald-400/10"
                          : "border-red-500/50 bg-red-500/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                          {match.kind}
                        </p>
                        <p className="text-sm font-semibold text-zinc-100">
                          {match.name}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-right">
                        <span className="text-xs font-semibold text-zinc-200">
                          {pick ? pickLabel : "Not set"}
                        </span>
                        {pickEntrants.length > 0 && (
                          <span className="text-xs text-zinc-500">
                            {pickEntrants
                              .map((entrant) => entrant?.name)
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        )}
                      </div>
                      {winner && (
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide ${
                            isCorrect ? "text-emerald-200" : "text-red-200"
                          }`}
                        >
                          {isCorrect ? `+${scoringRules.match_winner} pts` : "0 pts"}
                        </span>
                      )}
                    </div>
                    {entrantCount > 2 && (
                      <div className="mt-3 space-y-2 text-xs text-zinc-400">
                        <div className="flex items-center justify-between">
                          <span>Finish</span>
                          <span
                            className={
                              !match.finish_method
                                ? "text-zinc-500"
                                : finishMethodCorrect
                                  ? "text-emerald-200"
                                  : "text-red-200"
                            }
                          >
                            {finishMethod ?? "Not set"}
                            {match.finish_method
                              ? ` • ${
                                  finishMethodCorrect
                                    ? `+${scoringRules.match_finish_method}`
                                    : "0"
                                } pts`
                              : ""}
                          </span>
                        </div>
                        {(finishMethod === "pinfall" ||
                          finishMethod === "submission") && (
                          <>
                            <div className="flex items-center justify-between">
                              <span>Winner</span>
                              <span
                                className={
                                  match.finish_winner_entrant_id
                                    ? finishWinnerCorrect
                                      ? "text-emerald-200"
                                      : "text-red-200"
                                    : "text-zinc-500"
                                }
                              >
                                {finishWinner?.name ?? "Not set"}
                                {match.finish_winner_entrant_id
                                  ? ` • ${
                                      finishWinnerCorrect
                                        ? `+${scoringRules.match_finish_winner}`
                                        : "0"
                                    } pts`
                                  : ""}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Loser</span>
                              <span
                                className={
                                  match.finish_loser_entrant_id
                                    ? finishLoserCorrect
                                      ? "text-emerald-200"
                                      : "text-red-200"
                                    : "text-zinc-500"
                                }
                              >
                                {finishLoser?.name ?? "Not set"}
                                {match.finish_loser_entrant_id
                                  ? ` • ${
                                      finishLoserCorrect
                                        ? `+${scoringRules.match_finish_loser}`
                                        : "0"
                                    } pts`
                                  : ""}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
