"use client";

import type { Dispatch, Ref, SetStateAction } from "react";
import { EntrantCard } from "./EntrantCard";
import { scoringRules } from "../lib/scoringRules";
import { KEY_PICK_FIELDS } from "../lib/picksCopy";
import type {
  EditSection,
  EntrantRow,
  EventActuals,
  EventRow,
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
  <header className="flex flex-col gap-2">
    <h1 className="text-3xl font-semibold">{title}</h1>
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
      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200">
        <p className="font-semibold text-amber-200">{lockInfo.label}</p>
        <p className="mt-1 text-xs text-zinc-400">{lockInfo.detail}</p>
      </div>
    )}
    {isLocked && (
      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200">
        {rankInfo.rank ? (
          <span>
            Your current rank:{" "}
            <span className="font-semibold text-amber-200">
              #{rankInfo.rank}
            </span>{" "}
            of {rankInfo.total}
          </span>
        ) : (
          <span className="text-zinc-400">
            Your rank will appear once scores are calculated for this show.
          </span>
        )}
      </div>
    )}
    {isLocked && (
      <div className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
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
  onChange: (showId: string) => void;
};

export const ShowSelector = ({
  shows,
  selectedShowId,
  onChange,
}: ShowSelectorProps) => (
  <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
    <label className="text-sm text-zinc-300">
      Show
      <select
        className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
        value={selectedShowId}
        onChange={(event) => onChange(event.target.value)}
      >
        {shows.length === 0 && <option value="">No shows yet</option>}
        {shows.map((show) => (
          <option key={show.id} value={show.id}>
            {show.name}
          </option>
        ))}
      </select>
    </label>
  </section>
);

type RumbleSummarySectionProps = {
  event: EventRow;
  eventPick: RumblePick;
  actuals: EventActuals;
  points: SectionPoints;
  entrantByIdAll: Map<string, EntrantRow>;
  userId: string | null;
  isLocked: boolean;
  onEdit: (section: Exclude<EditSection, "matches" | null>) => void;
};

export const RumbleSummarySection = ({
  event,
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

  const renderPickList = (
    ids: string[],
    correctSet: Set<string>,
    pointValue: number,
    actualsHasData: boolean
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
            const isCorrect = actualsHasData && correctSet.has(id);
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
                  !actualsHasData
                    ? "border-zinc-800"
                    : isCorrect
                      ? "border-emerald-400/60 bg-emerald-400/10"
                      : "border-red-500/50 bg-red-500/10"
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
                {actualsHasData && (
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
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          {event.rumble_gender ? `${event.rumble_gender} rumble` : "Rumble"}
        </p>
        <h2 className="text-xl font-semibold">{event.name}</h2>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Entrants</h3>
            <button
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:text-amber-100 disabled:cursor-not-allowed disabled:text-zinc-600"
              type="button"
              onClick={() => onEdit("entrants")}
              disabled={isLocked}
            >
              <EditIcon />
              Edit
            </button>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            {eventPick.entrants.length} selected
          </p>
          {points.entrants !== null && (
            <p className="mt-1 text-xs text-emerald-200">
              Points: {points.entrants}
            </p>
          )}
          {renderPickList(
            eventPick.entrants,
            actuals.entrantSet,
            scoringRules.entrants,
            actuals.hasData
          )}
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Final Four</h3>
            <button
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:text-amber-100 disabled:cursor-not-allowed disabled:text-zinc-600"
              type="button"
              onClick={() => onEdit("final_four")}
              disabled={isLocked}
            >
              <EditIcon />
              Edit
            </button>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            {eventPick.final_four.length} selected
          </p>
          {points.finalFour !== null && (
            <p className="mt-1 text-xs text-emerald-200">
              Points: {points.finalFour}
            </p>
          )}
          {renderPickList(
            eventPick.final_four,
            actuals.finalFourSet,
            scoringRules.final_four,
            actuals.hasData
          )}
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Key Picks</h3>
            <button
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:text-amber-100 disabled:cursor-not-allowed disabled:text-zinc-600"
              type="button"
              onClick={() => onEdit("key_picks")}
              disabled={isLocked}
            >
              <EditIcon />
              Edit
            </button>
          </div>
          {points.keyPicks !== null && (
            <p className="mt-2 text-xs text-emerald-200">
              Points: {points.keyPicks}
            </p>
          )}
          <div className="mt-4 space-y-3 text-sm text-zinc-200">
            {[
              ["Winner", eventPick.winner, actuals.winner, scoringRules.winner],
              ["Entry #1", eventPick.entry_1, actuals.entry1, scoringRules.entry_1],
              ["Entry #2", eventPick.entry_2, actuals.entry2, scoringRules.entry_2],
              ["Entry #30", eventPick.entry_30, actuals.entry30, scoringRules.entry_30],
              [
                "Most eliminations",
                eventPick.most_eliminations,
                null,
                scoringRules.most_eliminations,
              ],
            ].map(([label, value, actual, pointsValue]) => {
              const entrant = value ? getEntrant(String(value)) : null;
              const isCorrect =
                actuals.hasData &&
                (label === "Most eliminations"
                  ? value && actuals.topElims.has(String(value))
                  : value && actual === value);
              return (
                <div
                  key={label as string}
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
                    imageUrl={entrant?.image_url}
                    className="justify-end"
                  />
                  {actuals.hasData && (
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
      </div>
    </section>
  );
};

type RumbleEntrantsEditorProps = {
  event: EventRow;
  eventPick: RumblePick;
  grouped: Record<string, EntrantRow[]>;
  count: number;
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
                      disabled={isLocked}
                    />
                    <EntrantCard
                      name={entrant.name}
                      promotion={entrant.promotion}
                      imageUrl={entrant.image_url}
                      className="flex-1"
                    />
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
          const pickLabel = pickSide?.label?.trim() || "Selected side";
          const pickEntrants = pick
            ? (matchEntrantsByMatch[match.id] ?? [])
                .filter((row) => row.side_id === pick)
                .map((row) => entrantByIdAll.get(row.entrant_id))
                .filter(Boolean)
            : [];
          const entrantCount = (matchEntrantsByMatch[match.id] ?? []).length;
          const finishPick = payload.match_finish_picks[match.id];
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
                    {isCorrect
                      ? `+${scoringRules.match_winner} pts`
                      : "0 pts"}
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
);

type MatchPicksSectionProps = {
  matches: MatchRow[];
  matchSidesByMatch: Record<string, MatchSideRow[]>;
  matchEntrantsByMatch: Record<string, MatchEntrantRow[]>;
  entrantByIdAll: Map<string, EntrantRow>;
  payload: PicksPayload;
  setPayload: Dispatch<SetStateAction<PicksPayload>>;
  isLocked: boolean;
  hasSaved: boolean;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
};

export const MatchPicksSection = ({
  matches,
  matchSidesByMatch,
  matchEntrantsByMatch,
  entrantByIdAll,
  payload,
  setPayload,
  isLocked,
  hasSaved,
  onCancel,
  onSave,
  saving,
}: MatchPicksSectionProps) => (
  <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">Match Picks</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Pick winners for the matches on the card.
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
          const matchType = match.match_type;
          const isSingles = matchType === "singles";
          const isTripleOrFatal =
            matchType === "triple_threat" || matchType === "fatal_4_way";
          const isTag = matchType === "tag";
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

          return (
            <div
              key={match.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                    {match.kind}
                  </p>
                  <p className="text-sm font-semibold text-zinc-100">
                    {match.name}
                  </p>
                </div>
                <select
                  className="h-10 min-w-[220px] rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                  value={payload.match_picks[match.id] ?? ""}
                  onChange={(event) =>
                    setPayload((prev) => ({
                      ...prev,
                      match_picks: {
                        ...prev.match_picks,
                        [match.id]: event.target.value || null,
                      },
                    }))
                  }
                  disabled={isLocked || sideEntries.length === 0}
                >
                  <option value="">Select winner</option>
                  {sideEntries.map(({ side, label, entrants }) => (
                    <option key={side.id} value={side.id}>
                      {label}
                      {entrants.length > 0
                        ? ` — ${entrants.map((entrant) => entrant.name).join(", ")}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              {sideEntries.length === 0 && (
                <p className="mt-2 text-xs text-zinc-500">
                  Add match participants in admin to enable picks.
                </p>
              )}
              {sideEntries.length > 0 && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {sideEntries.map(({ side, label, entrants }) => (
                    <div
                      key={side.id}
                      className={`rounded-xl border px-3 py-2 ${
                        payload.match_picks[match.id] === side.id
                          ? "border-amber-400/60 bg-amber-400/10"
                          : "border-zinc-800 bg-zinc-900/60"
                      }`}
                    >
                      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                        {label}
                      </p>
                      {entrants.length === 0 ? (
                        <p className="mt-2 text-xs text-zinc-500">No participants.</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {entrants.map((entrant) => (
                            <EntrantCard
                              key={entrant.id}
                              name={entrant.name}
                              promotion={entrant.promotion}
                              imageUrl={entrant.image_url}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {(allEntrants.length > 2 || isSingles) && (
                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                    Finish prediction
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <select
                      className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                      value={finishPick.method ?? ""}
                      onChange={(event) => {
                        const method = event.target.value || null;
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
                      disabled={isLocked}
                    >
                      <option value="">Select finish</option>
                      <option value="pinfall">Pinfall</option>
                      <option value="submission">Submission</option>
                      <option value="disqualification">Disqualification</option>
                    </select>
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
                          !finishRequiresEntrants ||
                          (isTag && !winningSideId)
                        }
                      >
                        <option value="">Loser (pin/sub)</option>
                        {(isTag ? losingSideEntrants : sortedEntrants).map((entrant) => (
                          <option key={entrant.id} value={entrant.id}>
                            {entrant.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Only required for matches with more than two entrants.
                  </p>
                </div>
              )}
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
      {KEY_PICK_FIELDS.map((field) => (
        <label key={field.key} className="flex flex-col text-sm text-zinc-300">
          {field.label}
          <select
            className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
            value={(eventPick as Record<string, string | null>)[field.key] ?? ""}
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
