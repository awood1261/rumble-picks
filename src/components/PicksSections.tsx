"use client";

import {
  type Dispatch,
  type Ref,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { EntrantCard } from "./EntrantCard";
import { scoringRules } from "../lib/scoringRules";
import { getKeyPickFields } from "../lib/picksCopy";
import type {
  EditSection,
  EntrantRow,
  EventActuals,
  EventRow,
  EliminatorEntryRow,
  EliminatorRow,
  LockInfo,
  MatchEntrantRow,
  MatchRow,
  MatchSideRow,
  PicksPayload,
  RankInfo,
  RumblePick,
  SectionPoints,
  ShowRow,
} from "../lib/picksTypes";

type PicksHeaderProps = {
  title: string;
  subtitle: string;
};

export const PicksHeader = ({ title, subtitle }: PicksHeaderProps) => (
  <header className="flex flex-col gap-1">
    <h1 className="text-lg font-semibold uppercase tracking-[0.2em] text-zinc-200 sm:text-xl">
      {title}
    </h1>
    <p className="text-sm text-zinc-400">{subtitle}</p>
  </header>
);

type LockStatusBannerProps = {
  isLocked: boolean;
  lockInfo: LockInfo;
  rankInfo: RankInfo;
};

export const LockStatusBanner = ({
  isLocked,
  lockInfo,
  rankInfo,
}: LockStatusBannerProps) => (
  <>
    {!isLocked && (
      <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200">
        <p className="font-semibold text-amber-200">{lockInfo.label}</p>
        {lockInfo.detail ? (
          <p className="mt-1 text-xs text-zinc-400">{lockInfo.detail}</p>
        ) : null}
      </div>
    )}
    {isLocked && rankInfo.rank ? (
      <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200">
        <span>
          Your current rank:{" "}
          <span className="font-semibold text-amber-200">
            #{rankInfo.rank}
          </span>{" "}
          of {rankInfo.total}
        </span>
      </div>
    ) : null}
    {isLocked && (
      <div className="mt-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
        Picks are locked for this show.
      </div>
    )}
  </>
);

export const MessageBanner = ({ message }: { message: string | null }) =>
  message ? (
    <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/50 px-4 py-3 text-sm text-zinc-200">
      {message}
    </div>
  ) : null;

type ShowSelectorProps = {
  shows: ShowRow[];
  selectedShowId: string;
  promotionImageUrl?: string | null;
};

export const ShowSelector = ({
  shows,
  selectedShowId,
  promotionImageUrl,
}: ShowSelectorProps) => {
  const selectedShow = shows.find((show) => show.id === selectedShowId) ?? null;

  if (shows.length === 0) {
    return (
      <section className="mt-8">
        <p className="text-sm text-zinc-400">No shows yet.</p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {promotionImageUrl ? (
            <div className="h-12 w-12 min-h-12 min-w-12 shrink-0 aspect-square overflow-hidden rounded-full border border-amber-400/40 bg-black/40">
              <Image
                src={promotionImageUrl}
                alt={selectedShow?.name ?? "Promotion"}
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">
            Current show
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-amber-100">
            {selectedShow?.name ?? "Select a show"}
          </h2>
          </div>
        </div>
      </div>
    </section>
  );
};

type RumbleSummarySectionProps = {
  event: EventRow;
  showName: string | null;
  eventPick: RumblePick;
  actuals: EventActuals;
  points: SectionPoints;
  entrantByIdAll: Map<string, EntrantRow>;
  userId: string | null;
  isLocked: boolean;
  onEdit: (section: Exclude<EditSection, "matches" | null>, eventId: string) => void;
};

export const RumbleSummarySection = ({
  event,
  showName,
  eventPick,
  actuals,
  points,
  entrantByIdAll,
  userId,
  isLocked,
  onEdit,
}: RumbleSummarySectionProps) => {
  const getEntrant = (id: string | null) =>
    id ? entrantByIdAll.get(id) ?? null : null;

  const renderGhostStrip = (
    ids: string[],
    maxVisible = 3,
    className = ""
  ) => {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return null;
    const visible = uniqueIds.slice(0, maxVisible);
    return (
      <div
        className={`pointer-events-none absolute inset-0 z-0 flex items-stretch justify-end -space-x-6 overflow-hidden opacity-60 transition-opacity duration-300 ${className}`}
      >
        {visible.map((id) => {
          const entrant = getEntrant(id);
          const name = entrant?.name ?? "Unknown";
          return (
            <div
              key={id}
              className="relative h-full w-20 overflow-hidden rounded-none border-l border-zinc-800 bg-gradient-to-b from-amber-400/40 via-zinc-900 to-zinc-950 shadow-sm sm:w-28"
              title={name}
            >
              {entrant?.image_url ? (
                <Image
                  src={entrant.image_url}
                  alt={name}
                  fill
                  sizes="112px"
                  className="object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="h-full w-full" />
              )}
            </div>
          );
        })}
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-zinc-950/35 to-zinc-950" />
      </div>
    );
  };

  const renderPickList = (
    ids: string[],
    correctSet: Set<string>,
    pointValue: number,
    actualsHasData: boolean,
    totalEntries?: number,
    confirmedSet?: Set<string>
  ) => {
    if (ids.length === 0) {
      return <p className="text-sm text-zinc-400">None selected.</p>;
    }
    return (
      <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1 text-sm text-zinc-200">
        {ids
          .map((id) => ({
            id,
            entrant: getEntrant(id),
            name: getEntrant(id)?.name ?? "Unknown",
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(({ id, entrant, name }) => {
            const isConfirmed = Boolean(confirmedSet?.has(id));
            const isCorrect = actualsHasData && correctSet.has(id);
            const showMisses =
              actualsHasData && (totalEntries === undefined || totalEntries >= 30);
            const showConfirmed =
              actualsHasData && totalEntries !== undefined && totalEntries >= 30 && isConfirmed;
            const status = entrant?.status ?? "approved";
            const isPending =
              status === "pending" && entrant?.created_by === userId;
            const isApprovedCustom =
              status === "approved" &&
              entrant?.is_custom &&
              entrant?.created_by === userId;
            return (
              <li
                key={id}
                className={`rounded-xl border px-3 py-2 ${
                  !actualsHasData || isConfirmed
                    ? "border-zinc-800"
                    : isCorrect
                      ? "border-emerald-400/60 bg-emerald-400/10"
                      : showMisses
                        ? "border-red-500/50 bg-red-500/10"
                        : "border-zinc-800"
                }`}
              >
                <EntrantCard
                  name={name}
                  promotion={entrant?.promotion}
                  imageUrl={entrant?.image_url}
                />
                {isPending && (
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                    Pending approval
                  </p>
                )}
                {isApprovedCustom && (
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                    Approved
                  </p>
                )}
                {showConfirmed && (
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                    Confirmed entrant
                  </p>
                )}
                {actualsHasData && (isCorrect || showMisses) && !isConfirmed && (
                  <p
                    className={`mt-2 text-[10px] font-semibold uppercase tracking-wide ${
                      isCorrect ? "text-emerald-200" : "text-red-200"
                    }`}
                  >
                    {isCorrect ? `+${pointValue} pts` : "0 pts"}
                  </p>
                )}
              </li>
            );
          })}
      </ul>
    );
  };

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">{event.name}</h2>
      </div>
      <div className="mt-6 rounded-3xl border border-amber-400/20 bg-gradient-to-b from-amber-500/5 via-zinc-900/70 to-zinc-950/90 p-4 sm:p-6">
        <div className="mt-4 grid gap-4">
          <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <details className="group peer">
              <summary className="relative flex cursor-pointer list-none items-center justify-between gap-3 overflow-hidden">
                <div className="relative z-10">
                  <h4 className="text-lg font-semibold">Entrants</h4>
                  <p className="mt-1 text-xs text-zinc-400">
                    {eventPick.entrants.length} selected
                  </p>
                  {points.entrants !== null && (
                    <p className="mt-1 text-[10px] text-emerald-200">
                      Points: {points.entrants}
                    </p>
                  )}
                </div>
                <span className="pointer-events-none absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-zinc-800 bg-black p-2 text-amber-200 shadow-sm transition group-open:rotate-180">
                  <ChevronIcon />
                </span>
              </summary>
              <div className="mt-4">
                <button
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:text-amber-100 disabled:cursor-not-allowed disabled:text-zinc-600"
                  type="button"
                  onClick={() => onEdit("entrants", event.id)}
                  disabled={isLocked}
                >
                  <EditIcon />
                  Edit
                </button>
                <div className="mt-3">
                  {renderPickList(
                    eventPick.entrants,
                    actuals.entrantSet,
                    scoringRules.entrants,
                    actuals.hasData,
                    actuals.totalEntries,
                    actuals.confirmedSet
                  )}
                </div>
              </div>
            </details>
            {renderGhostStrip(eventPick.entrants, 3, "peer-open:hidden")}
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <details className="group peer">
              <summary className="relative flex cursor-pointer list-none items-center justify-between gap-3 overflow-hidden">
                <div className="relative z-10">
                  <h4 className="text-lg font-semibold">Final Four</h4>
                  <p className="mt-1 text-xs text-zinc-400">
                    {eventPick.final_four.length} selected
                  </p>
                  <p className="mt-1 text-[10px] text-emerald-200">
                    Points: {points.finalFour ?? "—"}
                  </p>
                </div>
                <span className="pointer-events-none absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-zinc-800 bg-black p-2 text-amber-200 shadow-sm transition group-open:rotate-180">
                  <ChevronIcon />
                </span>
              </summary>
              <div className="mt-4">
                <button
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:text-amber-100 disabled:cursor-not-allowed disabled:text-zinc-600"
                  type="button"
                  onClick={() => onEdit("final_four", event.id)}
                  disabled={isLocked}
                >
                  <EditIcon />
                  Edit
                </button>
                <div className="mt-3">
                  {renderPickList(
                    eventPick.final_four,
                    actuals.finalFourSet,
                    scoringRules.final_four,
                    actuals.finalFourReady
                  )}
                </div>
              </div>
            </details>
            {renderGhostStrip(eventPick.final_four, 3, "peer-open:hidden")}
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <details className="group peer">
              <summary className="relative flex cursor-pointer list-none items-center justify-between gap-3 overflow-hidden">
                <div className="relative z-10">
                  <h4 className="text-lg font-semibold">Key Picks</h4>
                  <p className="mt-1 text-xs text-zinc-400">
                    Winner: {eventPick.winner ? getEntrant(eventPick.winner)?.name ?? "Selected" : "Not set"}
                  </p>
                  <p className="mt-1 text-[10px] text-emerald-200">
                    Points: {points.keyPicks ?? "—"}
                  </p>
                </div>
                <span className="pointer-events-none absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-zinc-800 bg-black p-2 text-amber-200 shadow-sm transition group-open:rotate-180">
                  <ChevronIcon />
                </span>
              </summary>
              <div className="mt-4">
                <button
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:text-amber-100 disabled:cursor-not-allowed disabled:text-zinc-600"
                  type="button"
                  onClick={() => onEdit("key_picks", event.id)}
                  disabled={isLocked}
                >
                  <EditIcon />
                  Edit
                </button>
                <div className="mt-4 space-y-3 text-sm text-zinc-200">
                  {(() => {
                    const ironLabel =
                      event.rumble_gender === "women" ? "Iron woman" : "Iron man";
                    return [
                    [
                      "Winner",
                      eventPick.winner,
                      actuals.winner,
                      scoringRules.winner,
                      actuals.winnerReady,
                    ],
                    [
                      "Entry #1",
                      eventPick.entry_1,
                      actuals.entry1,
                      scoringRules.entry_1,
                      actuals.entry1Ready,
                    ],
                    [
                      "Entry #2",
                      eventPick.entry_2,
                      actuals.entry2,
                      scoringRules.entry_2,
                      actuals.entry2Ready,
                    ],
                    [
                      "Entry #30",
                      eventPick.entry_30,
                      actuals.entry30,
                      scoringRules.entry_30,
                      actuals.entry30Ready,
                    ],
                    [
                      ironLabel,
                      eventPick.iron_person,
                      actuals.ironPerson,
                      scoringRules.iron_person,
                      actuals.ironPersonReady,
                    ],
                    [
                      "Most eliminations",
                      eventPick.most_eliminations,
                      null,
                      scoringRules.most_eliminations,
                      actuals.mostElimsReady,
                    ],
                  ];
                  })().map(([label, value, actual, pointsValue, isReady]) => {
                    const entrant = value ? getEntrant(String(value)) : null;
                    const ready = Boolean(isReady);
                    const isCorrect =
                      ready &&
                      (label === "Most eliminations"
                        ? value && actuals.topElims.has(String(value))
                        : value && actual === value);
                    return (
                      <div
                        key={label as string}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                          !ready
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
                          imageUrl={entrant?.image_url}
                          className="justify-end"
                        />
                        {ready && (
                          <span
                            className={`ml-3 text-[10px] font-semibold uppercase tracking-wide ${
                              isCorrect ? "text-emerald-200" : "text-red-200"
                            }`}
                          >
                            {isCorrect ? `+${pointsValue} pts` : "0 pts"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
            {renderGhostStrip(
              [
                eventPick.winner,
                eventPick.entry_1,
                eventPick.entry_2,
                eventPick.entry_30,
                eventPick.iron_person,
                eventPick.most_eliminations,
              ].filter(Boolean) as string[],
              3,
              "peer-open:hidden"
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

type RumbleEntrantsEditorProps = {
  event: EventRow;
  eventPick: RumblePick;
  grouped: Record<string, EntrantRow[]>;
  count: number;
  confirmedEntrantIds: Set<string>;
  entrantSearch: string;
  setEntrantSearch: (value: string) => void;
  toggleEntrant: (eventId: string, entrantId: string) => void;
  hasSaved: boolean;
  isLocked: boolean;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  userId: string | null;
  onOpenCustomModal: () => void;
};

export const RumbleEntrantsEditor = ({
  event,
  eventPick,
  grouped,
  count,
  confirmedEntrantIds,
  entrantSearch,
  setEntrantSearch,
  toggleEntrant,
  hasSaved,
  isLocked,
  onCancel,
  onSave,
  saving,
  userId,
  onOpenCustomModal,
}: RumbleEntrantsEditorProps) => (
  <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          {event.rumble_gender ? `${event.rumble_gender} rumble` : "Rumble"}
        </p>
        <h2 className="text-lg font-semibold">{event.name}</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Select up to 30. You have picked {eventPick.entrants.length}.
        </p>
      </div>
      {hasSaved && (
        <button
          className="text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
    </div>
    <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>Don’t see an entrant? Add a custom one for this event.</p>
        <button
          className="inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-4 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={onOpenCustomModal}
          disabled={isLocked}
        >
          Add custom
        </button>
      </div>
    </div>
    <div className="mt-4">
      <input
        className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
        placeholder="Search entrants"
        value={entrantSearch}
        onChange={(eventChange) => setEntrantSearch(eventChange.target.value)}
      />
      <p className="mt-2 text-xs text-zinc-500">
        {count} entrant{count === 1 ? "" : "s"}
        {entrantSearch ? " match your search." : " available."}
      </p>
    </div>
    <div className="mt-4 max-h-[520px] space-y-6 overflow-y-auto pr-1">
      <div className="sticky top-0 z-10 -mx-1 rounded-2xl border border-zinc-800 bg-zinc-950/90 px-4 py-2 text-xs text-zinc-300 backdrop-blur">
        <div className="flex items-center justify-between">
          <span>
            Selected:{" "}
            <span className="font-semibold text-amber-200">
              {eventPick.entrants.length}/30
            </span>
          </span>
          <span className="text-zinc-500">
            {Math.max(30 - eventPick.entrants.length, 0)} remaining
          </span>
        </div>
      </div>
      {count === 0 ? (
        <p className="text-sm text-zinc-400">No entrants match your search.</p>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => {
            const order = ["WWE", "TNA", "AAA"];
            const aIndex = order.indexOf(a);
            const bIndex = order.indexOf(b);
            if (aIndex !== -1 || bIndex !== -1) {
              return (
                (aIndex === -1 ? order.length : aIndex) -
                (bIndex === -1 ? order.length : bIndex)
              );
            }
            return a.localeCompare(b);
          })
          .map(([promotion, promotionEntrants]) => (
            <div key={promotion}>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                {promotion}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {promotionEntrants.map((entrant) => (
                  <label
                    key={entrant.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                      eventPick.entrants.includes(entrant.id)
                        ? "border-amber-400 bg-amber-400/10"
                        : "border-zinc-800 bg-zinc-950/70"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={eventPick.entrants.includes(entrant.id)}
                      onChange={() => toggleEntrant(event.id, entrant.id)}
                      disabled={isLocked || confirmedEntrantIds.has(entrant.id)}
                    />
                    <EntrantCard
                      name={entrant.name}
                      promotion={entrant.promotion}
                      imageUrl={entrant.image_url}
                      className="flex-1"
                    />
                    {confirmedEntrantIds.has(entrant.id) && (
                      <span className="rounded-full border border-emerald-400/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                        Confirmed
                      </span>
                    )}
                    {(entrant.status ?? "approved") === "pending" &&
                      entrant.created_by === userId && (
                        <span className="rounded-full border border-amber-400/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                          Pending
                        </span>
                      )}
                    {(entrant.status ?? "approved") === "approved" &&
                      entrant.is_custom &&
                      entrant.created_by === userId && (
                        <span className="rounded-full border border-emerald-400/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                          Approved
                        </span>
                      )}
                  </label>
                ))}
              </div>
            </div>
          ))
      )}
    </div>
    {hasSaved && (
      <div className="mt-6">
        <button
          className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
          type="button"
          onClick={onSave}
          disabled={saving || isLocked}
        >
          {saving ? "Saving…" : "Save entrants"}
        </button>
      </div>
    )}
  </section>
);

type RumbleFinalFourEditorProps = {
  event: EventRow;
  eventPick: RumblePick;
  selectedEntrants: EntrantRow[];
  toggleFinalFour: (eventId: string, entrantId: string) => void;
  hasSaved: boolean;
  isLocked: boolean;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
};

export const RumbleFinalFourEditor = ({
  event,
  eventPick,
  selectedEntrants,
  toggleFinalFour,
  hasSaved,
  isLocked,
  onCancel,
  onSave,
  saving,
}: RumbleFinalFourEditorProps) => (
  <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          {event.rumble_gender ? `${event.rumble_gender} rumble` : "Rumble"}
        </p>
        <h2 className="text-lg font-semibold">Final Four</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Select exactly 4. You have picked {eventPick.final_four.length}.
        </p>
      </div>
      {hasSaved && (
        <button
          className="text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {selectedEntrants.map((entrant) => (
        <label
          key={entrant.id}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
            eventPick.final_four.includes(entrant.id)
              ? "border-amber-400 bg-amber-400/10"
              : "border-zinc-800 bg-zinc-950/70"
          }`}
        >
          <input
            type="checkbox"
            checked={eventPick.final_four.includes(entrant.id)}
            onChange={() => toggleFinalFour(event.id, entrant.id)}
            disabled={isLocked}
          />
          <EntrantCard
            name={entrant.name}
            promotion={entrant.promotion}
            imageUrl={entrant.image_url}
            className="flex-1"
          />
        </label>
      ))}
    </div>
    {hasSaved && (
      <div className="mt-6">
        <button
          className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
          type="button"
          onClick={onSave}
          disabled={saving || isLocked}
        >
          {saving ? "Saving…" : "Save final four"}
        </button>
      </div>
    )}
  </section>
);

type MatchSummarySectionProps = {
  matches: MatchRow[];
  matchPoints: number | null;
  matchWinnerMap: Map<string, string | null>;
  matchSidesByMatch: Record<string, MatchSideRow[]>;
  matchEntrantsByMatch: Record<string, MatchEntrantRow[]>;
  entrantByIdAll: Map<string, EntrantRow>;
  payload: PicksPayload;
  isLocked: boolean;
  onEdit: (section: "matches") => void;
};

export const MatchSummarySection = ({
  matches,
  matchPoints,
  matchWinnerMap,
  matchSidesByMatch,
  matchEntrantsByMatch,
  entrantByIdAll,
  payload,
  isLocked,
  onEdit,
}: MatchSummarySectionProps) => (
  <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold">Match Picks</h2>
      <button
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:text-amber-100 disabled:cursor-not-allowed disabled:text-zinc-600"
        type="button"
        onClick={() => onEdit("matches")}
        disabled={isLocked}
      >
        <EditIcon />
        Edit
      </button>
    </div>
    {matchPoints !== null && (
      <p className="mt-2 text-xs text-emerald-200">Points: {matchPoints}</p>
    )}
    {matches.length === 0 ? (
      <p className="mt-4 text-sm text-zinc-400">No matches available yet.</p>
    ) : (
      <div className="mt-4 space-y-3 text-sm text-zinc-200">
        {matches.map((match) => {
          const pick = payload.match_picks[match.id] ?? null;
          const winner = matchWinnerMap.get(match.id) ?? null;
          const sides = matchSidesByMatch[match.id] ?? [];
          const pickSide = pick ? sides.find((side) => side.id === pick) : null;
          const pickEntrants = pick
            ? (matchEntrantsByMatch[match.id] ?? [])
                .filter((row) => row.side_id === pick)
                .map((row) => entrantByIdAll.get(row.entrant_id))
                .filter(Boolean)
            : [];
          const entrantCount = (matchEntrantsByMatch[match.id] ?? []).length;
          const finishPick = payload.match_finish_picks[match.id];
          const lengthPick = payload.match_length_picks?.[match.id] ?? null;
          const finishMethod = finishPick?.method ?? null;
          const finishWinner = finishPick?.winner
            ? entrantByIdAll.get(finishPick.winner)
            : null;
          const finishLoser = finishPick?.loser
            ? entrantByIdAll.get(finishPick.loser)
            : null;
          const finishMethodCorrect =
            match.finish_method && finishMethod
              ? match.finish_method === finishMethod
              : false;
          const matchLengthCorrect =
            match.match_length && lengthPick
              ? match.match_length === lengthPick
              : false;
          const finishWinnerCorrect =
            match.finish_winner_entrant_id && finishPick?.winner
              ? match.finish_winner_entrant_id === finishPick.winner
              : false;
          const finishLoserCorrect =
            match.finish_loser_entrant_id && finishPick?.loser
              ? match.finish_loser_entrant_id === finishPick.loser
              : false;
          const interferencePick =
            payload.match_interference_picks?.[match.id] ?? null;
          const matchInterferenceCorrect =
            match.match_interference && interferencePick
              ? match.match_interference === interferencePick
              : false;
          const isCorrect = winner && pick ? winner === pick : false;
          const showFinishDetails =
            !!finishMethod ||
            !!match.finish_method ||
            !!finishPick ||
            !!lengthPick ||
            !!interferencePick;

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
                    {pick ? "Winner pick" : "Not set"}
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
                    {isCorrect
                      ? `+${scoringRules.match_winner} pts`
                      : "0 pts"}
                  </span>
                )}
              </div>
              {showFinishDetails && (
                <div className="mt-3 space-y-2 text-xs text-zinc-400">
                  <div className="flex items-center justify-between">
                    <span>Match length</span>
                    <span
                      className={
                        !match.match_length
                          ? "text-zinc-500"
                          : matchLengthCorrect
                            ? "text-emerald-200"
                            : "text-red-200"
                      }
                    >
                      {lengthPick ? lengthPick.replace("_", " ") : "Not set"}
                      {match.match_length
                        ? ` • ${
                            matchLengthCorrect
                              ? `+${scoringRules.match_length}`
                              : "0"
                          } pts`
                        : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Interference</span>
                    <span
                      className={
                        !match.match_interference
                          ? "text-zinc-500"
                          : matchInterferenceCorrect
                            ? "text-emerald-200"
                            : "text-red-200"
                      }
                    >
                      {interferencePick
                        ? interferencePick === "yes"
                          ? "Yes"
                          : "No"
                        : "Not set"}
                      {match.match_interference
                        ? ` • ${
                            matchInterferenceCorrect
                              ? `+${scoringRules.match_interference}`
                              : "0"
                          } pts`
                        : ""}
                    </span>
                  </div>
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
                    finishMethod === "submission") &&
                    entrantCount > 2 && (
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
);

type MatchPicksSectionProps = {
  matches: MatchRow[];
  matchSidesByMatch: Record<string, MatchSideRow[]>;
  matchEntrantsByMatch: Record<string, MatchEntrantRow[]>;
  entrantByIdAll: Map<string, EntrantRow>;
  matchPickStats: Record<string, { total: number; bySide: Record<string, number> }>;
  payload: PicksPayload;
  setPayload: Dispatch<SetStateAction<PicksPayload>>;
  isLocked: boolean;
  hasSaved: boolean;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
};

type EliminatorPicksSectionProps = {
  eliminator: EliminatorRow;
  entries: EliminatorEntryRow[];
  entrantByIdAll: Map<string, EntrantRow>;
  payload: PicksPayload;
  setPayload: Dispatch<SetStateAction<PicksPayload>>;
  isLocked: boolean;
};

export const EliminatorPicksSection = ({
  eliminator,
  entries,
  entrantByIdAll,
  payload,
  setPayload,
  isLocked,
}: EliminatorPicksSectionProps) => {
  const pick = payload.eliminators?.[eliminator.id] ?? {
    entry_order: {},
    elimination_order: {},
    elimination_type: {},
    eliminated_by: {},
    winner_id: null,
    most_eliminations: null,
  };
  const entrants = entries
    .map((entry) => entrantByIdAll.get(entry.entrant_id))
    .filter(Boolean) as EntrantRow[];
  const orderedEntries = useMemo(() => {
    const byName = (entry: EliminatorEntryRow) =>
      entrantByIdAll.get(entry.entrant_id)?.name ?? "";
    const sortedUnassigned = [...entries]
      .filter((entry) => !pick.entry_order?.[entry.entrant_id])
      .sort((a, b) => byName(a).localeCompare(byName(b)));
    const assigned = new Map<number, EliminatorEntryRow>();
    entries.forEach((entry) => {
      const order = pick.entry_order?.[entry.entrant_id];
      if (order) {
        assigned.set(order, entry);
      }
    });
    const slots = Math.max(eliminator.entrant_limit ?? 0, entries.length);
    const result: EliminatorEntryRow[] = [];
    for (let slot = 1; slot <= slots; slot += 1) {
      const assignedEntry = assigned.get(slot);
      if (assignedEntry) {
        result.push(assignedEntry);
        continue;
      }
      const nextUnassigned = sortedUnassigned.shift();
      if (nextUnassigned) {
        result.push(nextUnassigned);
      }
    }
    if (sortedUnassigned.length > 0) {
      result.push(...sortedUnassigned);
    }
    return result;
  }, [entries, entrantByIdAll, pick.entry_order, eliminator.entrant_limit]);
  const selectedEntryOrders = useMemo(() => {
    const chosen = new Map<number, string>();
    Object.entries(pick.entry_order ?? {}).forEach(([entrantId, order]) => {
      if (order) {
        chosen.set(order, entrantId);
      }
    });
    return chosen;
  }, [pick.entry_order]);
  const selectedElimOrders = useMemo(() => {
    const chosen = new Map<number, string>();
    Object.entries(pick.elimination_order ?? {}).forEach(([entrantId, order]) => {
      if (order) {
        chosen.set(order, entrantId);
      }
    });
    return chosen;
  }, [pick.elimination_order]);
  const activeEntrants = useMemo(() => {
    return entrants.filter((entrant) => {
      if (pick.winner_id === entrant.id) {
        return true;
      }
      return !pick.elimination_order?.[entrant.id];
    });
  }, [entrants, pick.elimination_order, pick.winner_id]);
  const firstIncomplete = useMemo(() => {
    for (const entry of orderedEntries) {
      const id = entry.entrant_id;
      const isWinner = pick.winner_id === id;
      if (!pick.entry_order?.[id]) return id;
      if (!isWinner) {
        if (
          !pick.elimination_order?.[id] ||
          !pick.elimination_type?.[id] ||
          !pick.eliminated_by?.[id]
        ) {
          return id;
        }
      }
    }
    return orderedEntries[0]?.entrant_id ?? null;
  }, [
    orderedEntries,
    pick.entry_order,
    pick.elimination_order,
    pick.elimination_type,
    pick.eliminated_by,
    pick.winner_id,
  ]);
  const allEmpty = useMemo(() => {
    const hasAnyEntryOrder = Object.values(pick.entry_order ?? {}).some(Boolean);
    const hasAnyElimOrder = Object.values(pick.elimination_order ?? {}).some(Boolean);
    const hasAnyElimType = Object.values(pick.elimination_type ?? {}).some(Boolean);
    const hasAnyElimBy = Object.values(pick.eliminated_by ?? {}).some(Boolean);
    const hasWinner = Boolean(pick.winner_id);
    const hasMostElims = Boolean(pick.most_eliminations);
    return (
      !hasAnyEntryOrder &&
      !hasAnyElimOrder &&
      !hasAnyElimType &&
      !hasAnyElimBy &&
      !hasWinner &&
      !hasMostElims
    );
  }, [
    pick.entry_order,
    pick.elimination_order,
    pick.elimination_type,
    pick.eliminated_by,
    pick.winner_id,
    pick.most_eliminations,
  ]);
  const onlyWinnerPick = useMemo(() => {
    const hasAnyEntryOrder = Object.values(pick.entry_order ?? {}).some(Boolean);
    const hasAnyElimOrder = Object.values(pick.elimination_order ?? {}).some(Boolean);
    const hasAnyElimType = Object.values(pick.elimination_type ?? {}).some(Boolean);
    const hasAnyElimBy = Object.values(pick.eliminated_by ?? {}).some(Boolean);
    const hasMostElims = Boolean(pick.most_eliminations);
    return (
      Boolean(pick.winner_id) &&
      !hasAnyEntryOrder &&
      !hasAnyElimOrder &&
      !hasAnyElimType &&
      !hasAnyElimBy &&
      !hasMostElims
    );
  }, [
    pick.entry_order,
    pick.elimination_order,
    pick.elimination_type,
    pick.eliminated_by,
    pick.winner_id,
    pick.most_eliminations,
  ]);
  const allComplete = useMemo(() => {
    if (!pick.winner_id || !pick.most_eliminations) {
      return false;
    }
    return orderedEntries.every((entry) => {
      const id = entry.entrant_id;
      if (!pick.entry_order?.[id]) return false;
      if (pick.winner_id === id) {
        return true;
      }
      return Boolean(pick.elimination_order?.[id]) &&
        Boolean(pick.elimination_type?.[id]) &&
        Boolean(pick.eliminated_by?.[id]);
    });
  }, [
    orderedEntries,
    pick.entry_order,
    pick.elimination_order,
    pick.elimination_type,
    pick.eliminated_by,
    pick.winner_id,
    pick.most_eliminations,
  ]);
  const [openEntrantId, setOpenEntrantId] = useState<string | null>(
    firstIncomplete
  );
  const [hasUserToggled, setHasUserToggled] = useState(false);
  useEffect(() => {
    if (hasUserToggled) {
      if (
        openEntrantId &&
        !orderedEntries.some((entry) => entry.entrant_id === openEntrantId)
      ) {
        setOpenEntrantId(firstIncomplete ?? null);
      }
      return;
    }
    if (allComplete) {
      setOpenEntrantId(null);
      return;
    }
    if (onlyWinnerPick && pick.winner_id) {
      setOpenEntrantId(pick.winner_id);
      return;
    }
    if (allEmpty) {
      if (pick.winner_id) {
        setOpenEntrantId(pick.winner_id);
        return;
      }
      if (!openEntrantId) {
        setOpenEntrantId(null);
      }
      return;
    }
    if (
      !openEntrantId ||
      !orderedEntries.some((entry) => entry.entrant_id === openEntrantId)
    ) {
      setOpenEntrantId(firstIncomplete);
    }
  }, [
    firstIncomplete,
    orderedEntries,
    openEntrantId,
    allComplete,
    allEmpty,
    onlyWinnerPick,
    pick.winner_id,
    hasUserToggled,
  ]);
  const entryOptions = Array.from(
    { length: eliminator.entrant_limit },
    (_, index) => index + 1
  );
  const eliminationOptions = Array.from(
    { length: Math.max(eliminator.entrant_limit - 1, 1) },
    (_, index) => index + 1
  );

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-zinc-100">
          {eliminator.name}
        </h3>
      </div>
      <div className="mt-4 space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Entrants will appear once the admin preloads them.
          </p>
        ) : (
          <>
            <label className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                <span className="flex items-center justify-between gap-2">
                <span>Winner pick</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
                  +{scoringRules.eliminator_winner} pts
                </span>
              </span>
              <select
                className="mt-2 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                value={pick.winner_id ?? ""}
                onChange={(event) => {
                  const nextWinner = event.target.value || null;
                  setHasUserToggled(true);
                  if (nextWinner) {
                    setOpenEntrantId(nextWinner);
                  }
                  setPayload((prev) => {
                    const current = prev.eliminators?.[eliminator.id] ?? pick;
                    const nextEntryOrder = { ...(current.entry_order ?? {}) };
                    const nextElimOrder = { ...(current.elimination_order ?? {}) };
                    const nextElimType = { ...(current.elimination_type ?? {}) };
                    const nextElimBy = { ...(current.eliminated_by ?? {}) };
                    if (nextWinner) {
                      nextElimOrder[nextWinner] = null;
                      nextElimType[nextWinner] = null;
                      nextElimBy[nextWinner] = null;
                    }
                    return {
                      ...prev,
                      eliminators: {
                        ...(prev.eliminators ?? {}),
                        [eliminator.id]: {
                          ...current,
                          entry_order: nextEntryOrder,
                          elimination_order: nextElimOrder,
                          elimination_type: nextElimType,
                          eliminated_by: nextElimBy,
                          winner_id: nextWinner,
                        },
                      },
                    };
                  });
                }}
                disabled={isLocked}
              >
                <option value="">Select winner</option>
                {entrants.map((entrant) => (
                  <option key={entrant.id} value={entrant.id}>
                    {entrant.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4 space-y-3">
              {orderedEntries.map((entry) => {
              const entrant = entrantByIdAll.get(entry.entrant_id);
              const isOpen = openEntrantId === entry.entrant_id;
              const isWinner = pick.winner_id === entry.entrant_id;
              const hasEntryOrder = Boolean(pick.entry_order?.[entry.entrant_id]);
              const hasElimOrder = Boolean(
                pick.elimination_order?.[entry.entrant_id]
              );
              const hasElimType = Boolean(
                pick.elimination_type?.[entry.entrant_id]
              );
              const hasElimBy = Boolean(pick.eliminated_by?.[entry.entrant_id]);
              const hasAnyPick =
                hasEntryOrder ||
                hasElimOrder ||
                hasElimType ||
                hasElimBy ||
                isWinner;
              const isComplete = isWinner
                ? hasEntryOrder && Boolean(pick.winner_id)
                : hasEntryOrder && hasElimOrder && hasElimType && hasElimBy;
              const statusText = !hasAnyPick
                ? "No picks yet"
                : isComplete
                  ? "Picks saved"
                  : "In progress";
              const eliminationCandidates = activeEntrants.filter(
                (activeEntrant) => activeEntrant.id !== entry.entrant_id
              );
              return (
                <div
                  key={entry.entrant_id}
                  className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
                >
                  {isOpen && (
                    <div className="pointer-events-none absolute inset-0">
                      {entrant?.image_url ? (
                        <div className="absolute inset-y-0 right-0 w-2/5">
                          <div className="relative h-full w-full">
                            <Image
                              src={entrant.image_url}
                              alt=""
                              fill
                              sizes="40vw"
                              className="object-cover object-top opacity-70"
                            />
                            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-black/40 to-black/90" />
                          </div>
                        </div>
                      ) : null}
                      <div className="absolute inset-0 bg-[linear-gradient(90deg,_rgba(255,255,255,0.03)_0%,_rgba(255,255,255,0.06)_20%,_rgba(255,255,255,0.02)_45%,_rgba(255,255,255,0.08)_60%,_rgba(255,255,255,0.03)_80%)] opacity-60" />
                    </div>
                  )}
                  <div className="relative">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 text-left"
                      onClick={() =>
                        setOpenEntrantId((prev) => {
                          setHasUserToggled(true);
                          return prev === entry.entrant_id ? null : entry.entrant_id;
                        })
                      }
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-center gap-3">
                        {!isOpen && pick.entry_order?.[entry.entrant_id] ? (
                          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
                            #{pick.entry_order?.[entry.entrant_id]}
                          </span>
                        ) : null}
                        {!isOpen && entrant?.image_url ? (
                          <span className="inline-flex h-12 w-12 overflow-hidden rounded-full border border-amber-400/50 bg-black/40">
                            <Image
                              src={entrant.image_url}
                              alt=""
                              width={48}
                              height={48}
                              className="h-full w-full object-cover"
                            />
                          </span>
                        ) : null}
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-100">
                            {entrant?.name ?? "Entrant"}
                          </p>
                          <p
                            className={`mt-1 text-[11px] uppercase tracking-[0.2em] ${
                              statusText === "Picks saved"
                                ? "text-amber-200"
                                : "text-zinc-500"
                            }`}
                          >
                            {statusText}
                          </p>
                        </div>
                      </div>
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border bg-black/60 text-xs ${
                        statusText === "Picks saved"
                          ? "border-amber-300/70 text-amber-200"
                          : "border-zinc-700 text-zinc-200"
                      }`}
                    >
                      {isOpen ? "–" : "+"}
                    </span>
                    </button>
                    {isOpen && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-3 max-w-[50%]">
                        <label className="text-xs font-medium text-zinc-400">
                          <span className="flex items-center justify-between gap-2">
                            <span>Entry order</span>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
                              +{scoringRules.eliminator_entry_order} pts
                            </span>
                          </span>
                          <select
                            className="mt-2 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100"
                            value={pick.entry_order?.[entry.entrant_id] ?? ""}
                            onChange={(event) =>
                              setPayload((prev) => {
                                const current =
                                  prev.eliminators?.[eliminator.id] ?? pick;
                                return {
                                  ...prev,
                                  eliminators: {
                                    ...(prev.eliminators ?? {}),
                                    [eliminator.id]: {
                                      ...current,
                                      entry_order: {
                                        ...(current.entry_order ?? {}),
                                        [entry.entrant_id]:
                                          event.target.value === ""
                                            ? null
                                            : Number(event.target.value),
                                      },
                                    },
                                  },
                                };
                              })
                            }
                            disabled={isLocked}
                          >
                            <option value="">Select</option>
                            {entryOptions.map((value) => {
                              const chosenBy = selectedEntryOrders.get(value);
                              const isTaken =
                                Boolean(chosenBy) &&
                                chosenBy !== entry.entrant_id;
                              return (
                                <option
                                  key={value}
                                  value={value}
                                  disabled={isTaken}
                                >
                                  {value}
                                  {isTaken ? " (taken)" : ""}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                        {!isWinner && (
                        <label className="text-xs font-medium text-zinc-400">
                          <span className="flex items-center justify-between gap-2">
                            <span>Elimination order</span>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
                              +{scoringRules.eliminator_elimination_order} pts
                            </span>
                          </span>
                          <select
                            className="mt-2 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100"
                            value={
                                pick.elimination_order?.[entry.entrant_id] ?? ""
                              }
                              onChange={(event) =>
                                setPayload((prev) => {
                                  const current =
                                    prev.eliminators?.[eliminator.id] ?? pick;
                                  return {
                                    ...prev,
                                    eliminators: {
                                      ...(prev.eliminators ?? {}),
                                      [eliminator.id]: {
                                        ...current,
                                        elimination_order: {
                                          ...(current.elimination_order ?? {}),
                                          [entry.entrant_id]:
                                            event.target.value === ""
                                              ? null
                                              : Number(event.target.value),
                                        },
                                      },
                                    },
                                  };
                                })
                              }
                              disabled={isLocked}
                            >
                              <option value="">Select</option>
                              {eliminationOptions.map((value) => {
                                const chosenBy = selectedElimOrders.get(value);
                                const isTaken =
                                  Boolean(chosenBy) &&
                                  chosenBy !== entry.entrant_id;
                                return (
                                  <option
                                    key={value}
                                    value={value}
                                    disabled={isTaken}
                                  >
                                    {value}
                                    {isTaken ? " (taken)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                        )}
                        {!isWinner && (
                        <label className="text-xs font-medium text-zinc-400">
                          <span className="flex items-center justify-between gap-2">
                            <span>Eliminated by</span>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
                              +{scoringRules.eliminator_eliminated_by} pts
                            </span>
                          </span>
                          <select
                            className="mt-2 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100"
                            value={
                              pick.eliminated_by?.[entry.entrant_id] ?? ""
                            }
                            onChange={(event) =>
                              setPayload((prev) => {
                                const current =
                                  prev.eliminators?.[eliminator.id] ?? pick;
                                return {
                                  ...prev,
                                  eliminators: {
                                    ...(prev.eliminators ?? {}),
                                    [eliminator.id]: {
                                      ...current,
                                      eliminated_by: {
                                        ...(current.eliminated_by ?? {}),
                                        [entry.entrant_id]:
                                          event.target.value || null,
                                      },
                                    },
                                  },
                                };
                              })
                            }
                            disabled={isLocked}
                          >
                            <option value="">Select</option>
                            {eliminationCandidates.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        )}
                        {!isWinner && (
                        <label className="text-xs font-medium text-zinc-400">
                          <span className="flex items-center justify-between gap-2">
                            <span>Elimination type</span>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
                              +{scoringRules.eliminator_elimination_type} pts
                            </span>
                          </span>
                          <select
                            className="mt-2 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100"
                            value={
                                pick.elimination_type?.[entry.entrant_id] ?? ""
                              }
                              onChange={(event) =>
                                setPayload((prev) => {
                                  const current =
                                    prev.eliminators?.[eliminator.id] ?? pick;
                                  return {
                                    ...prev,
                                    eliminators: {
                                      ...(prev.eliminators ?? {}),
                                      [eliminator.id]: {
                                        ...current,
                                        elimination_type: {
                                          ...(current.elimination_type ?? {}),
                                          [entry.entrant_id]:
                                            (event.target.value as
                                              | "pinfall"
                                              | "submission") || null,
                                        },
                                      },
                                    },
                                  };
                                })
                              }
                              disabled={isLocked}
                            >
                              <option value="">Select</option>
                              <option value="pinfall">Pinfall</option>
                              <option value="submission">Submission</option>
                            </select>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </>
        )}
      </div>
      <div className="mt-4">
        <label className="text-xs uppercase tracking-[0.25em] text-zinc-500">
          <span className="flex items-center justify-between gap-2">
            <span>Most eliminations</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
              +{scoringRules.eliminator_most_eliminations} pts
            </span>
          </span>
          <select
            className="mt-2 h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
            value={pick.most_eliminations ?? ""}
            onChange={(event) =>
              setPayload((prev) => {
                const current = prev.eliminators?.[eliminator.id] ?? pick;
                return {
                  ...prev,
                  eliminators: {
                    ...(prev.eliminators ?? {}),
                    [eliminator.id]: {
                      ...current,
                      most_eliminations: event.target.value || null,
                    },
                  },
                };
              })
            }
            disabled={isLocked}
          >
            <option value="">Select</option>
            {entrants.map((entrant) => (
              <option key={entrant.id} value={entrant.id}>
                {entrant.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
};

type SegmentedOption = {
  value: string;
  label: string;
};

type BonusPicksAccordionProps = {
  defaultOpen?: boolean;
  summaryText?: string;
  status?: "none" | "partial" | "complete";
  children: React.ReactNode;
};

const BonusPicksAccordion = ({
  defaultOpen = false,
  summaryText,
  status = "none",
  children,
}: BonusPicksAccordionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) {
      setIsOpen(true);
    }
  }, [defaultOpen]);

  return (
    <details
      className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3"
      open={isOpen}
      onToggle={(event) => {
        const target = event.currentTarget;
        setIsOpen(target.open);
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
        <span className="flex items-center gap-2">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center ${
              status === "complete" ? "text-[12px]" : "text-[18px]"
            } ${status === "complete" ? "text-amber-300" : "text-zinc-400"}`}
            aria-hidden
          >
            {status === "complete" ? "✓" : status === "partial" ? "◔" : "○"}
          </span>
          Bonus picks
        </span>
        <span className="flex items-center gap-2">
          {summaryText ? (
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-200/80">
              {summaryText}
            </span>
          ) : null}
          <span className="text-zinc-500 transition group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
};

type SegmentedPillsProps = {
  options: SegmentedOption[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

const SegmentedPills = ({
  options,
  selectedValue,
  onSelect,
  disabled = false,
  className = "",
}: SegmentedPillsProps) => (
  <div
    className={`flex w-full p-1 ${className}`}
  >
    {options.map((option, index) => {
      const isSelected = selectedValue === option.value;
      const isFirst = index === 0;
      const isLast = index === options.length - 1;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          disabled={disabled}
          aria-pressed={isSelected}
          className={`relative flex-1 border px-5 py-3 text-[10px] uppercase transition ${
            isSelected
              ? "z-10 border-amber-400/70 bg-amber-400/20 text-amber-100"
              : "border-zinc-800 text-zinc-300 hover:text-amber-200"
          } ${isFirst ? "rounded-l-full" : ""} ${isLast ? "rounded-r-full" : ""} ${
            !isFirst ? "-ml-px" : ""
          } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export const MatchPicksSection = ({
  matches,
  matchSidesByMatch,
  matchEntrantsByMatch,
  entrantByIdAll,
  matchPickStats,
  payload,
  setPayload,
  isLocked,
  hasSaved,
  onCancel,
  onSave,
  saving,
}: MatchPicksSectionProps) => (
  <section>
    <div className="flex items-center justify-between">
      {hasSaved && (
        <button
          className="text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
    </div>
    {matches.length === 0 ? (
      <p className="mt-4 text-sm text-zinc-400">No matches available yet.</p>
    ) : (
      <div className="mt-4 space-y-4">
        {matches.map((match) => {
          const sides = matchSidesByMatch[match.id] ?? [];
          const participantRows = matchEntrantsByMatch[match.id] ?? [];
          const sideEntries = sides.map((side, index) => {
            const entrantsForSide = participantRows
              .filter((row) => row.side_id === side.id)
              .map((row) => entrantByIdAll.get(row.entrant_id))
              .filter(Boolean) as EntrantRow[];
            const label = side.label?.trim() || `Side ${index + 1}`;
            return { side, label, entrants: entrantsForSide };
          });
          const allEntrants = participantRows
            .map((row) => entrantByIdAll.get(row.entrant_id))
            .filter(Boolean) as EntrantRow[];
          const sortedEntrants = [...allEntrants].sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          const finishPick = payload.match_finish_picks[match.id] ?? {
            method: null,
            winner: null,
            loser: null,
          };
          const lengthPick = payload.match_length_picks?.[match.id] ?? null;
          const interferencePick =
            payload.match_interference_picks?.[match.id] ?? null;
          const lengthOptions: Array<{
            value: "sprint" | "standard" | "epic";
            label: string;
          }> = [
            { value: "sprint", label: "Sprint" },
            { value: "standard", label: "Standard" },
            { value: "epic", label: "Epic" },
          ];
          const interferenceOptions = [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ];
          const matchType = match.match_type;
          const isSingles = matchType === "singles";
          const isTripleOrFatal =
            matchType === "triple_threat" || matchType === "fatal_4_way";
          const isTag = matchType === "tag" || matchType === "tag_3";
          const isThreeTag = matchType === "tag_3";
          const winningSideId = payload.match_picks[match.id] ?? null;
          const winningSideEntrants =
            sideEntries.find((side) => side.side.id === winningSideId)?.entrants ??
            [];
          const losingSideEntrants = sideEntries
            .filter((side) => side.side.id !== winningSideId)
            .flatMap((side) => side.entrants);
          const finishRequiresEntrants =
            finishPick.method === "pinfall" || finishPick.method === "submission";
          const showFinishWinner = !isSingles && !isTripleOrFatal;
          const showFinishLoser = !isSingles;
          const hasWinnerPick = Boolean(payload.match_picks[match.id]);
          const matchStats = matchPickStats[match.id];
          const matchTotal = matchStats?.total ?? 0;
          const getPercent = (sideId?: string | null) => {
            if (!sideId || matchTotal === 0) return null;
            const count = matchStats?.bySide?.[sideId] ?? 0;
            return Math.round((count / matchTotal) * 100);
          };
          const matchupSides =
            matchType === "triple_threat"
              ? sideEntries.slice(0, 3)
              : sideEntries.slice(0, 2);
          const matchupSideTitles = matchupSides.map(({ side, label, entrants }, index) => {
            const trimmedLabel = label?.trim();
            const championSuffix =
              Boolean(match.is_championship) &&
              Boolean(match.champion_side_id) &&
              match.champion_side_id === side.id
                ? " (C)"
                : "";
            if (trimmedLabel && entrants.length > 1) {
              return `${trimmedLabel}${championSuffix}`;
            }
            if (entrants.length > 0) {
              return `${entrants.map((entrant) => entrant.name).join(" • ")}${championSuffix}`;
            }
            return `Side ${index + 1}${championSuffix}`;
          });
          const isMainEvent = Boolean(match.is_main_event);
          const isChampionship = Boolean(match.is_championship);
          const isPrestige = isMainEvent || isChampionship;
          const hasMatchup =
            matchupSides.length >= 2 &&
            matchupSides.some((side) => side.entrants.length > 0);
          const sideGridClass = isTag ? "grid-cols-2 auto-rows-fr" : "grid-cols-1";
          const finishOptions = [
            { value: "pinfall", label: "Pinfall" },
            { value: "submission", label: "Submission" },
            { value: "disqualification", label: "Disqualify" },
          ];
          const hasBonusPick =
            Boolean(lengthPick) ||
            Boolean(interferencePick) ||
            Boolean(finishPick.method) ||
            Boolean(finishPick.winner) ||
            Boolean(finishPick.loser);
          const bonusChoiceCount =
            (lengthPick ? 1 : 0) +
            (finishPick.method ? 1 : 0) +
            (interferencePick ? 1 : 0) +
            (showFinishWinner && finishPick.winner ? 1 : 0) +
            (showFinishLoser && finishPick.loser ? 1 : 0);
          const bonusTotalChoices =
            3 + (showFinishWinner ? 1 : 0) + (showFinishLoser ? 1 : 0);
          const bonusStatus =
            bonusChoiceCount === 0
              ? "none"
              : bonusChoiceCount >= bonusTotalChoices
                ? "complete"
                : "partial";
          const bonusPointsTotal =
            scoringRules.match_length +
            scoringRules.match_finish_method +
            scoringRules.match_interference +
            (showFinishWinner ? scoringRules.match_finish_winner : 0) +
            (showFinishLoser ? scoringRules.match_finish_loser : 0);
          const bonusSectionId = `bonus-picks-${match.id}`;
          const handleSelectWinner = (sideId: string | null) => {
            if (!sideId) return;
            setPayload((prev) => ({
              ...prev,
              match_picks: {
                ...prev.match_picks,
                [match.id]: sideId,
              },
            }));
            if (bonusPointsTotal > 0) {
              requestAnimationFrame(() => {
                const el =
                  typeof document !== "undefined"
                    ? document.getElementById(bonusSectionId)
                    : null;
                el?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              });
            }
          };

          return (
            <div
              key={match.id}
              className={`relative overflow-visible rounded-2xl border bg-zinc-950/60 p-4 ${
                isPrestige
                  ? "border-amber-400/40 bg-black/60 shadow-[0_18px_50px_rgba(0,0,0,0.5),0_0_26px_rgba(198,162,74,0.32)]"
                  : "border-zinc-800"
              }`}
            >
              {isChampionship && match.championship_image_url ? (
                <div className="pointer-events-none absolute left-1/2 top-4 z-0 h-36 w-xs -translate-x-1/2 -translate-y-1/2 sm:h-44 sm:top-6">
                  <div className="relative h-full w-full">
                    <Image
                      src={match.championship_image_url}
                      alt={`${match.championship_name ?? "Championship"} belt`}
                      fill
                      sizes="20rem"
                      className="object-cover object-center opacity-80 drop-shadow-[0_0_38px_rgba(198,162,74,0.5)]"
                    />
                  </div>
                </div>
              ) : null}
                <div
                className={`relative z-10 ${
                  isChampionship
                    ? "-m-4 rounded-2xl bg-zinc-950/95 p-4 pt-0"
                    : ""
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div>
                    {isChampionship && (
                      <div className="mb-5 mt-2 text-center">
                        <span className="rounded-full border border-amber-300/40 bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-amber-100">
                          {match.championship_name?.trim() || "Championship"}
                        </span>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-zinc-500">
                      Tap a side to select the winner.
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-100">
                      +{scoringRules.match_winner} pts for correct winner
                    </p>
                  </div>
                </div>
                {sideEntries.length === 0 && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Add match participants in admin to enable picks.
                  </p>
                )}
                {sideEntries.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {isThreeTag && hasMatchup && (
                      <div className="space-y-4">
                        {matchupSides.slice(0, 2).map((sideEntry, index) => {
                          const isSelected =
                            payload.match_picks[match.id] === sideEntry.side.id;
                          const hasSelection = Boolean(payload.match_picks[match.id]);
                          const isDimmed = hasSelection && !isSelected;
                          return (
                            <div key={`${match.id}-team-${sideEntry.side.id}`} className="space-y-2">
                              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                                {matchupSideTitles[index]}
                              </p>
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => handleSelectWinner(sideEntry.side.id)}
                                className={`w-full overflow-hidden rounded-2xl border transition ${
                                  isSelected
                                    ? "border-amber-300 shadow-[0_0_22px_rgba(251,196,0,0.28)]"
                                    : "border-zinc-700 hover:border-amber-400/60"
                                } ${isDimmed ? "opacity-35" : "opacity-100"}`}
                                aria-label={`Select ${sideEntry.label ?? `Side ${index + 1}`} as winner`}
                              >
                                <div className="relative flex h-56 items-end justify-center overflow-hidden bg-zinc-900 sm:h-64">
                                  {(sideEntry.entrants ?? []).slice(0, 3).map((entrant, entrantIndex) => (
                                    <div
                                      key={`${match.id}-team-card-${entrant.id}`}
                                      className={`relative h-full w-[40%] shrink-0 bg-zinc-900 ${
                                        entrantIndex === 1
                                          ? "z-20"
                                          : entrantIndex === 0
                                            ? "z-10 -mr-7"
                                            : "z-10 -ml-7"
                                      }`}
                                    >
                                      {entrant.image_url ? (
                                        <Image
                                          src={entrant.image_url}
                                          alt={entrant.name}
                                          fill
                                          sizes="(max-width: 640px) 42vw, 200px"
                                          className="object-cover"
                                        />
                                      ) : (
                                        <div className="h-full w-full bg-gradient-to-b from-zinc-800 via-zinc-900 to-black" />
                                      )}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                      <div className="absolute inset-x-0 bottom-0 z-10 p-1 text-center">
                                        {entrant.logo_url ? (
                                          <Image
                                            src={entrant.logo_url}
                                            alt={`${entrant.name} logo`}
                                            width={220}
                                            height={72}
                                            className="mx-auto h-16 w-auto object-contain"
                                          />
                                        ) : (
                                          <span className="line-clamp-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-zinc-100">
                                            {entrant.name}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </button>
                              {index === 0 ? (
                                <div className="flex items-center justify-center gap-3 py-1">
                                  <span className="h-px w-14 bg-amber-300/45" />
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200">
                                    VS
                                  </span>
                                  <span className="h-px w-14 bg-amber-300/45" />
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {!isThreeTag && hasMatchup && (
                      <div>
                        <div
                          className={`mb-2 grid gap-3 ${
                            matchupSides.length === 3
                              ? "grid-cols-3"
                              : "grid-cols-2"
                          }`}
                        >
                          {matchupSideTitles.map((title, index) => (
                            <span
                              key={`${match.id}-title-${index}`}
                              className={`text-[12px] font-semibold uppercase tracking-[0.2em] text-amber-200 ${
                                matchupSides.length === 3
                                  ? "text-center"
                                  : index === 1
                                    ? "text-right"
                                    : "text-left"
                              }`}
                            >
                              {title}
                            </span>
                          ))}
                        </div>
                        <div
                          className={`relative z-10 h-96 overflow-hidden md:h-[28rem] lg:h-[34rem] ${
                            isPrestige
                              ? "border-y border-amber-400/50 bg-black/60"
                              : "rounded-2xl border border-zinc-800 bg-black/40"
                          }`}
                        >
                          <div
                            className={`grid h-full w-full ${
                              matchupSides.length === 3
                                ? "grid-cols-3"
                                : "grid-cols-2"
                            }`}
                          >
                            {matchupSides.map((sideEntry, index) => {
                              const entrants = sideEntry.entrants ?? [];
                              const percent = getPercent(sideEntry.side.id ?? null);
                              const isSelected =
                                payload.match_picks[match.id] ===
                                sideEntry.side.id;
                              const isDimmed =
                                hasWinnerPick && !isSelected;
                              return (
                                <div
                                  key={`${match.id}-matchup-${index}`}
                                  className={`relative h-full w-full overflow-hidden ${
                                    isSelected
                                      ? "ring-2 ring-amber-300 shadow-[0_0_22px_rgba(251,196,0,0.3)]"
                                      : ""
                                  } ${isDimmed ? "opacity-35" : "opacity-100"}`}
                                >
                                  <div className="absolute left-2 top-2 z-20 flex items-center gap-2 rounded-full border border-amber-400/60 bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-200 shadow-[0_0_18px_rgba(198,162,74,0.35)]">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/20 text-[11px]">
                                      ★
                                    </span>
                                    {percent === null ? "—" : `${percent}% fans`}
                                  </div>
                                  {isSelected && (
                                    <div className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-amber-300 bg-black/80 text-amber-200">
                                      ✓
                                    </div>
                                  )}
                                  <div className={`grid h-full w-full ${sideGridClass}`}>
                                    {entrants.length > 0 ? (
                                      entrants.map((entrant) => (
                                        (() => {
                                          const hasLogo = Boolean(entrant.logo_url);
                                          return (
                                        <div
                                          key={`${match.id}-${index}-${entrant.id}`}
                                          className="relative h-full w-full overflow-hidden"
                                        >
                                          {entrant.image_url ? (
                                            <Image
                                              src={entrant.image_url}
                                              alt={entrant.name}
                                              fill
                                              sizes="(min-width: 1024px) 220px, 33vw"
                                              className="object-cover"
                                            />
                                          ) : (
                                            <div className="h-full w-full bg-gradient-to-b from-zinc-800 via-zinc-900 to-black" />
                                          )}
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                          <div
                                            className={`absolute inset-x-0 bottom-0 z-10 p-2 text-center ${
                                              hasLogo ? "translate-y-8" : "translate-y-1"
                                            }`}
                                          >
                                            <div
                                              className={`mx-auto flex max-w-[9rem] flex-col items-center gap-1 ${
                                                hasLogo ? "pt-12" : "pt-0"
                                              }`}
                                            >
                                              {entrant.logo_url ? (
                                                <span className="relative inline-flex h-32 w-32 items-center justify-center rounded-full p-3 drop-shadow">
                                                  <Image
                                                    src={entrant.logo_url}
                                                    alt={`${entrant.name} logo`}
                                                    width={128}
                                                    height={128}
                                                    className="h-32 w-32 object-contain"
                                                  />
                                                </span>
                                              ) : (
                                                <span className="block text-[13px] font-semibold uppercase leading-[0.95] tracking-[0.18em] text-zinc-100 drop-shadow">
                                                  {entrant.name}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                          );
                                        })()
                                      ))
                                    ) : (
                                      <div className="h-full w-full bg-gradient-to-b from-zinc-800 via-zinc-900 to-black" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {matchupSides.length === 3 ? (
                            <>
                              <div className="pointer-events-none absolute inset-y-0 left-1/3 w-px -translate-x-1/2 bg-white/15" />
                              <div className="pointer-events-none absolute inset-y-0 left-2/3 w-px -translate-x-1/2 bg-white/15" />
                            </>
                          ) : (
                            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/15" />
                          )}
                          <div
                            className={`pointer-events-none absolute inset-0 z-10 flex justify-center ${
                              matchupSides.length === 3 ? "items-end pb-10" : "items-center"
                            }`}
                          >
                            {matchupSides.length === 3 ? (
                              <>
                                <div className="absolute left-1/3 -translate-x-1/2">
                                  {isPrestige ? (
                                    <div className="relative flex items-center justify-center">
                                      <span className="relative inline-flex h-11 w-12 items-center justify-center text-[11px] font-bold uppercase tracking-[0.2em] text-amber-100 drop-shadow-[0_0_18px_rgba(198,162,74,0.35)]">
                                        <svg
                                          className="absolute inset-0 h-full w-full"
                                          viewBox="0 0 64 72"
                                          aria-hidden="true"
                                        >
                                          <path
                                            d="M8 6h48l4 10v22c0 18-12.5 27.5-28 28C16.5 65.5 4 56 4 38V16l4-10z"
                                            fill="#000000"
                                            stroke="#C6A24A"
                                            strokeWidth="3"
                                          />
                                        </svg>
                                        <span className="relative z-10">VS</span>
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="rounded-full bg-black px-2.5 py-1 text-[10px] uppercase tracking-[0.35em] text-amber-200 shadow-lg">
                                      VS
                                    </span>
                                  )}
                                </div>
                                <div className="absolute left-2/3 -translate-x-1/2">
                                  {isPrestige ? (
                                    <div className="relative flex items-center justify-center">
                                      <span className="relative inline-flex h-11 w-12 items-center justify-center text-[11px] font-bold uppercase tracking-[0.2em] text-amber-100 drop-shadow-[0_0_18px_rgba(198,162,74,0.35)]">
                                        <svg
                                          className="absolute inset-0 h-full w-full"
                                          viewBox="0 0 64 72"
                                          aria-hidden="true"
                                        >
                                          <path
                                            d="M8 6h48l4 10v22c0 18-12.5 27.5-28 28C16.5 65.5 4 56 4 38V16l4-10z"
                                            fill="#000000"
                                            stroke="#C6A24A"
                                            strokeWidth="3"
                                          />
                                        </svg>
                                        <span className="relative z-10">VS</span>
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="rounded-full bg-black px-2.5 py-1 text-[10px] uppercase tracking-[0.35em] text-amber-200 shadow-lg">
                                      VS
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : isPrestige ? (
                              <div className="relative flex items-center justify-center">
                                <span className="relative inline-flex h-14 w-16 items-center justify-center text-sm font-bold uppercase tracking-[0.25em] text-amber-100 drop-shadow-[0_0_22px_rgba(198,162,74,0.35)]">
                                  <svg
                                    className="absolute inset-0 h-full w-full"
                                    viewBox="0 0 64 72"
                                    aria-hidden="true"
                                  >
                                    <path
                                      d="M8 6h48l4 10v22c0 18-12.5 27.5-28 28C16.5 65.5 4 56 4 38V16l4-10z"
                                      fill="#000000"
                                      stroke="#C6A24A"
                                      strokeWidth="3"
                                    />
                                  </svg>
                                  <span className="relative z-10">VS</span>
                                </span>
                              </div>
                            ) : (
                              <span className="rounded-full bg-black px-3 py-1 text-ms lg:text-lg uppercase tracking-[0.4em] text-amber-200 shadow-lg">
                                VS
                              </span>
                            )}
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-zinc-950/20" />
                          {!isLocked &&
                            matchupSides.map((sideEntry, index) => {
                              const isSelected =
                                payload.match_picks[match.id] ===
                                sideEntry.side.id;
                              const widthClass =
                                matchupSides.length === 3 ? "w-1/3" : "w-1/2";
                              const leftClass =
                                matchupSides.length === 3
                                  ? index === 0
                                    ? "left-0"
                                    : index === 1
                                      ? "left-1/3"
                                      : "left-2/3"
                                  : index === 0
                                    ? "left-0"
                                    : "right-0";
                              return (
                                <button
                                  key={`${match.id}-pick-${sideEntry.side.id}`}
                                  type="button"
                                  className={`absolute top-0 h-full ${widthClass} ${leftClass} transition ${
                                    isSelected
                                      ? "bg-amber-400/20 ring-2 ring-amber-300 shadow-[0_0_20px_rgba(251,196,0,0.35)]"
                                      : "hover:bg-white/5"
                                  }`}
                                  onClick={() =>
                                    sideEntry.side.id
                                      ? handleSelectWinner(sideEntry.side.id)
                                      : undefined
                                  }
                                  aria-label={`Select ${sideEntry.label ?? `Side ${index + 1}`} as winner`}
                                />
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-4">
                <div id={bonusSectionId} className="scroll-mt-6">
                  <BonusPicksAccordion
                    defaultOpen={false}
                  summaryText={
                    hasBonusPick
                      ? `Saved · +${bonusPointsTotal} pts`
                      : `+${bonusPointsTotal} pts`
                  }
                  status={bonusStatus}
                >
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                          Match length
                        </p>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-200/80">
                          +{scoringRules.match_length} pts
                        </span>
                      </div>
                        <SegmentedPills
                        options={lengthOptions}
                        selectedValue={lengthPick}
                        disabled={isLocked}
                        onSelect={(value) =>
                          setPayload((prev): PicksPayload => ({
                            ...prev,
                            match_length_picks: {
                              ...prev.match_length_picks,
                              [match.id]: value as
                                | "sprint"
                                | "standard"
                                | "epic",
                            },
                          }))
                        }
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                          Finish type
                        </p>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-200/80">
                          +{scoringRules.match_finish_method} pts
                        </span>
                      </div>
                      <SegmentedPills
                        options={finishOptions}
                        selectedValue={finishPick.method}
                        disabled={isLocked || !hasWinnerPick}
                        onSelect={(value) => {
                          const method = value;
                          setPayload((prev) => ({
                            ...prev,
                            match_finish_picks: {
                              ...prev.match_finish_picks,
                              [match.id]: {
                                method,
                                winner:
                                  !isSingles &&
                                  (method === "pinfall" || method === "submission")
                                    ? finishPick.winner
                                    : null,
                                loser:
                                  !isSingles &&
                                  (method === "pinfall" || method === "submission")
                                    ? finishPick.loser
                                    : null,
                              },
                            },
                          }));
                        }}
                        className="mt-2"
                      />
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        {showFinishWinner && (
                          <select
                            className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                            value={finishPick.winner ?? ""}
                            onChange={(event) =>
                              setPayload((prev) => ({
                                ...prev,
                                match_finish_picks: {
                                  ...prev.match_finish_picks,
                                  [match.id]: {
                                    ...finishPick,
                                    winner: event.target.value || null,
                                  },
                                },
                              }))
                            }
                            disabled={
                              isLocked ||
                              !hasWinnerPick ||
                              !finishRequiresEntrants ||
                              (isTag && !winningSideId)
                            }
                          >
                            <option value="">Winner (pin/sub)</option>
                            {(isTag ? winningSideEntrants : sortedEntrants).map(
                              (entrant) => (
                                <option key={entrant.id} value={entrant.id}>
                                  {entrant.name}
                                </option>
                              )
                            )}
                          </select>
                        )}
                        {showFinishLoser && (
                          <select
                            className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                            value={finishPick.loser ?? ""}
                            onChange={(event) =>
                              setPayload((prev) => ({
                                ...prev,
                                match_finish_picks: {
                                  ...prev.match_finish_picks,
                                  [match.id]: {
                                    ...finishPick,
                                    loser: event.target.value || null,
                                  },
                                },
                              }))
                            }
                            disabled={
                              isLocked ||
                              !hasWinnerPick ||
                              !finishRequiresEntrants ||
                              (isTag && !winningSideId)
                            }
                          >
                            <option value="">Loser (pin/sub)</option>
                            {(isTag ? losingSideEntrants : sortedEntrants).map(
                              (entrant) => (
                                <option key={entrant.id} value={entrant.id}>
                                  {entrant.name}
                                </option>
                              )
                            )}
                          </select>
                        )}
                      </div>
                      {finishRequiresEntrants && (showFinishWinner || showFinishLoser) && (
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
                          {showFinishWinner && (
                            <span>Winner +{scoringRules.match_finish_winner} pts</span>
                          )}
                          {showFinishLoser && (
                            <span>Loser +{scoringRules.match_finish_loser} pts</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                          Interference
                        </p>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-200/80">
                          +{scoringRules.match_interference} pts
                        </span>
                      </div>
                      <SegmentedPills
                        options={interferenceOptions}
                        selectedValue={interferencePick}
                        disabled={isLocked || !hasWinnerPick}
                        onSelect={(value) =>
                          setPayload((prev) => ({
                            ...prev,
                            match_interference_picks: {
                              ...prev.match_interference_picks,
                              [match.id]: value as "yes" | "no",
                            },
                          }))
                        }
                        className="mt-2"
                      />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    Bonus picks can earn extra points.
                  </p>
                  </BonusPicksAccordion>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
    {hasSaved && (
      <div className="mt-6">
        <button
          className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
          type="button"
          onClick={onSave}
          disabled={saving || isLocked}
        >
          {saving ? "Saving…" : "Save match picks"}
        </button>
      </div>
    )}
  </section>
);

type KeyPicksEditorProps = {
  event: EventRow;
  eventPick: RumblePick;
  selectedEntrants: EntrantRow[];
  selectedFinalFour: EntrantRow[];
  isLocked: boolean;
  hasSaved: boolean;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  onPickChange: (fieldKey: string, value: string | null) => void;
  sectionRef?: Ref<HTMLDivElement>;
};

export const KeyPicksEditor = ({
  event,
  eventPick,
  selectedEntrants,
  selectedFinalFour,
  isLocked,
  hasSaved,
  onCancel,
  onSave,
  saving,
  onPickChange,
  sectionRef,
}: KeyPicksEditorProps) => (
  <section
    ref={sectionRef}
    className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          {event.rumble_gender ? `${event.rumble_gender} rumble` : "Rumble"}
        </p>
        <h2 className="text-lg font-semibold">Key Picks</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Choose your winner and entry position picks.
        </p>
      </div>
      {hasSaved && (
        <button
          className="text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
    </div>
    <div className="mt-4 space-y-4">
      {getKeyPickFields(event.rumble_gender).map((field) => (
        <label key={field.key} className="flex flex-col text-sm text-zinc-300">
          {field.label}
          <select
            className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
            value={
              (eventPick[field.key as keyof RumblePick] as string | null) ?? ""
            }
            onChange={(eventChange) =>
              onPickChange(field.key, eventChange.target.value || null)
            }
            disabled={isLocked}
          >
            <option value="">Select</option>
            {(field.key === "winner" ? selectedFinalFour : selectedEntrants).map(
              (entrant) => (
                <option key={entrant.id} value={entrant.id}>
                  {entrant.name}
                </option>
              )
            )}
          </select>
        </label>
      ))}
    </div>
    {hasSaved && (
      <div className="mt-6">
        <button
          className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
          type="button"
          onClick={onSave}
          disabled={saving || isLocked}
        >
          {saving ? "Saving…" : "Save key picks"}
        </button>
      </div>
    )}
  </section>
);

type SavePicksFooterProps = {
  saving: boolean;
  isLocked: boolean;
  onSave: () => void;
};

export const SavePicksFooter = ({
  saving,
  isLocked,
  onSave,
}: SavePicksFooterProps) => (
  <section className="mt-8 flex flex-col items-start gap-3">
    <button
      className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
      type="button"
      onClick={onSave}
      disabled={saving || isLocked}
    >
      {saving ? "Saving…" : "Save picks"}
    </button>
    <p className="text-xs text-zinc-500">
      Your picks can be updated until the show locks.
    </p>
  </section>
);

type CustomEntrantModalProps = {
  open: boolean;
  event: EventRow | null;
  entrantName: string;
  setEntrantName: (value: string) => void;
  isLocked: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

export const CustomEntrantModal = ({
  open,
  event,
  entrantName,
  setEntrantName,
  isLocked,
  onClose,
  onSubmit,
}: CustomEntrantModalProps) =>
  open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Add custom entrant</h3>
          <button
            className="text-sm text-zinc-400 transition hover:text-zinc-200"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {event && (
          <p className="mt-1 text-xs text-zinc-500">For {event.name}</p>
        )}
        <p className="mt-2 text-sm text-zinc-400">
          Custom entrants require admin approval before they show up for everyone.
        </p>
        <input
          className="mt-4 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-base text-zinc-100"
          placeholder="Entrant name"
          value={entrantName}
          onChange={(eventChange) => setEntrantName(eventChange.target.value)}
          autoFocus
        />
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-full bg-amber-400 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
            type="button"
            onClick={onSubmit}
            disabled={isLocked}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  ) : null;

const EditIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

const ChevronIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
