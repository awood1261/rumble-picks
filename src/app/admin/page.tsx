"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { EntrantCard } from "../../components/EntrantCard";
import { ShowEditor } from "../../components/ShowEditor";
import { calculateScore, type PicksPayload } from "../../lib/scoring";
import { scoringRules } from "../../lib/scoringRules";
import {
  buildShowHref,
  isValidSlug,
  normalizeSlug,
} from "../../lib/friendlyUrls";

type EventRow = {
  id: string;
  name: string;
  status: string;
  rumble_gender: string | null;
  roster_year: number | null;
  show_id: string | null;
  iron_person_entrant_id?: string | null;
  order_index?: number | null;
};

type EliminatorRow = {
  id: string;
  name: string;
  status: string;
  roster_year: number | null;
  roster_gender: string | null;
  entrant_limit: number;
  show_id: string | null;
  order_index?: number | null;
  winner_entrant_id?: string | null;
};

type ShowRow = {
  id: string;
  name: string;
  slug?: string | null;
  tagline?: string | null;
  image_url: string | null;
  promotion_id: string | null;
  starts_at: string | null;
  status: string;
  requires_email_registration?: boolean | null;
  lock_picks_at_start?: boolean | null;
  is_featured_play_show?: boolean | null;
  is_over?: boolean | null;
  use_confidence_points?: boolean | null;
  requires_location_verification?: boolean | null;
  venue_name?: string | null;
  venue_address?: string | null;
  venue_latitude?: number | null;
  venue_longitude?: number | null;
  location_radius_meters?: number | null;
};

type PromotionRow = {
  id: string;
  name: string;
  slug?: string | null;
  image_url: string | null;
};

type EntrantRow = {
  id: string;
  name: string;
  promotion: string | null;
  gender: string | null;
  active: boolean;
  image_url: string | null;
  logo_url?: string | null;
  roster_year: number | null;
  event_id: string | null;
  is_custom: boolean;
  created_by: string | null;
  status: string | null;
};

type RumbleEntryRow = {
  id: string;
  entrant_id: string;
  entry_number: number | null;
  eliminated_by: string | null;
  eliminated_at: string | null;
  eliminations_count: number;
  is_confirmed?: boolean;
};

type EventActionLogRow = {
  id: string;
  event_id: string;
  action_type: string;
  payload: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

type MatchRow = {
  id: string;
  name: string;
  kind: string;
  match_type: string;
  status: string;
  is_main_event?: boolean | null;
  is_championship?: boolean | null;
  championship_name?: string | null;
  championship_image_url?: string | null;
  champion_side_id?: string | null;
  known_wrestler_id?: string | null;
  gauntlet_survival_result?: boolean | null;
  gauntlet_final_entrant_id?: string | null;
  winner_entrant_id: string | null;
  winner_side_id: string | null;
  finish_method: string | null;
  finish_winner_entrant_id: string | null;
  finish_loser_entrant_id: string | null;
  match_length?: string | null;
  match_interference?: string | null;
  roster_year: number | null;
  roster_gender: string | null;
  event_id: string | null;
  show_id: string | null;
  order_index?: number | null;
};

type MatchSideRow = {
  id: string;
  match_id: string;
  label: string | null;
  image_url: string | null;
};

type MatchEntrantRow = {
  id: string;
  match_id: string;
  entrant_id: string;
  side_id: string | null;
};

type GauntletEntrantRow = {
  id: string;
  match_id: string;
  entrant_id: string;
};

type EliminatorEntryRow = {
  id: string;
  eliminator_id: string;
  entrant_id: string;
  entry_order: number | null;
};

type EliminatorEliminationRow = {
  id: string;
  eliminator_id: string;
  eliminated_entrant_id: string;
  eliminated_by_entrant_id: string | null;
  elimination_type: "pinfall" | "submission";
  elimination_order: number;
};

const ENTRANT_SELECT =
  "id, name, promotion, gender, active, image_url, logo_url, roster_year, event_id, is_custom, created_by, status";
const ENTRANT_PAGE_SIZE = 1000;
type AdminView =
  | "dashboard"
  | "setup"
  | "card"
  | "results"
  | "scoreboard"
  | "advanced";

async function loadAllEntrants() {
  const rows: EntrantRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("entrants")
      .select(ENTRANT_SELECT)
      .range(from, from + ENTRANT_PAGE_SIZE - 1)
      .order("name", { ascending: true });

    if (error) {
      return { data: null, error };
    }

    const batch = (data ?? []) as EntrantRow[];
    rows.push(...batch);

    if (batch.length < ENTRANT_PAGE_SIZE) {
      return { data: rows, error: null };
    }

    from += ENTRANT_PAGE_SIZE;
  }
}

type ShowQuestionRow = {
  id: string;
  show_id: string | null;
  image_url: string | null;
  question: string;
  answers: string[];
  correct_answer?: string | null;
  order_index?: number | null;
  created_at?: string;
};

type PickRow = {
  id: string;
  user_id: string;
  payload: Record<string, unknown> | null;
};

type ShowLocationGateForm = {
  requiresLocationVerification: boolean;
  venueName: string;
  venueAddress: string;
  venueLatitude: string;
  venueLongitude: string;
  locationRadiusMeters: string;
};

type ShowLocationGatePayload = {
  requires_location_verification: boolean;
  venue_name: string | null;
  venue_address: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  location_radius_meters: number | null;
};

type ShowLocationGateResult =
  | { payload: ShowLocationGatePayload }
  | { error: string };

const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return { value: null, error: false };
  const parsed = Number(trimmed);
  return Number.isFinite(parsed)
    ? { value: parsed, error: false }
    : { value: null, error: true };
};

const buildShowLocationGatePayload = (
  form: ShowLocationGateForm
): ShowLocationGateResult => {
  const latitude = parseOptionalNumber(form.venueLatitude);
  const longitude = parseOptionalNumber(form.venueLongitude);
  const radius = parseOptionalNumber(form.locationRadiusMeters);

  if (
    latitude.error ||
    (latitude.value !== null && (latitude.value < -90 || latitude.value > 90))
  ) {
    return { error: "Venue latitude must be a number between -90 and 90." };
  }
  if (
    longitude.error ||
    (longitude.value !== null &&
      (longitude.value < -180 || longitude.value > 180))
  ) {
    return { error: "Venue longitude must be a number between -180 and 180." };
  }
  if (
    radius.error ||
    (radius.value !== null &&
      (!Number.isInteger(radius.value) || radius.value <= 0))
  ) {
    return {
      error: "Location radius must be a positive whole number of meters.",
    };
  }
  if (
    form.requiresLocationVerification &&
    (latitude.value === null ||
      longitude.value === null ||
      radius.value === null)
  ) {
    return {
      error:
        "Location-gated shows require venue latitude, longitude, and radius.",
    };
  }

  return {
    payload: {
      requires_location_verification: form.requiresLocationVerification,
      venue_name: form.venueName.trim() || null,
      venue_address: form.venueAddress.trim() || null,
      venue_latitude: latitude.value,
      venue_longitude: longitude.value,
      location_radius_meters: radius.value,
    },
  };
};

export default function AdminPage() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [eliminators, setEliminators] = useState<EliminatorRow[]>([]);
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [entrants, setEntrants] = useState<EntrantRow[]>([]);
  const [entries, setEntries] = useState<RumbleEntryRow[]>([]);
  const [entriesSnapshot, setEntriesSnapshot] = useState<RumbleEntryRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [showMatches, setShowMatches] = useState<MatchRow[]>([]);
  const [matchSides, setMatchSides] = useState<MatchSideRow[]>([]);
  const [matchEntrants, setMatchEntrants] = useState<MatchEntrantRow[]>([]);
  const [gauntletCandidateEntrants, setGauntletCandidateEntrants] = useState<
    GauntletEntrantRow[]
  >([]);
  const [gauntletActualEntrants, setGauntletActualEntrants] = useState<
    GauntletEntrantRow[]
  >([]);
  const [eliminatorEntries, setEliminatorEntries] = useState<
    EliminatorEntryRow[]
  >([]);
  const [showQuestions, setShowQuestions] = useState<ShowQuestionRow[]>([]);
  const [eliminatorEliminations, setEliminatorEliminations] = useState<
    EliminatorEliminationRow[]
  >([]);
  const [eventLogs, setEventLogs] = useState<EventActionLogRow[]>([]);
  const [eventLogOpen, setEventLogOpen] = useState(false);
  const [eventLogBusy, setEventLogBusy] = useState(false);

  const [eventName, setEventName] = useState("");
  const [eventGender, setEventGender] = useState("men");
  const [eventRosterYear, setEventRosterYear] = useState("");
  const [eventShowId, setEventShowId] = useState("");
  const [eventIronPersonId, setEventIronPersonId] = useState("");
  const [eliminatorName, setEliminatorName] = useState("");
  const [eliminatorRosterYear, setEliminatorRosterYear] = useState("");
  const [eliminatorRosterGender, setEliminatorRosterGender] = useState("men");
  const [eliminatorEntrantLimit, setEliminatorEntrantLimit] = useState("6");
  const [eliminatorCreateOpen, setEliminatorCreateOpen] = useState(false);
  const [eliminatorEntrantId, setEliminatorEntrantId] = useState("");
  const [eliminatorEliminatedId, setEliminatorEliminatedId] = useState("");
  const [eliminatorEliminatedById, setEliminatorEliminatedById] = useState("");
  const [eliminatorEliminationType, setEliminatorEliminationType] =
    useState<"pinfall" | "submission">("pinfall");
  const [eliminatorEliminationOrder, setEliminatorEliminationOrder] =
    useState("");
  const [showName, setShowName] = useState("");
  const [showSlug, setShowSlug] = useState("");
  const [showPromotionId, setShowPromotionId] = useState("");
  const [showImageUrl, setShowImageUrl] = useState("");
  const [showStartsAt, setShowStartsAt] = useState("");
  const [showTagline, setShowTagline] = useState("");
  const [showRequiresEmail, setShowRequiresEmail] = useState(true);
  const [showLockPicksAtStart, setShowLockPicksAtStart] = useState(true);
  const [showIsFeaturedPlayShow, setShowIsFeaturedPlayShow] = useState(false);
  const [showIsOver, setShowIsOver] = useState(false);
  const [showUseConfidencePoints, setShowUseConfidencePoints] = useState(false);
  const [showRequiresLocationVerification, setShowRequiresLocationVerification] =
    useState(false);
  const [showVenueName, setShowVenueName] = useState("");
  const [showVenueAddress, setShowVenueAddress] = useState("");
  const [showVenueLatitude, setShowVenueLatitude] = useState("");
  const [showVenueLongitude, setShowVenueLongitude] = useState("");
  const [showLocationRadiusMeters, setShowLocationRadiusMeters] = useState("");
  const [showModalOpen, setShowModalOpen] = useState(false);
  const [promotionModalOpen, setPromotionModalOpen] = useState(false);
  const [promotionName, setPromotionName] = useState("");
  const [promotionSlug, setPromotionSlug] = useState("");
  const [promotionImageUrl, setPromotionImageUrl] = useState("");
  const [showEditName, setShowEditName] = useState("");
  const [showEditSlug, setShowEditSlug] = useState("");
  const [showEditPromotionId, setShowEditPromotionId] = useState("");
  const [showEditImageUrl, setShowEditImageUrl] = useState("");
  const [showEditStartsAt, setShowEditStartsAt] = useState("");
  const [showEditTagline, setShowEditTagline] = useState("");
  const [showEditRequiresEmail, setShowEditRequiresEmail] = useState(true);
  const [showEditLockPicksAtStart, setShowEditLockPicksAtStart] = useState(true);
  const [showEditIsFeaturedPlayShow, setShowEditIsFeaturedPlayShow] = useState(false);
  const [showEditIsOver, setShowEditIsOver] = useState(false);
  const [showEditUseConfidencePoints, setShowEditUseConfidencePoints] =
    useState(false);
  const [
    showEditRequiresLocationVerification,
    setShowEditRequiresLocationVerification,
  ] = useState(false);
  const [showEditVenueName, setShowEditVenueName] = useState("");
  const [showEditVenueAddress, setShowEditVenueAddress] = useState("");
  const [showEditVenueLatitude, setShowEditVenueLatitude] = useState("");
  const [showEditVenueLongitude, setShowEditVenueLongitude] = useState("");
  const [showEditLocationRadiusMeters, setShowEditLocationRadiusMeters] =
    useState("");
  const [showEditBusy, setShowEditBusy] = useState(false);
  const [showDeleteBusy, setShowDeleteBusy] = useState(false);
  const [eventUpdateBusy, setEventUpdateBusy] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedShowId, setSelectedShowId] = useState<string>("");
  const [adminView, setAdminView] = useState<AdminView>("dashboard");
  const [adminTab, setAdminTab] = useState<
    "events" | "eliminators" | "questions"
  >("events");
  const [newQuestionImageUrl, setNewQuestionImageUrl] = useState("");
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionAnswerInput, setNewQuestionAnswerInput] = useState("");
  const [newQuestionAnswers, setNewQuestionAnswers] = useState<string[]>([]);
  const [questionImageEdits, setQuestionImageEdits] = useState<Record<string, string>>({});
  const [questionTextEdits, setQuestionTextEdits] = useState<Record<string, string>>({});
  const [questionAnswerEdits, setQuestionAnswerEdits] = useState<Record<string, string>>({});
  const [questionCorrectAnswerEdits, setQuestionCorrectAnswerEdits] = useState<
    Record<string, string>
  >({});
  const [focusedEventId, setFocusedEventId] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [entryEntrantId, setEntryEntrantId] = useState("");
  const [entryNumber, setEntryNumber] = useState("");
  const [entryConfirmed, setEntryConfirmed] = useState(false);
  const [eliminateEntryId, setEliminateEntryId] = useState("");
  const [eliminatedById, setEliminatedById] = useState("");
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [clearScoresBusy, setClearScoresBusy] = useState(false);
  const [bulkEntrySaveBusy, setBulkEntrySaveBusy] = useState(false);
  const [customEntrantName, setCustomEntrantName] = useState("");
  const [matchName, setMatchName] = useState("");
  const [matchKind, setMatchKind] = useState("match");
  const [matchType, setMatchType] = useState("singles");
  const [matchRosterYear, setMatchRosterYear] = useState("");
  const [matchRosterGender, setMatchRosterGender] = useState("men");
  const [matchIsMainEvent, setMatchIsMainEvent] = useState(false);
  const [matchIsChampionship, setMatchIsChampionship] = useState(false);
  const [matchChampionshipName, setMatchChampionshipName] = useState("");
  const [matchChampionshipImageUrl, setMatchChampionshipImageUrl] = useState("");
  const [matchKnownWrestlerId, setMatchKnownWrestlerId] = useState("");
  const [matchCandidateIds, setMatchCandidateIds] = useState<string[]>([]);
  const [matchCreateOpen, setMatchCreateOpen] = useState(false);
  const [focusedMatchId, setFocusedMatchId] = useState<string | null>(null);
  const [matchEntrantSelection, setMatchEntrantSelection] = useState<Record<string, string>>({});
  const [matchSideSelection, setMatchSideSelection] = useState<Record<string, string>>({});
  const [matchParticipantSearch, setMatchParticipantSearch] = useState<
    Record<string, string>
  >({});
  const [matchNameEdits, setMatchNameEdits] = useState<Record<string, string>>({});
  const [matchMainEventEdits, setMatchMainEventEdits] = useState<
    Record<string, boolean>
  >({});
  const [matchChampionshipEdits, setMatchChampionshipEdits] = useState<
    Record<string, boolean>
  >({});
  const [matchChampionshipNameEdits, setMatchChampionshipNameEdits] = useState<
    Record<string, string>
  >({});
  const [matchChampionshipImageEdits, setMatchChampionshipImageEdits] = useState<
    Record<string, string>
  >({});
  const [matchChampionSideEdits, setMatchChampionSideEdits] = useState<
    Record<string, string>
  >({});
  const [matchKnownWrestlerEdits, setMatchKnownWrestlerEdits] = useState<
    Record<string, string>
  >({});
  const [matchGauntletCandidateSelection, setMatchGauntletCandidateSelection] =
    useState<Record<string, string>>({});
  const [matchGauntletActualSelection, setMatchGauntletActualSelection] =
    useState<Record<string, string>>({});
  const [matchGauntletSurvivalEdits, setMatchGauntletSurvivalEdits] = useState<
    Record<string, string>
  >({});
  const [matchGauntletFinalEdits, setMatchGauntletFinalEdits] = useState<
    Record<string, string>
  >({});
  const [matchSideLabelEdits, setMatchSideLabelEdits] = useState<Record<string, string>>({});
  const [matchSideImageEdits, setMatchSideImageEdits] = useState<Record<string, string>>({});
  const [matchFinishEdits, setMatchFinishEdits] = useState<
    Record<string, { method: string; winner: string; loser: string }>
  >({});
  const [matchLengthEdits, setMatchLengthEdits] = useState<Record<string, string>>({});
  const [matchInterferenceEdits, setMatchInterferenceEdits] = useState<
    Record<string, string>
  >({});
  const [matchParticipantsOpen, setMatchParticipantsOpen] = useState<
    Record<string, boolean>
  >({});
  const [orderIndexEdits, setOrderIndexEdits] = useState<Record<string, string>>(
    {}
  );
  const [scrollMatchId, setScrollMatchId] = useState<string | null>(null);
  const matchRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [scrollEliminatorId, setScrollEliminatorId] = useState<string | null>(
    null
  );
  const eliminatorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const normalizeQuestionAnswer = (value: string) => value.trim();

  const appendQuestionAnswer = (value: string) => {
    const answer = normalizeQuestionAnswer(value);
    if (!answer) return;
    setNewQuestionAnswers((prev) =>
      prev.includes(answer) ? prev : [...prev, answer]
    );
  };
  const parseQuestionAnswers = (value: string) =>
    Array.from(
      new Set(
        value
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );

  const formatLocalDateTime = (value: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const formatMatchTypeLabel = (value: string) => {
    switch (value) {
      case "tag_4_way":
        return "4-Way Tag";
      case "tag_4":
        return "4v4 Tag";
      case "ladder_6":
        return "6-Man Ladder";
      case "tag_3":
        return "Trios";
      case "tag":
        return "Tag";
      case "singles":
        return "Singles";
      case "triple_threat":
        return "Triple Threat";
      case "fatal_4_way":
        return "Fatal 4-Way";
      case "blind_gauntlet":
        return "Blind Gauntlet Match";
      default:
        return value.replace("_", " ");
    }
  };

  const activeShow = useMemo(() => {
    if (selectedShowId) {
      return shows.find((show) => show.id === selectedShowId) ?? null;
    }
    return shows[0] ?? null;
  }, [shows, selectedShowId]);
  const showEvents = useMemo(() => {
    if (!activeShow) return [];
    return events
      .filter((event) => event.show_id === activeShow.id)
      .sort(
        (a, b) =>
          (a.order_index ?? 9999) - (b.order_index ?? 9999) ||
          a.name.localeCompare(b.name)
      );
  }, [activeShow, events]);
  const orderedShowMatches = useMemo(() => {
    return [...showMatches].sort(
      (a, b) =>
        (a.order_index ?? 9999) - (b.order_index ?? 9999) ||
        a.name.localeCompare(b.name)
    );
  }, [showMatches]);
  const orderedShowEliminators = useMemo(() => {
    return [...eliminators]
      .filter((eliminator) => eliminator.show_id === activeShow?.id)
      .sort(
        (a, b) =>
          (a.order_index ?? 9999) - (b.order_index ?? 9999) ||
          a.name.localeCompare(b.name)
      );
  }, [eliminators, activeShow?.id]);
  const visibleShowEvents = useMemo(() => {
    if (!focusedEventId) return showEvents;
    return showEvents.filter((event) => event.id === focusedEventId);
  }, [focusedEventId, showEvents]);
  const activeEventId = useMemo(() => {
    if (selectedEventId && showEvents.some((event) => event.id === selectedEventId)) {
      return selectedEventId;
    }
    return showEvents[0]?.id ?? "";
  }, [selectedEventId, showEvents]);
  const activeEvent = useMemo(() => {
    if (!activeEventId) return null;
    return events.find((event) => event.id === activeEventId) ?? null;
  }, [activeEventId, events]);
  const eventNameById = useMemo(() => {
    return new Map(events.map((event) => [event.id, event.name]));
  }, [events]);
  const orderedShowItems = useMemo(() => {
    const eventItems = showEvents.map((event) => ({
      id: event.id,
      name: event.name,
      type: "event" as const,
      order_index: event.order_index ?? null,
      detail: `${event.rumble_gender ?? "unspecified"}${
        event.roster_year ? ` • ${event.roster_year}` : ""
      }`,
    }));
    const matchItems = orderedShowMatches.map((match) => ({
      id: match.id,
      name: match.name,
      type: "match" as const,
      order_index: match.order_index ?? null,
      detail: `${formatMatchTypeLabel(match.match_type ?? "match")}${
        match.event_id
          ? ` • ${eventNameById.get(match.event_id) ?? "Unassigned"}`
          : ""
      }`,
    }));
    const eliminatorItems = orderedShowEliminators.map((eliminator) => ({
      id: eliminator.id,
      name: eliminator.name,
      type: "eliminator" as const,
      order_index: eliminator.order_index ?? null,
      detail: `${eliminator.roster_gender ?? "all"} • ${
        eliminator.roster_year ?? "any"
      } • ${eliminator.entrant_limit} entrants`,
    }));
    const questionItems = showQuestions.map((question) => ({
      id: question.id,
      name: question.question,
      type: "question" as const,
      order_index: question.order_index ?? null,
      detail: `${question.answers.length} answers${
        question.image_url ? " • image" : ""
      }`,
    }));
    return [...eventItems, ...matchItems, ...eliminatorItems, ...questionItems].sort(
      (a, b) =>
        (a.order_index ?? 9999) - (b.order_index ?? 9999) ||
        a.name.localeCompare(b.name)
    );
  }, [
    showEvents,
    orderedShowMatches,
    orderedShowEliminators,
    showQuestions,
    eventNameById,
  ]);
  useEffect(() => {
    setEventRosterYear(
      activeEvent?.roster_year ? String(activeEvent.roster_year) : ""
    );
    setEventShowId(activeEvent?.show_id ?? "");
    setEventIronPersonId(activeEvent?.iron_person_entrant_id ?? "");
  }, [activeEvent?.roster_year, activeEvent?.show_id, activeEvent?.iron_person_entrant_id]);
  useEffect(() => {
    if (!activeShow) {
      setShowEditName("");
      setShowEditSlug("");
      setShowEditPromotionId("");
      setShowEditImageUrl("");
      setShowEditStartsAt("");
      setShowEditTagline("");
      setShowEditRequiresEmail(true);
      setShowEditLockPicksAtStart(true);
      setShowEditIsFeaturedPlayShow(false);
      setShowEditIsOver(false);
      setShowEditUseConfidencePoints(false);
      setShowEditRequiresLocationVerification(false);
      setShowEditVenueName("");
      setShowEditVenueAddress("");
      setShowEditVenueLatitude("");
      setShowEditVenueLongitude("");
      setShowEditLocationRadiusMeters("");
      return;
    }
    setShowEditName(activeShow.name ?? "");
    setShowEditSlug(activeShow.slug ?? "");
    setShowEditPromotionId(activeShow.promotion_id ?? "");
    setShowEditImageUrl(activeShow.image_url ?? "");
    setShowEditStartsAt(formatLocalDateTime(activeShow.starts_at ?? null));
    setShowEditTagline(activeShow.tagline ?? "");
    setShowEditRequiresEmail(activeShow.requires_email_registration ?? true);
    setShowEditLockPicksAtStart(activeShow.lock_picks_at_start ?? true);
    setShowEditIsFeaturedPlayShow(activeShow.is_featured_play_show ?? false);
    setShowEditIsOver(activeShow.is_over ?? false);
    setShowEditUseConfidencePoints(activeShow.use_confidence_points ?? false);
    setShowEditRequiresLocationVerification(
      activeShow.requires_location_verification ?? false
    );
    setShowEditVenueName(activeShow.venue_name ?? "");
    setShowEditVenueAddress(activeShow.venue_address ?? "");
    setShowEditVenueLatitude(
      activeShow.venue_latitude === null ||
        activeShow.venue_latitude === undefined
        ? ""
        : String(activeShow.venue_latitude)
    );
    setShowEditVenueLongitude(
      activeShow.venue_longitude === null ||
        activeShow.venue_longitude === undefined
        ? ""
        : String(activeShow.venue_longitude)
    );
    setShowEditLocationRadiusMeters(
      activeShow.location_radius_meters === null ||
        activeShow.location_radius_meters === undefined
        ? ""
        : String(activeShow.location_radius_meters)
    );
  }, [
    activeShow?.id,
    activeShow?.name,
    activeShow?.slug,
    activeShow?.image_url,
    activeShow?.promotion_id,
    activeShow?.starts_at,
    activeShow?.tagline,
    activeShow?.requires_email_registration,
    activeShow?.lock_picks_at_start,
    activeShow?.is_featured_play_show,
    activeShow?.is_over,
    activeShow?.use_confidence_points,
    activeShow?.requires_location_verification,
    activeShow?.venue_name,
    activeShow?.venue_address,
    activeShow?.venue_latitude,
    activeShow?.venue_longitude,
    activeShow?.location_radius_meters,
  ]);
  useEffect(() => {
    if (!selectedShowId && activeShow?.id) {
      setSelectedShowId(activeShow.id);
    }
  }, [activeShow?.id, selectedShowId]);
  useEffect(() => {
    if (selectedShowId && !eventShowId) {
      setEventShowId(selectedShowId);
    }
  }, [eventShowId, selectedShowId]);
  useEffect(() => {
    if (!activeShow) return;
    if (selectedShowId && activeShow.id !== selectedShowId) {
      return;
    }
    if (!showEvents.find((event) => event.id === selectedEventId)) {
      setSelectedEventId(showEvents[0]?.id ?? "");
    }
  }, [activeShow, selectedEventId, selectedShowId, showEvents]);
  useEffect(() => {
    if (!focusedEventId) return;
    if (!showEvents.find((event) => event.id === focusedEventId)) {
      setFocusedEventId("");
    }
  }, [focusedEventId, showEvents]);
  const loadShowQuestions = useCallback(async () => {
    if (!selectedShowId) {
      setShowQuestions([]);
      return;
    }
    const { data, error } = await supabase
      .from("show_questions")
      .select(
        "id, show_id, image_url, question, answers, correct_answer, order_index, created_at"
      )
      .eq("show_id", selectedShowId)
      .order("order_index", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) {
      setMessage(error.message);
      return;
    }
    setShowQuestions((data ?? []) as ShowQuestionRow[]);
  }, [selectedShowId]);
  useEffect(() => {
    loadShowQuestions();
  }, [loadShowQuestions]);
  useEffect(() => {
    if (!eventLogOpen || !activeEvent) return;
    loadEventLogs();
  }, [eventLogOpen, activeEvent?.id]);
  useEffect(() => {
    if (!toastMessage) return;
    setToastVisible(true);
    const hideTimer = setTimeout(() => setToastVisible(false), 2600);
    const clearTimer = setTimeout(() => setToastMessage(null), 3300);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [toastMessage]);
  useEffect(() => {
    if (adminView !== "card" || !scrollMatchId) return;
    const element = matchRefs.current[scrollMatchId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollMatchId(null);
    }
  }, [adminView, scrollMatchId]);
  useEffect(() => {
    if (adminView !== "advanced" || adminTab !== "eliminators" || !scrollEliminatorId) return;
    const element = eliminatorRefs.current[scrollEliminatorId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollEliminatorId(null);
    }
  }, [adminView, adminTab, scrollEliminatorId]);
  const scrollToEventEditor = () => {
    requestAnimationFrame(() => {
      const target = document.getElementById("event-editor");
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const entrantMap = useMemo(() => {
    return new Map(entrants.map((entrant) => [entrant.id, entrant]));
  }, [entrants]);
  const logEventAction = async (
    eventId: string,
    actionType: string,
    payload: Record<string, unknown>
  ) => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id ?? null;
    await supabase.from("event_action_log").insert({
      event_id: eventId,
      action_type: actionType,
      payload,
      created_by: userId,
    });
  };

  const loadEventLogs = async () => {
    if (!activeEvent) return;
    const { data: logRows } = await supabase
      .from("event_action_log")
      .select("id, event_id, action_type, payload, created_by, created_at")
      .eq("event_id", activeEvent.id)
      .order("created_at", { ascending: false });
    setEventLogs((logRows ?? []) as EventActionLogRow[]);
  };

  const formatLogSummary = (log: EventActionLogRow) => {
    const payload = log.payload as Record<string, unknown>;
    switch (log.action_type) {
      case "add_entry":
        return `Added ${payload.entrant_name ?? "entrant"}`;
      case "remove_entry":
        return `Removed ${payload.entrant_name ?? "entrant"}`;
      case "update_entry":
        return `Updated ${payload.entrant_name ?? "entrant"}`;
      case "elimination":
        return `Eliminated ${payload.eliminated_entrant_name ?? "entrant"}`;
      default:
        return "Updated event";
    }
  };

  const getChangedEntries = () => {
    const snapshotMap = new Map(entriesSnapshot.map((entry) => [entry.id, entry]));
    return entries.filter((entry) => {
      const before = snapshotMap.get(entry.id);
      if (!before) return true;
      return (
        before.entry_number !== entry.entry_number ||
        before.eliminations_count !== entry.eliminations_count ||
        before.eliminated_by !== entry.eliminated_by ||
        before.eliminated_at !== entry.eliminated_at ||
        Boolean(before.is_confirmed) !== Boolean(entry.is_confirmed)
      );
    });
  };

  const handleUndoLog = async (log: EventActionLogRow) => {
    if (!activeEvent) return;
    setEventLogBusy(true);
    setMessage(null);
    try {
      if (log.action_type === "add_entry") {
        const entry = log.payload.entry as RumbleEntryRow | undefined;
        if (entry?.id) {
          const { error } = await supabase
            .from("rumble_entries")
            .delete()
            .eq("id", entry.id);
          if (error) throw error;
        }
      }
      if (log.action_type === "remove_entry") {
        const entry = log.payload.entry as RumbleEntryRow | undefined;
        if (entry?.id) {
          const { error } = await supabase.from("rumble_entries").insert({
            id: entry.id,
            event_id: log.event_id,
            entrant_id: entry.entrant_id,
            entry_number: entry.entry_number,
            eliminated_by: entry.eliminated_by,
            eliminated_at: entry.eliminated_at,
            eliminations_count: entry.eliminations_count ?? 0,
            is_confirmed: entry.is_confirmed ?? false,
          });
          if (error) throw error;
        }
      }
      if (log.action_type === "update_entry") {
        const before = log.payload.before as RumbleEntryRow | undefined;
        if (before?.id) {
          const { error } = await supabase
            .from("rumble_entries")
            .update({
              entry_number: before.entry_number,
              eliminated_by: before.eliminated_by,
              eliminated_at: before.eliminated_at,
              eliminations_count: before.eliminations_count ?? 0,
              is_confirmed: before.is_confirmed ?? false,
            })
            .eq("id", before.id);
          if (error) throw error;
        }
      }
      if (log.action_type === "elimination") {
        const eliminatedBefore =
          log.payload.eliminated_entry_before as RumbleEntryRow | undefined;
        const eliminatorBefore =
          log.payload.eliminator_before as RumbleEntryRow | undefined;
        if (eliminatedBefore?.id) {
          const { error } = await supabase
            .from("rumble_entries")
            .update({
              eliminated_by: eliminatedBefore.eliminated_by,
              eliminated_at: eliminatedBefore.eliminated_at,
            })
            .eq("id", eliminatedBefore.id);
          if (error) throw error;
        }
        if (eliminatorBefore?.id) {
          const { error } = await supabase
            .from("rumble_entries")
            .update({
              eliminations_count: eliminatorBefore.eliminations_count ?? 0,
            })
            .eq("id", eliminatorBefore.id);
          if (error) throw error;
        }
      }
      const { error: deleteLogError } = await supabase
        .from("event_action_log")
        .delete()
        .eq("id", log.id);
      if (deleteLogError) throw deleteLogError;
      await handleRecalculateScores({ silent: true });
      setEventLogs((prev) => prev.filter((item) => item.id !== log.id));
      await loadEventLogs();
      refreshData();
    } catch (error) {
      const err = error as { message?: string };
      setMessage(err.message ?? "Failed to undo log entry.");
    } finally {
      setEventLogBusy(false);
    }
  };
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
  const gauntletCandidateEntrantsByMatch = useMemo(() => {
    return gauntletCandidateEntrants.reduce((map, row) => {
      if (!map[row.match_id]) {
        map[row.match_id] = [];
      }
      map[row.match_id].push(row);
      return map;
    }, {} as Record<string, GauntletEntrantRow[]>);
  }, [gauntletCandidateEntrants]);
  const gauntletActualEntrantsByMatch = useMemo(() => {
    return gauntletActualEntrants.reduce((map, row) => {
      if (!map[row.match_id]) {
        map[row.match_id] = [];
      }
      map[row.match_id].push(row);
      return map;
    }, {} as Record<string, GauntletEntrantRow[]>);
  }, [gauntletActualEntrants]);
  const entrantOptions = useMemo(() => {
    return [...entrants].sort((a, b) => a.name.localeCompare(b.name));
  }, [entrants]);
  const filteredEntrantOptions = useMemo(() => {
    const gender = activeEvent?.rumble_gender;
    const rosterYear = activeEvent?.roster_year;
    const eventId = activeEvent?.id ?? null;
    const base = entrantOptions.filter((entrant) => {
      const matchesGender = !gender || entrant.gender === gender;
      const matchesYear = !rosterYear || entrant.roster_year === rosterYear;
      const matchesEvent = eventId ? entrant.event_id === eventId : false;
      const isRosterEntrant = entrant.event_id === null;
      const isApproved = (entrant.status ?? "approved") === "approved";
      return (
        isApproved && matchesGender && (matchesEvent || (isRosterEntrant && matchesYear))
      );
    });
    const byName = new Map<string, EntrantRow>();
    base.forEach((entrant) => {
      const nameKey = entrant.name.trim().toLowerCase();
      const current = byName.get(nameKey);
      if (!current) {
        byName.set(nameKey, entrant);
        return;
      }
      const currentMatchesEvent = eventId && current.event_id === eventId;
      const nextMatchesEvent = eventId && entrant.event_id === eventId;
      if (!currentMatchesEvent && nextMatchesEvent) {
        byName.set(nameKey, entrant);
        return;
      }
      const currentIsWwe = (current.promotion ?? "").toLowerCase() === "wwe";
      const nextIsWwe = (entrant.promotion ?? "").toLowerCase() === "wwe";
      if (!currentIsWwe && nextIsWwe) {
        byName.set(nameKey, entrant);
      }
    });
    return Array.from(byName.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [activeEvent?.rumble_gender, activeEvent?.roster_year, activeEvent?.id, entrantOptions]);
  const eventEntrantOptions = useMemo(() => {
    const eventEntrantIds = new Set(entries.map((entry) => entry.entrant_id));
    return filteredEntrantOptions.filter((entrant) =>
      eventEntrantIds.has(entrant.id)
    );
  }, [entries, filteredEntrantOptions]);
  const eventEntrantIdSet = useMemo(() => {
    return new Set(entries.map((entry) => entry.entrant_id));
  }, [entries]);
  const entrantsByPromotion = useMemo(() => {
    return filteredEntrantOptions.reduce((groups, entrant) => {
      const key = entrant.promotion ?? "Other";
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(entrant);
      return groups;
    }, {} as Record<string, EntrantRow[]>);
  }, [filteredEntrantOptions]);

  const activePromotion = useMemo(() => {
    if (!activeShow?.promotion_id) return null;
    return (
      promotions.find((promotion) => promotion.id === activeShow.promotion_id) ??
      null
    );
  }, [activeShow?.promotion_id, promotions]);

  const activeShowLinks = useMemo(() => {
    if (!activeShow) {
      return null;
    }
    return {
      show: buildShowHref(activeShow, activePromotion),
      picks: `/picks?show=${activeShow.id}`,
      scoreboard: `/scoreboard?show=${activeShow.id}`,
      qr: "/qr",
    };
  }, [activePromotion, activeShow]);

  const matchCompletion = useMemo(() => {
    const completed = orderedShowMatches.filter(
      (match) =>
        Boolean(match.winner_side_id) ||
        Boolean(match.winner_entrant_id) ||
        match.status === "completed"
    ).length;
    return {
      completed,
      total: orderedShowMatches.length,
      remaining: Math.max(orderedShowMatches.length - completed, 0),
    };
  }, [orderedShowMatches]);

  const readinessItems = useMemo(() => {
    const hasShowDetails = Boolean(activeShow?.name?.trim()) && Boolean(activeShow?.promotion_id);
    const hasStartTime = Boolean(activeShow?.starts_at);
    const hasMatches = orderedShowMatches.length > 0;
    const participantsAssigned =
      orderedShowMatches.length > 0 &&
      orderedShowMatches.every((match) => {
        const sides = matchSidesByMatch[match.id] ?? [];
        if (match.match_type === "blind_gauntlet") {
          return Boolean(match.known_wrestler_id);
        }
        return sides.length > 0 && sides.every((side) =>
          matchEntrants.some(
            (row) => row.match_id === match.id && row.side_id === side.id
          )
        );
      });
    const locationConfigured =
      !activeShow?.requires_location_verification ||
      (typeof activeShow.venue_latitude === "number" &&
        Number.isFinite(activeShow.venue_latitude) &&
        activeShow.venue_latitude >= -90 &&
        activeShow.venue_latitude <= 90 &&
        typeof activeShow.venue_longitude === "number" &&
        Number.isFinite(activeShow.venue_longitude) &&
        activeShow.venue_longitude >= -180 &&
        activeShow.venue_longitude <= 180 &&
        typeof activeShow.location_radius_meters === "number" &&
        Number.isFinite(activeShow.location_radius_meters) &&
        activeShow.location_radius_meters > 0);
    const previewAvailable = Boolean(activeShowLinks?.show);
    const picksLocked =
      Boolean(activeShow?.starts_at) &&
      (activeShow?.lock_picks_at_start ?? true) &&
      new Date(activeShow?.starts_at ?? "").getTime() <= Date.now();
    return [
      { label: "Show details", complete: hasShowDetails },
      { label: `Matches added (${orderedShowMatches.length})`, complete: hasMatches },
      { label: "Participants assigned", complete: participantsAssigned },
      {
        label: picksLocked ? "Picks locked" : "Picks can open",
        complete: hasStartTime,
        warning: picksLocked,
      },
      {
        label: activeShow?.requires_location_verification
          ? "Location gate configured"
          : "Location gate optional",
        complete: locationConfigured,
      },
      { label: "Preview available", complete: previewAvailable },
    ];
  }, [
    activeShow,
    activeShowLinks?.show,
    matchEntrants,
    matchSidesByMatch,
    orderedShowMatches,
  ]);

  const readinessCompleteCount = readinessItems.filter(
    (item) => item.complete
  ).length;
  const readinessPercent =
    readinessItems.length > 0
      ? Math.round((readinessCompleteCount / readinessItems.length) * 100)
      : 0;

  const pendingEntrants = useMemo(() => {
    if (!activeEvent?.id) return [];
    return entrants
      .filter(
        (entrant) =>
          entrant.event_id === activeEvent.id &&
          (entrant.status ?? "approved") === "pending"
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeEvent?.id, entrants]);

  const refreshData = async () => {
    if (!activeEvent) {
      const showIdForQuery = selectedShowId || null;
      const [
        { data: showRows },
        { data: promotionRows },
        { data: eventRows },
        { data: eliminatorRows },
        { data: entrantRows },
        { data: matchRows },
        { data: matchSideRows },
        { data: matchEntrantRows },
        { data: gauntletCandidateRows },
        { data: gauntletActualRows },
        { data: eliminatorEntryRows },
        { data: eliminatorEliminationRows },
      ] = await Promise.all([
        supabase
          .from("shows")
          .select(
            "id, name, slug, tagline, image_url, promotion_id, status, starts_at, requires_email_registration, lock_picks_at_start, is_featured_play_show, is_over, use_confidence_points, requires_location_verification, venue_name, venue_address, venue_latitude, venue_longitude, location_radius_meters"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("promotions")
          .select("id, name, slug, image_url")
          .order("name", { ascending: true }),
        supabase
          .from("events")
          .select("id, name, image_url, status, rumble_gender, roster_year, show_id, iron_person_entrant_id, order_index")
          .order("order_index", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("eliminators")
          .select("id, name, status, roster_year, roster_gender, entrant_limit, show_id, order_index, winner_entrant_id")
          .order("order_index", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
        loadAllEntrants(),
        (() => {
          const query = supabase
            .from("matches")
            .select(
              "id, name, kind, match_type, status, order_index, is_main_event, is_championship, championship_name, championship_image_url, champion_side_id, known_wrestler_id, gauntlet_survival_result, gauntlet_final_entrant_id, winner_entrant_id, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id, match_length, match_interference, roster_year, roster_gender, event_id, show_id"
            )
            .order("order_index", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: true });
          if (showIdForQuery) {
            return query.eq("show_id", showIdForQuery);
          }
          return query;
        })(),
        supabase
          .from("match_sides")
          .select("id, match_id, label, image_url"),
        supabase
          .from("match_entrants")
          .select("id, match_id, entrant_id, side_id"),
        supabase
          .from("gauntlet_candidate_entrants")
          .select("id, match_id, entrant_id"),
        supabase
          .from("gauntlet_actual_entrants")
          .select("id, match_id, entrant_id"),
        supabase
          .from("eliminator_entries")
          .select("id, eliminator_id, entrant_id, entry_order"),
        supabase
          .from("eliminator_eliminations")
          .select(
            "id, eliminator_id, eliminated_entrant_id, eliminated_by_entrant_id, elimination_type, elimination_order"
          ),
      ]);
      setShows(showRows ?? []);
      setPromotions(promotionRows ?? []);
      setEvents(eventRows ?? []);
      setEliminators((eliminatorRows ?? []) as EliminatorRow[]);
      setEntrants(entrantRows ?? []);
      const matchListAll = (matchRows ?? []) as MatchRow[];
      const matchIdSet = new Set(matchListAll.map((match) => match.id));
      const matchSideList = (matchSideRows ?? []).filter((row) =>
        matchIdSet.has(row.match_id)
      ) as MatchSideRow[];
      const matchEntrantList = (matchEntrantRows ?? []).filter((row) =>
        matchIdSet.has(row.match_id)
      ) as MatchEntrantRow[];
      setShowMatches(matchListAll);
      setMatches(matchListAll);
      setMatchSides(matchSideList);
      setMatchEntrants(matchEntrantList);
      setGauntletCandidateEntrants(
        ((gauntletCandidateRows ?? []) as GauntletEntrantRow[]).filter((row) =>
          matchIdSet.has(row.match_id)
        )
      );
      setGauntletActualEntrants(
        ((gauntletActualRows ?? []) as GauntletEntrantRow[]).filter((row) =>
          matchIdSet.has(row.match_id)
        )
      );
      setEliminatorEntries((eliminatorEntryRows ?? []) as EliminatorEntryRow[]);
      setEliminatorEliminations(
        (eliminatorEliminationRows ?? []) as EliminatorEliminationRow[]
      );
      setMatchNameEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (!next[match.id]) {
            next[match.id] = match.name;
          }
        });
        return next;
      });
      setMatchMainEventEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] = Boolean(match.is_main_event);
          }
        });
        return next;
      });
      setMatchChampionshipEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] = Boolean(match.is_championship);
          }
        });
        return next;
      });
      setMatchChampionshipNameEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] = match.championship_name ?? "";
          }
        });
        return next;
      });
      setMatchChampionshipImageEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] = match.championship_image_url ?? "";
          }
        });
        return next;
      });
      setMatchMainEventEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] = Boolean(match.is_main_event);
          }
        });
        return next;
      });
      setMatchChampionshipEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] = Boolean(match.is_championship);
          }
        });
        return next;
      });
      setMatchChampionshipNameEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] = match.championship_name ?? "";
          }
        });
        return next;
      });
      setMatchChampionshipImageEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] = match.championship_image_url ?? "";
          }
        });
        return next;
      });
      setMatchChampionSideEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] = match.champion_side_id ?? "";
          }
        });
        return next;
      });
      setMatchKnownWrestlerEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] = match.known_wrestler_id ?? "";
          }
        });
        return next;
      });
      setMatchGauntletSurvivalEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] =
              typeof match.gauntlet_survival_result === "boolean"
                ? String(match.gauntlet_survival_result)
                : "";
          }
        });
        return next;
      });
      setMatchGauntletFinalEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] = match.gauntlet_final_entrant_id ?? "";
          }
        });
        return next;
      });
      setMatchSideLabelEdits((prev) => {
        const next = { ...prev };
        matchSideList.forEach((side) => {
          if (!next[side.id]) {
            next[side.id] = side.label ?? "";
          }
        });
        return next;
      });
      setMatchSideImageEdits((prev) => {
        const next = { ...prev };
        matchSideList.forEach((side) => {
          if (next[side.id] === undefined) {
            next[side.id] = side.image_url ?? "";
          }
        });
        return next;
      });
      setMatchKnownWrestlerEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] = match.known_wrestler_id ?? "";
          }
        });
        return next;
      });
      setMatchGauntletSurvivalEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] =
              typeof match.gauntlet_survival_result === "boolean"
                ? String(match.gauntlet_survival_result)
                : "";
          }
        });
        return next;
      });
      setMatchGauntletFinalEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] = match.gauntlet_final_entrant_id ?? "";
          }
        });
        return next;
      });
      setMatchLengthEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (!next[match.id] && match.match_length) {
            next[match.id] = match.match_length;
          }
        });
        return next;
      });
      setMatchInterferenceEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (!next[match.id] && match.match_interference) {
            next[match.id] = match.match_interference;
          }
        });
        return next;
      });
    } else {
        const showIdForQuery = selectedShowId || activeEvent.show_id || null;
        const [
          { data: showRows },
          { data: promotionRows },
          { data: eventRows },
          { data: eliminatorRows },
          { data: entrantRows },
          { data: entryRows },
        { data: matchRows },
        { data: matchSideRows },
        { data: matchEntrantRows },
        { data: gauntletCandidateRows },
        { data: gauntletActualRows },
        { data: eliminatorEntryRows },
        { data: eliminatorEliminationRows },
      ] = await Promise.all([
          supabase
            .from("shows")
            .select(
              "id, name, slug, tagline, image_url, promotion_id, status, starts_at, requires_email_registration, lock_picks_at_start, is_featured_play_show, is_over, use_confidence_points, requires_location_verification, venue_name, venue_address, venue_latitude, venue_longitude, location_radius_meters"
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("promotions")
            .select("id, name, slug, image_url")
            .order("name", { ascending: true }),
          supabase
            .from("events")
            .select("id, name, image_url, status, rumble_gender, roster_year, show_id, iron_person_entrant_id, order_index")
            .order("order_index", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: false }),
        supabase
          .from("eliminators")
          .select("id, name, status, roster_year, roster_gender, entrant_limit, show_id, order_index, winner_entrant_id")
          .order("order_index", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
          loadAllEntrants(),
          supabase
            .from("rumble_entries")
            .select(
              "id, entrant_id, entry_number, eliminated_by, eliminated_at, eliminations_count, is_confirmed"
            )
            .eq("event_id", activeEvent.id)
            .order("entry_number", { ascending: true }),
          (() => {
            const query = supabase
              .from("matches")
              .select(
                "id, name, kind, match_type, status, order_index, is_main_event, is_championship, championship_name, championship_image_url, champion_side_id, known_wrestler_id, gauntlet_survival_result, gauntlet_final_entrant_id, winner_entrant_id, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id, match_length, match_interference, roster_year, roster_gender, event_id, show_id"
              )
              .order("order_index", { ascending: true, nullsFirst: false })
              .order("created_at", { ascending: true });
            if (showIdForQuery) {
              return query.eq("show_id", showIdForQuery);
            }
            return query.eq("event_id", activeEvent.id);
          })(),
          supabase
            .from("match_sides")
            .select("id, match_id, label, image_url"),
          supabase
            .from("match_entrants")
            .select("id, match_id, entrant_id, side_id"),
          supabase
            .from("gauntlet_candidate_entrants")
            .select("id, match_id, entrant_id"),
          supabase
            .from("gauntlet_actual_entrants")
            .select("id, match_id, entrant_id"),
          supabase
            .from("eliminator_entries")
            .select("id, eliminator_id, entrant_id, entry_order"),
          supabase
            .from("eliminator_eliminations")
            .select(
              "id, eliminator_id, eliminated_entrant_id, eliminated_by_entrant_id, elimination_type, elimination_order"
            ),
        ]);
      setShows(showRows ?? []);
      setPromotions(promotionRows ?? []);
      setEvents(eventRows ?? []);
      setEliminators((eliminatorRows ?? []) as EliminatorRow[]);
      if (!selectedShowId && showRows && showRows.length > 0) {
        setSelectedShowId(showRows[0].id);
      }
      setEntrants(entrantRows ?? []);
      setEntries(entryRows ?? []);
      setEntriesSnapshot(entryRows ?? []);
      const matchListAll = (matchRows ?? []) as MatchRow[];
      const matchIdSet = new Set(matchListAll.map((match) => match.id));
      const matchSideList = (matchSideRows ?? []).filter((row) =>
        matchIdSet.has(row.match_id)
      ) as MatchSideRow[];
      const matchEntrantList = (matchEntrantRows ?? []).filter((row) =>
        matchIdSet.has(row.match_id)
      ) as MatchEntrantRow[];
      setShowMatches(matchListAll);
      setMatches(matchListAll);
      setMatchSides(matchSideList);
      setMatchEntrants(matchEntrantList);
      setGauntletCandidateEntrants(
        ((gauntletCandidateRows ?? []) as GauntletEntrantRow[]).filter((row) =>
          matchIdSet.has(row.match_id)
        )
      );
      setGauntletActualEntrants(
        ((gauntletActualRows ?? []) as GauntletEntrantRow[]).filter((row) =>
          matchIdSet.has(row.match_id)
        )
      );
      setEliminatorEntries((eliminatorEntryRows ?? []) as EliminatorEntryRow[]);
      setEliminatorEliminations(
        (eliminatorEliminationRows ?? []) as EliminatorEliminationRow[]
      );
      setMatchNameEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (!next[match.id]) {
            next[match.id] = match.name;
          }
        });
        return next;
      });
      setMatchSideLabelEdits((prev) => {
        const next = { ...prev };
        matchSideList.forEach((side) => {
          if (!next[side.id]) {
            next[side.id] = side.label ?? "";
          }
        });
        return next;
      });
      setMatchSideImageEdits((prev) => {
        const next = { ...prev };
        matchSideList.forEach((side) => {
          if (next[side.id] === undefined) {
            next[side.id] = side.image_url ?? "";
          }
        });
        return next;
      });
      setMatchLengthEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (!next[match.id] && match.match_length) {
            next[match.id] = match.match_length;
          }
        });
        return next;
      });
      setMatchInterferenceEdits((prev) => {
        const next = { ...prev };
        matchListAll.forEach((match) => {
          if (!next[match.id] && match.match_interference) {
            next[match.id] = match.match_interference;
          }
        });
        return next;
      });
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (ignore) return;
      const session = data.session;
      setSessionEmail(session?.user.email ?? null);

      if (!session?.user.id) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .single();
      setIsAdmin(Boolean(profile?.is_admin));
      setLoading(false);
    };

    loadSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isAdmin) {
      refreshData();
    }
  }, [isAdmin, activeEvent?.id, selectedEventId, selectedShowId]);

  const handleCreateEvent = async () => {
    setMessage(null);
    if (!eventName.trim()) {
      setMessage("Event name is required.");
      return;
    }
    const { error } = await supabase
      .from("events")
      .insert({
        name: eventName.trim(),
        status: "draft",
        rumble_gender: eventGender,
        roster_year: eventRosterYear ? Number(eventRosterYear) : null,
        show_id: eventShowId || null,
      });
    if (error) {
      setMessage(error.message);
      return;
    }
    setEventName("");
    setEventGender("men");
    setEventRosterYear("");
    setEventShowId("");
    refreshData();
  };

  const handleCreateShowQuestion = async () => {
    setMessage(null);
    if (!selectedShowId) {
      setMessage("Select a show before creating a question.");
      return;
    }
    const question = newQuestionText.trim();
    if (!question) {
      setMessage("Question text is required.");
      return;
    }
    const pendingAnswer = normalizeQuestionAnswer(newQuestionAnswerInput);
    const answers = pendingAnswer
      ? Array.from(new Set([...newQuestionAnswers, pendingAnswer]))
      : newQuestionAnswers;
    if (answers.length < 2) {
      setMessage("Add at least two possible answers.");
      return;
    }
    const highestOrder = Math.max(
      0,
      ...showEvents.map((item, index) => item.order_index ?? index + 1),
      ...orderedShowMatches.map((item, index) => item.order_index ?? index + 1),
      ...orderedShowEliminators.map((item, index) => item.order_index ?? index + 1),
      ...showQuestions.map((item, index) => item.order_index ?? index + 1)
    );
    const { error } = await supabase.from("show_questions").insert({
      show_id: selectedShowId,
      image_url: newQuestionImageUrl.trim() || null,
      question,
      answers,
      correct_answer: null,
      order_index: highestOrder + 1,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setNewQuestionImageUrl("");
    setNewQuestionText("");
    setNewQuestionAnswerInput("");
    setNewQuestionAnswers([]);
    loadShowQuestions();
    setToastMessage("Question added.");
  };

  const handleDeleteShowQuestion = async (questionId: string) => {
    setMessage(null);
    const { error } = await supabase
      .from("show_questions")
      .delete()
      .eq("id", questionId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadShowQuestions();
    if (activeEvent?.show_id === selectedShowId) {
      await handleRecalculateScores({ silent: true });
    }
    setToastMessage("Question removed.");
  };

  const handleUpdateShowQuestion = async (question: ShowQuestionRow) => {
    setMessage(null);
    const nextQuestion = (questionTextEdits[question.id] ?? question.question).trim();
    if (!nextQuestion) {
      setMessage("Question text is required.");
      return;
    }
    const nextAnswers = parseQuestionAnswers(
      questionAnswerEdits[question.id] ?? question.answers.join("\n")
    );
    if (nextAnswers.length < 2) {
      setMessage("Add at least two possible answers.");
      return;
    }
    const nextCorrectAnswerRaw =
      questionCorrectAnswerEdits[question.id] ?? question.correct_answer ?? "";
    const nextCorrectAnswer = nextCorrectAnswerRaw.trim() || null;
    if (nextCorrectAnswer && !nextAnswers.includes(nextCorrectAnswer)) {
      setMessage("Correct answer must match one of the possible answers.");
      return;
    }
    const { error } = await supabase
      .from("show_questions")
      .update({
        image_url: (questionImageEdits[question.id] ?? question.image_url ?? "").trim() || null,
        question: nextQuestion,
        answers: nextAnswers,
        correct_answer: nextCorrectAnswer,
      })
      .eq("id", question.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadShowQuestions();
    if (activeEvent?.show_id === selectedShowId) {
      await handleRecalculateScores({ silent: true });
    }
    setToastMessage("Question updated.");
  };

  const handleMoveEventOrder = async (eventId: string, direction: "up" | "down") => {
    const ordered = showEvents;
    const index = ordered.findIndex((event) => event.id === eventId);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) {
      return;
    }
    const current = ordered[index];
    const target = ordered[nextIndex];
    const currentOrder = current.order_index ?? index + 1;
    const targetOrder = target.order_index ?? nextIndex + 1;
    const [{ error: currentError }, { error: targetError }] = await Promise.all([
      supabase.from("events").update({ order_index: targetOrder }).eq("id", current.id),
      supabase.from("events").update({ order_index: currentOrder }).eq("id", target.id),
    ]);
    if (currentError || targetError) {
      setMessage(currentError?.message ?? targetError?.message ?? "Failed to update order.");
      return;
    }
    refreshData();
  };

  const handleMoveMatchOrder = async (matchId: string, direction: "up" | "down") => {
    const ordered = orderedShowMatches;
    const index = ordered.findIndex((match) => match.id === matchId);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) {
      return;
    }
    const current = ordered[index];
    const target = ordered[nextIndex];
    const currentOrder = current.order_index ?? index + 1;
    const targetOrder = target.order_index ?? nextIndex + 1;
    const [{ error: currentError }, { error: targetError }] = await Promise.all([
      supabase.from("matches").update({ order_index: targetOrder }).eq("id", current.id),
      supabase.from("matches").update({ order_index: currentOrder }).eq("id", target.id),
    ]);
    if (currentError || targetError) {
      setMessage(currentError?.message ?? targetError?.message ?? "Failed to update order.");
      return;
    }
    refreshData();
  };

  const handleMoveEliminatorOrder = async (
    eliminatorId: string,
    direction: "up" | "down"
  ) => {
    const ordered = orderedShowEliminators;
    const index = ordered.findIndex((eliminator) => eliminator.id === eliminatorId);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) {
      return;
    }
    const current = ordered[index];
    const target = ordered[nextIndex];
    const currentOrder = current.order_index ?? index + 1;
    const targetOrder = target.order_index ?? nextIndex + 1;
    const [{ error: currentError }, { error: targetError }] = await Promise.all([
      supabase.from("eliminators").update({ order_index: targetOrder }).eq("id", current.id),
      supabase.from("eliminators").update({ order_index: currentOrder }).eq("id", target.id),
    ]);
    if (currentError || targetError) {
      setMessage(currentError?.message ?? targetError?.message ?? "Failed to update order.");
      return;
    }
    refreshData();
  };

  const handleUpdateShowOrder = async (item: {
    id: string;
    type: "event" | "match" | "eliminator" | "question";
  }) => {
    const key = `${item.type}:${item.id}`;
    const rawValue = orderIndexEdits[key];
    const normalized = rawValue?.trim() ?? "";
    if (normalized === "") {
      return;
    }
    const nextValue = Number(normalized);
    if (Number.isNaN(nextValue)) {
      setMessage("Order must be a number.");
      return;
    }
    const currentIndex = orderedShowItems.findIndex(
      (row) => row.id === item.id && row.type === item.type
    );
    if (currentIndex < 0) {
      return;
    }
    const clampedIndex = Math.min(
      Math.max(nextValue - 1, 0),
      Math.max(orderedShowItems.length - 1, 0)
    );
    const reordered = [...orderedShowItems];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(clampedIndex, 0, moved);
    const updates = reordered.map((row, index) => ({
      ...row,
      nextOrder: index + 1,
    }));
    const updatePromises = updates.map((row) => {
      const table =
        row.type === "event"
          ? "events"
          : row.type === "match"
            ? "matches"
            : row.type === "eliminator"
              ? "eliminators"
              : "show_questions";
      return supabase
        .from(table)
        .update({ order_index: row.nextOrder })
        .eq("id", row.id);
    });
    const results = await Promise.all(updatePromises);
    const errorResult = results.find((result) => result.error);
    if (errorResult?.error) {
      setMessage(errorResult.error.message);
      return;
    }
    setOrderIndexEdits((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    refreshData();
  };

  const handleCreateShow = async () => {
    setMessage(null);
    if (!showName.trim()) {
      setMessage("Show name is required.");
      return;
    }
    if (!showPromotionId) {
      setMessage("Select a promotion for the show.");
      return;
    }
    const nextShowSlug = normalizeSlug(showSlug || showName);
    if (!nextShowSlug || !isValidSlug(nextShowSlug)) {
      setMessage("Enter a share URL name using letters, numbers, and dashes.");
      return;
    }
    if (
      shows.some(
        (show) =>
          show.promotion_id === showPromotionId &&
          show.slug === nextShowSlug
      )
    ) {
      setMessage("That show share URL is already used by this promotion.");
      return;
    }
    const locationGateResult = buildShowLocationGatePayload({
      requiresLocationVerification: showRequiresLocationVerification,
      venueName: showVenueName,
      venueAddress: showVenueAddress,
      venueLatitude: showVenueLatitude,
      venueLongitude: showVenueLongitude,
      locationRadiusMeters: showLocationRadiusMeters,
    });
    if ("error" in locationGateResult) {
      setMessage(locationGateResult.error);
      return;
    }
    if (showIsFeaturedPlayShow) {
      const { error: clearFeaturedError } = await supabase
        .from("shows")
        .update({ is_featured_play_show: false })
        .eq("is_featured_play_show", true);
      if (clearFeaturedError) {
        setMessage(clearFeaturedError.message);
        return;
      }
    }
    const { data: newShow, error } = await supabase
      .from("shows")
      .insert({
        name: showName.trim(),
        slug: nextShowSlug,
        promotion_id: showPromotionId,
        image_url: showImageUrl.trim() || null,
        tagline: showTagline.trim() || null,
        status: "draft",
        starts_at: showStartsAt ? new Date(showStartsAt).toISOString() : null,
        requires_email_registration: showRequiresEmail,
        lock_picks_at_start: showLockPicksAtStart,
        is_featured_play_show: showIsFeaturedPlayShow,
        is_over: showIsOver,
        use_confidence_points: showUseConfidencePoints,
        ...locationGateResult.payload,
      })
      .select(
        "id, name, slug, tagline, image_url, promotion_id, requires_email_registration, lock_picks_at_start, is_featured_play_show, is_over, use_confidence_points, requires_location_verification, venue_name, venue_address, venue_latitude, venue_longitude, location_radius_meters"
      )
      .single();
    if (error || !newShow) {
      setMessage(error?.message ?? "Failed to create show.");
      return;
    }
    setShowName("");
    setShowSlug("");
    setShowPromotionId("");
    setShowImageUrl("");
    setShowStartsAt("");
    setShowTagline("");
    setShowRequiresEmail(true);
    setShowLockPicksAtStart(true);
    setShowIsFeaturedPlayShow(false);
    setShowIsOver(false);
    setShowUseConfidencePoints(false);
    setShowRequiresLocationVerification(false);
    setShowVenueName("");
    setShowVenueAddress("");
    setShowVenueLatitude("");
    setShowVenueLongitude("");
    setShowLocationRadiusMeters("");
    setSelectedShowId(newShow.id);
    setEventShowId(newShow.id);
    setShowModalOpen(false);
    setToastMessage(`Show created: ${newShow.name}. Active show updated.`);
    refreshData();
  };

  const handleCreatePromotion = async () => {
    setMessage(null);
    if (!promotionName.trim()) {
      setMessage("Promotion name is required.");
      return;
    }
    const nextPromotionSlug = normalizeSlug(promotionSlug || promotionName);
    if (!nextPromotionSlug || !isValidSlug(nextPromotionSlug)) {
      setMessage("Enter a promotion URL name using letters, numbers, and dashes.");
      return;
    }
    if (promotions.some((promotion) => promotion.slug === nextPromotionSlug)) {
      setMessage("That promotion URL name is already in use.");
      return;
    }
    const { data: newPromotion, error } = await supabase
      .from("promotions")
      .insert({
        name: promotionName.trim(),
        slug: nextPromotionSlug,
        image_url: promotionImageUrl.trim() || null,
      })
      .select("id, name, slug, image_url")
      .single();
    if (error || !newPromotion) {
      setMessage(error?.message ?? "Failed to create promotion.");
      return;
    }
    setPromotionName("");
    setPromotionSlug("");
    setPromotionImageUrl("");
    setPromotionModalOpen(false);
    setToastMessage(`Promotion created: ${newPromotion.name}.`);
    refreshData();
  };

  const handleUpdateShow = async () => {
    if (!activeShow) {
      setMessage("Select a show to edit.");
      return;
    }
    if (!showEditName.trim()) {
      setMessage("Show name is required.");
      return;
    }
    if (!showEditPromotionId) {
      setMessage("Select a promotion for the show.");
      return;
    }
    const nextShowSlug = normalizeSlug(showEditSlug || showEditName);
    if (!nextShowSlug || !isValidSlug(nextShowSlug)) {
      setMessage("Enter a share URL name using letters, numbers, and dashes.");
      return;
    }
    if (
      shows.some(
        (show) =>
          show.id !== activeShow.id &&
          show.promotion_id === showEditPromotionId &&
          show.slug === nextShowSlug
      )
    ) {
      setMessage("That show share URL is already used by this promotion.");
      return;
    }
    const locationGateResult = buildShowLocationGatePayload({
      requiresLocationVerification: showEditRequiresLocationVerification,
      venueName: showEditVenueName,
      venueAddress: showEditVenueAddress,
      venueLatitude: showEditVenueLatitude,
      venueLongitude: showEditVenueLongitude,
      locationRadiusMeters: showEditLocationRadiusMeters,
    });
    if ("error" in locationGateResult) {
      setMessage(locationGateResult.error);
      return;
    }
    setShowEditBusy(true);
    setMessage(null);
    if (showEditIsFeaturedPlayShow) {
      const { error: clearFeaturedError } = await supabase
        .from("shows")
        .update({ is_featured_play_show: false })
        .eq("is_featured_play_show", true)
        .neq("id", activeShow.id);
      if (clearFeaturedError) {
        setMessage(clearFeaturedError.message);
        setShowEditBusy(false);
        return;
      }
    }
    const payload = {
      name: showEditName.trim(),
      slug: nextShowSlug,
      promotion_id: showEditPromotionId,
      image_url: showEditImageUrl.trim() || null,
      tagline: showEditTagline.trim() || null,
      starts_at: showEditStartsAt
        ? new Date(showEditStartsAt).toISOString()
        : null,
      requires_email_registration: showEditRequiresEmail,
      lock_picks_at_start: showEditLockPicksAtStart,
      is_featured_play_show: showEditIsFeaturedPlayShow,
      is_over: showEditIsOver,
      use_confidence_points: showEditUseConfidencePoints,
      ...locationGateResult.payload,
    };
    const { data: updatedShow, error } = await supabase
      .from("shows")
      .update(payload)
      .eq("id", activeShow.id)
      .select(
        "id, name, slug, tagline, image_url, promotion_id, starts_at, status, requires_email_registration, lock_picks_at_start, is_featured_play_show, is_over, use_confidence_points, requires_location_verification, venue_name, venue_address, venue_latitude, venue_longitude, location_radius_meters"
      )
      .single();
    if (error || !updatedShow) {
      setMessage(error?.message ?? "Unable to update show.");
      setShowEditBusy(false);
      return;
    }
    setShows((prev) =>
      prev.map((show) => (show.id === updatedShow.id ? updatedShow : show))
    );
    setToastMessage(`Show updated: ${updatedShow.name}.`);
    refreshData();
    setShowEditBusy(false);
  };

  const handleDeleteShow = async () => {
    if (!activeShow) return;
    const confirmed = window.confirm(
      `Delete "${activeShow.name}" and all related events, matches, picks, and scores? This cannot be undone.`
    );
    if (!confirmed) return;
    setShowDeleteBusy(true);
    setMessage(null);
    try {
      const { data: eventRows, error: eventError } = await supabase
        .from("events")
        .select("id")
        .eq("show_id", activeShow.id);
      if (eventError) throw eventError;
      const eventIds = (eventRows ?? []).map((row) => row.id);

      const { data: matchRows, error: matchError } = await supabase
        .from("matches")
        .select("id")
        .eq("show_id", activeShow.id);
      if (matchError) throw matchError;
      const matchIds = (matchRows ?? []).map((row) => row.id);

      if (matchIds.length > 0) {
        const { error: matchEntrantError } = await supabase
          .from("match_entrants")
          .delete()
          .in("match_id", matchIds);
        if (matchEntrantError) throw matchEntrantError;

        const { error: matchSideError } = await supabase
          .from("match_sides")
          .delete()
          .in("match_id", matchIds);
        if (matchSideError) throw matchSideError;
      }

      if (eventIds.length > 0) {
        const { error: entryError } = await supabase
          .from("rumble_entries")
          .delete()
          .in("event_id", eventIds);
        if (entryError) throw entryError;

        const { error: customEntrantError } = await supabase
          .from("entrants")
          .delete()
          .in("event_id", eventIds)
          .eq("is_custom", true);
        if (customEntrantError) throw customEntrantError;
      }

      const { error: pickError } = await supabase
        .from("picks")
        .delete()
        .eq("show_id", activeShow.id);
      if (pickError) throw pickError;

      const { error: scoreError } = await supabase
        .from("scores")
        .delete()
        .eq("show_id", activeShow.id);
      if (scoreError) throw scoreError;

      if (eventIds.length > 0) {
        const { error: eventsDeleteError } = await supabase
          .from("events")
          .delete()
          .in("id", eventIds);
        if (eventsDeleteError) throw eventsDeleteError;
      }

      if (matchIds.length > 0) {
        const { error: matchesDeleteError } = await supabase
          .from("matches")
          .delete()
          .in("id", matchIds);
        if (matchesDeleteError) throw matchesDeleteError;
      }

      const { error: showDeleteError } = await supabase
        .from("shows")
        .delete()
        .eq("id", activeShow.id);
      if (showDeleteError) throw showDeleteError;

      setShows((prev) => prev.filter((show) => show.id !== activeShow.id));
      setSelectedShowId((prev) => {
        if (prev !== activeShow.id) return prev;
        const remaining = shows.filter((show) => show.id !== activeShow.id);
        return remaining[0]?.id ?? "";
      });
      setToastMessage("Show deleted.");
    } catch (error) {
      const err = error as { message?: string };
      setMessage(err?.message ?? "Failed to delete show.");
    } finally {
      setShowDeleteBusy(false);
    }
  };

  const handleAddCustomEntrant = async () => {
    if (!activeEvent) {
      setMessage("Select an event before adding a custom entrant.");
      return;
    }
    const trimmed = customEntrantName.trim();
    if (!trimmed) {
      setMessage("Custom entrant name is required.");
      return;
    }
    const normalized = trimmed.toLowerCase();
    const existing = filteredEntrantOptions.find(
      (entrant) => entrant.name.trim().toLowerCase() === normalized
    );
    if (existing) {
      setMessage("That entrant already exists on the roster.");
      return;
    }
    const mismatched = entrants.find(
      (entrant) => entrant.name.trim().toLowerCase() === normalized
    );
    if (mismatched) {
      setMessage(
        "That entrant exists on a different roster year. Adding as a custom entrant for this event."
      );
    }
    const { error } = await supabase.from("entrants").insert({
      name: trimmed,
      promotion: "Custom",
      gender: activeEvent.rumble_gender,
      roster_year: activeEvent.roster_year,
      event_id: activeEvent.id,
      is_custom: true,
      status: "approved",
      active: true,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setCustomEntrantName("");
    setMessage("Custom entrant added.");
    refreshData();
  };

  const handleApproveCustomEntrant = async (entrantId: string) => {
    const { error } = await supabase
      .from("entrants")
      .update({ status: "approved" })
      .eq("id", entrantId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Custom entrant approved.");
    refreshData();
  };

  const handleRejectCustomEntrant = async (entrantId: string) => {
    const { error } = await supabase.from("entrants").delete().eq("id", entrantId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Custom entrant rejected.");
    refreshData();
  };

  const handleUpdateEvent = async () => {
    if (!activeEvent) {
      setMessage("Select an event to update.");
      return;
    }
    setEventUpdateBusy(true);
    setMessage(null);
    const { error } = await supabase
      .from("events")
      .update({
        roster_year: eventRosterYear ? Number(eventRosterYear) : null,
        show_id: eventShowId || null,
        iron_person_entrant_id: eventIronPersonId || null,
      })
      .eq("id", activeEvent.id);
    if (error) {
      setMessage(error.message);
      setEventUpdateBusy(false);
      return;
    }
    setMessage("Event updated.");
    setEventUpdateBusy(false);
    refreshData();
  };

  const handleUpdateEntry = async (entry: RumbleEntryRow) => {
    setMessage(null);
    const before = entries.find((item) => item.id === entry.id) ?? null;
    const nextEliminatedAt = entry.eliminated_by
      ? entry.eliminated_at ?? new Date().toISOString()
      : null;
    const { error } = await supabase
      .from("rumble_entries")
      .update({
        entry_number: entry.entry_number,
        eliminations_count: entry.eliminations_count,
        eliminated_by: entry.eliminated_by || null,
        eliminated_at: nextEliminatedAt,
        is_confirmed: entry.is_confirmed ?? false,
      })
      .eq("id", entry.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (activeEvent && before) {
      await logEventAction(activeEvent.id, "update_entry", {
        entrant_id: entry.entrant_id,
        entrant_name: entrantMap.get(entry.entrant_id)?.name ?? null,
        before,
        after: { ...entry, eliminated_at: nextEliminatedAt },
      });
    }
    await handleRecalculateScores({ silent: true });
    setMessage("Entry updated.");
    refreshData();
  };

  const handleRemoveEntry = async (entryId: string) => {
    if (!activeEvent) return;
    const shouldRemove = window.confirm(
      "Remove this entrant from the event? This cannot be undone."
    );
    if (!shouldRemove) return;
    setMessage(null);
    const existingEntry = entries.find((item) => item.id === entryId) ?? null;
    const { error } = await supabase.from("rumble_entries").delete().eq("id", entryId);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (existingEntry) {
      await logEventAction(activeEvent.id, "remove_entry", {
        entry: existingEntry,
        entrant_id: existingEntry.entrant_id,
        entrant_name: entrantMap.get(existingEntry.entrant_id)?.name ?? null,
      });
    }
    await handleRecalculateScores({ silent: true });
    setMessage("Entry removed.");
    refreshData();
  };

  const handleAddEntry = async () => {
    setMessage(null);
    if (!activeEvent) {
      setMessage("Create an event first.");
      return;
    }
    if (!entryEntrantId) {
      setMessage("Select an entrant.");
      return;
    }
    const numberValue = entryNumber ? Number(entryNumber) : null;
    if (entryNumber && Number.isNaN(numberValue)) {
      setMessage("Entry number must be a number.");
      return;
    }
    const { data: newEntry, error } = await supabase
      .from("rumble_entries")
      .insert({
        event_id: activeEvent.id,
        entrant_id: entryEntrantId,
        entry_number: numberValue,
        is_confirmed: entryConfirmed,
      })
      .select("id, entrant_id, entry_number, eliminated_by, eliminated_at, eliminations_count, is_confirmed")
      .single();
    if (error) {
      setMessage(error.message);
      return;
    }
    if (newEntry) {
      await logEventAction(activeEvent.id, "add_entry", {
        entry: newEntry,
        entrant_id: newEntry.entrant_id,
        entrant_name: entrantMap.get(newEntry.entrant_id)?.name ?? null,
      });
    }
    setEntryEntrantId("");
    setEntryNumber("");
    setEntryConfirmed(false);
    refreshData();
  };

  const handleAddMatch = async () => {
    setMessage(null);
    if (!selectedShowId) {
      setMessage("Select a show before adding matches.");
      return;
    }
    if (!matchName.trim()) {
      setMessage("Enter a match name.");
      return;
    }
    if (matchType === "blind_gauntlet") {
      const uniqueCandidateIds = [...new Set(matchCandidateIds)];
      if (!matchKnownWrestlerId) {
        setMessage("Select the known wrestler for this Blind Gauntlet Match.");
        return;
      }
      if (uniqueCandidateIds.includes(matchKnownWrestlerId)) {
        setMessage("Candidate entrants cannot include the known wrestler.");
        return;
      }
      if (uniqueCandidateIds.length < 3 || uniqueCandidateIds.length > 20) {
        setMessage("Select 3 to 20 candidate entrants for this Blind Gauntlet Match.");
        return;
      }
    }
    const { data: newMatch, error } = await supabase
      .from("matches")
      .insert({
        event_id: null,
        show_id: selectedShowId,
        name: matchName.trim(),
        kind: matchKind.trim() || "match",
        match_type: matchType,
        roster_year: matchRosterYear ? Number(matchRosterYear) : null,
        roster_gender: matchRosterGender || null,
        is_main_event: matchIsMainEvent,
        is_championship: matchIsChampionship,
        championship_name: matchIsChampionship
          ? matchChampionshipName.trim() || null
          : null,
        championship_image_url: matchIsChampionship
          ? matchChampionshipImageUrl.trim() || null
          : null,
        champion_side_id: null,
        known_wrestler_id:
          matchType === "blind_gauntlet" ? matchKnownWrestlerId : null,
      })
      .select("id")
      .single();
    if (error || !newMatch) {
      setMessage(error?.message ?? "Failed to create match.");
      return;
    }

    if (matchType === "blind_gauntlet") {
      const { error: candidateError } = await supabase
        .from("gauntlet_candidate_entrants")
        .insert(
          [...new Set(matchCandidateIds)].map((entrantId) => ({
            match_id: newMatch.id,
            entrant_id: entrantId,
          }))
        );
      if (candidateError) {
        setMessage(candidateError.message);
        return;
      }
      setMatchName("");
      setMatchKind("match");
      setMatchType("singles");
      setMatchRosterYear("");
      setMatchRosterGender("men");
      setMatchIsMainEvent(false);
      setMatchIsChampionship(false);
      setMatchChampionshipName("");
      setMatchChampionshipImageUrl("");
      setMatchKnownWrestlerId("");
      setMatchCandidateIds([]);
      setMatchCreateOpen(false);
      refreshData();
      return;
    }

    const sideCounts: Record<string, number> = {
      singles: 2,
      tag: 2,
      tag_3: 2,
      tag_4: 2,
      tag_4_way: 4,
      triple_threat: 3,
      fatal_4_way: 4,
      ladder_6: 6,
      multi: 2,
    };
    const count = sideCounts[matchType] ?? 2;
    const labels = ["Side A", "Side B", "Side C", "Side D", "Side E", "Side F"];
    const sideRows = Array.from({ length: count }).map((_, index) => ({
      match_id: newMatch.id,
      label: labels[index] ?? `Side ${index + 1}`,
    }));
    const { error: sideError } = await supabase
      .from("match_sides")
      .insert(sideRows);
    if (sideError) {
      setMessage(sideError.message);
      return;
    }
    setMatchName("");
    setMatchKind("match");
    setMatchType("singles");
    setMatchRosterYear("");
    setMatchRosterGender("men");
    setMatchIsMainEvent(false);
    setMatchIsChampionship(false);
    setMatchChampionshipName("");
    setMatchChampionshipImageUrl("");
    setMatchKnownWrestlerId("");
    setMatchCandidateIds([]);
    setMatchCreateOpen(false);
    refreshData();
  };

  const handleCreateEliminator = async () => {
    setMessage(null);
    if (!selectedShowId) {
      setMessage("Select a show before adding eliminators.");
      return;
    }
    if (!eliminatorName.trim()) {
      setMessage("Enter an eliminator name.");
      return;
    }
    const limit = Number(eliminatorEntrantLimit);
    if (Number.isNaN(limit) || limit < 6 || limit > 10) {
      setMessage("Eliminator size must be between 6 and 10.");
      return;
    }
    const { error } = await supabase.from("eliminators").insert({
      show_id: selectedShowId,
      name: eliminatorName.trim(),
      roster_year: eliminatorRosterYear ? Number(eliminatorRosterYear) : null,
      roster_gender: eliminatorRosterGender || null,
      entrant_limit: limit,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setEliminatorName("");
    setEliminatorRosterYear("");
    setEliminatorRosterGender("men");
    setEliminatorEntrantLimit("6");
    setEliminatorCreateOpen(false);
    refreshData();
  };

  const handleAddEliminatorEntry = async (eliminatorId: string) => {
    if (!eliminatorId || !eliminatorEntrantId) return;
    setMessage(null);
    const { error } = await supabase.from("eliminator_entries").insert({
      eliminator_id: eliminatorId,
      entrant_id: eliminatorEntrantId,
      entry_order: null,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setEliminatorEntrantId("");
    refreshData();
  };

  const handleUpdateEliminatorEntryOrder = async (
    eliminatorId: string,
    entrantId: string,
    entryOrder: number | null
  ) => {
    setMessage(null);
    const { error } = await supabase
      .from("eliminator_entries")
      .update({ entry_order: entryOrder })
      .eq("eliminator_id", eliminatorId)
      .eq("entrant_id", entrantId);
    if (error) {
      setMessage(error.message);
      return;
    }
    refreshData();
  };


  const handleRemoveEliminatorEntry = async (
    eliminatorId: string,
    entrantId: string
  ) => {
    const shouldRemove = window.confirm(
      "Remove this entrant from the eliminator?"
    );
    if (!shouldRemove) return;
    setMessage(null);
    const { error } = await supabase
      .from("eliminator_entries")
      .delete()
      .eq("eliminator_id", eliminatorId)
      .eq("entrant_id", entrantId);
    if (error) {
      setMessage(error.message);
      return;
    }
    refreshData();
  };

  const handleAddEliminatorElimination = async (eliminatorId: string) => {
    if (!eliminatorId || !eliminatorEliminatedId) return;
    setMessage(null);
    const order = Number(eliminatorEliminationOrder);
    if (Number.isNaN(order) || order <= 0) {
      setMessage("Elimination order must be a number.");
      return;
    }
    const { error } = await supabase.from("eliminator_eliminations").insert({
      eliminator_id: eliminatorId,
      eliminated_entrant_id: eliminatorEliminatedId,
      eliminated_by_entrant_id: eliminatorEliminatedById || null,
      elimination_type: eliminatorEliminationType,
      elimination_order: order,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setEliminatorEliminatedId("");
    setEliminatorEliminatedById("");
    setEliminatorEliminationType("pinfall");
    setEliminatorEliminationOrder("");
    refreshData();
  };

  const handleRemoveEliminatorElimination = async (id: string) => {
    const shouldRemove = window.confirm("Remove this elimination entry?");
    if (!shouldRemove) return;
    setMessage(null);
    const { error } = await supabase
      .from("eliminator_eliminations")
      .delete()
      .eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    refreshData();
  };

  const handleAddMatchEntrant = async (
    matchId: string,
    entrantId: string,
    sideId: string
  ) => {
    if (!matchId || !entrantId || !sideId) return;
    setMessage(null);
    const { error } = await supabase.from("match_entrants").insert({
      match_id: matchId,
      entrant_id: entrantId,
      side_id: sideId,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    refreshData();
  };

  const handleRemoveMatchEntrant = async (matchId: string, entrantId: string) => {
    const shouldRemove = window.confirm(
      "Remove this participant from the match?"
    );
    if (!shouldRemove) return;
    setMessage(null);
    const { error } = await supabase
      .from("match_entrants")
      .delete()
      .eq("match_id", matchId)
      .eq("entrant_id", entrantId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await handleRecalculateScores({ silent: true });
    refreshData();
  };

  const handleSetMatchWinner = async (matchId: string, winnerSideId: string) => {
    setMessage(null);
    const sideEntrants = matchEntrants.filter(
      (row) => row.match_id === matchId && row.side_id === winnerSideId
    );
    const winnerEntrantId =
      sideEntrants.length === 1 ? sideEntrants[0].entrant_id : null;
    const { error } = await supabase
      .from("matches")
      .update({
        winner_side_id: winnerSideId || null,
        winner_entrant_id: winnerSideId ? winnerEntrantId : null,
        status: winnerSideId ? "completed" : "scheduled",
      })
      .eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await handleRecalculateScores({ silent: true });
    refreshData();
  };

  const handleAddMatchSide = async (matchId: string) => {
    if (!matchId) return;
    setMessage(null);
    const { error } = await supabase.from("match_sides").insert({
      match_id: matchId,
      label: "New side",
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    refreshData();
  };

  const handleUpdateMatchSideLabel = async (sideId: string, label: string) => {
    setMessage(null);
    const { error } = await supabase
      .from("match_sides")
      .update({ label: label.trim() || null })
      .eq("id", sideId);
    if (error) {
      setMessage(error.message);
      return;
    }
    refreshData();
  };

  const handleUpdateMatchSideImage = async (sideId: string, imageUrl: string) => {
    setMessage(null);
    const { error } = await supabase
      .from("match_sides")
      .update({ image_url: imageUrl.trim() || null })
      .eq("id", sideId);
    if (error) {
      setMessage(error.message);
      return;
    }
    refreshData();
  };

  const handleUpdateMatchName = async (matchId: string, name: string) => {
    setMessage(null);
    if (!name.trim()) {
      setMessage("Match name cannot be empty.");
      return;
    }
    const { error } = await supabase
      .from("matches")
      .update({ name: name.trim() })
      .eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Match updated.");
    refreshData();
  };

  const handleUpdateMatchDetails = async (matchId: string) => {
    setMessage(null);
    const isMainEvent = matchMainEventEdits[matchId] ?? false;
    const isChampionship = matchChampionshipEdits[matchId] ?? false;
    const beltName = matchChampionshipNameEdits[matchId] ?? "";
    const beltImageUrl = matchChampionshipImageEdits[matchId] ?? "";
    const currentMatch = matches.find((row) => row.id === matchId);
    const championSideId =
      matchChampionSideEdits[matchId] ?? currentMatch?.champion_side_id ?? "";
    const { error } = await supabase
      .from("matches")
      .update({
        is_main_event: isMainEvent,
        is_championship: isChampionship,
        championship_name: isChampionship ? beltName.trim() || null : null,
        championship_image_url: isChampionship ? beltImageUrl.trim() || null : null,
        champion_side_id: isChampionship ? championSideId || null : null,
      })
      .eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Match details updated.");
    refreshData();
  };

  const handleUpdateBlindGauntletKnownWrestler = async (matchId: string) => {
    const knownWrestlerId = matchKnownWrestlerEdits[matchId] ?? "";
    const candidateIds =
      gauntletCandidateEntrantsByMatch[matchId]?.map((row) => row.entrant_id) ??
      [];
    if (!knownWrestlerId) {
      setMessage("Select a known wrestler.");
      return;
    }
    if (candidateIds.includes(knownWrestlerId)) {
      setMessage("The known wrestler cannot also be a candidate entrant.");
      return;
    }
    const { error } = await supabase
      .from("matches")
      .update({ known_wrestler_id: knownWrestlerId })
      .eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setToastMessage("Known wrestler updated.");
    refreshData();
  };

  const handleAddGauntletCandidate = async (matchId: string) => {
    const entrantId = matchGauntletCandidateSelection[matchId] ?? "";
    const match = matches.find((row) => row.id === matchId);
    const currentCandidates = gauntletCandidateEntrantsByMatch[matchId] ?? [];
    if (!entrantId) return;
    if (entrantId === match?.known_wrestler_id) {
      setMessage("Candidate entrants cannot include the known wrestler.");
      return;
    }
    if (currentCandidates.length >= 20) {
      setMessage("Blind Gauntlet candidate pool cannot exceed 20 entrants.");
      return;
    }
    const { error } = await supabase.from("gauntlet_candidate_entrants").insert({
      match_id: matchId,
      entrant_id: entrantId,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMatchGauntletCandidateSelection((prev) => ({ ...prev, [matchId]: "" }));
    refreshData();
  };

  const handleRemoveGauntletCandidate = async (
    matchId: string,
    entrantId: string
  ) => {
    const { error } = await supabase
      .from("gauntlet_candidate_entrants")
      .delete()
      .eq("match_id", matchId)
      .eq("entrant_id", entrantId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await supabase
      .from("gauntlet_actual_entrants")
      .delete()
      .eq("match_id", matchId)
      .eq("entrant_id", entrantId);
    refreshData();
  };

  const handleSetGauntletSurvivalResult = async (matchId: string) => {
    const value = matchGauntletSurvivalEdits[matchId] ?? "";
    const { error } = await supabase
      .from("matches")
      .update({
        gauntlet_survival_result: value === "" ? null : value === "true",
      })
      .eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await handleRecalculateScores({ silent: true });
    refreshData();
  };

  const handleAddGauntletActual = async (matchId: string) => {
    const entrantId = matchGauntletActualSelection[matchId] ?? "";
    const candidateIds = new Set(
      (gauntletCandidateEntrantsByMatch[matchId] ?? []).map(
        (row) => row.entrant_id
      )
    );
    if (!entrantId) return;
    if (!candidateIds.has(entrantId)) {
      setMessage("Actual entrants must be from the candidate pool.");
      return;
    }
    const { error } = await supabase.from("gauntlet_actual_entrants").insert({
      match_id: matchId,
      entrant_id: entrantId,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMatchGauntletActualSelection((prev) => ({ ...prev, [matchId]: "" }));
    await handleRecalculateScores({ silent: true });
    refreshData();
  };

  const handleRemoveGauntletActual = async (
    matchId: string,
    entrantId: string
  ) => {
    const match = matches.find((row) => row.id === matchId);
    const updates =
      match?.gauntlet_final_entrant_id === entrantId
        ? supabase
            .from("matches")
            .update({ gauntlet_final_entrant_id: null })
            .eq("id", matchId)
        : Promise.resolve({ error: null });
    const [{ error: updateError }, { error: deleteError }] = await Promise.all([
      updates,
      supabase
        .from("gauntlet_actual_entrants")
        .delete()
        .eq("match_id", matchId)
        .eq("entrant_id", entrantId),
    ]);
    if (updateError || deleteError) {
      setMessage(updateError?.message ?? deleteError?.message ?? "Failed to update result.");
      return;
    }
    await handleRecalculateScores({ silent: true });
    refreshData();
  };

  const handleSetGauntletFinalEntrant = async (matchId: string) => {
    const entrantId = matchGauntletFinalEdits[matchId] ?? "";
    const actualIds = new Set(
      (gauntletActualEntrantsByMatch[matchId] ?? []).map((row) => row.entrant_id)
    );
    if (entrantId && !actualIds.has(entrantId)) {
      setMessage("Final entrant must be one of the actual entrants.");
      return;
    }
    const { error } = await supabase
      .from("matches")
      .update({ gauntlet_final_entrant_id: entrantId || null })
      .eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await handleRecalculateScores({ silent: true });
    refreshData();
  };

  const handleSetMatchFinish = async (
    matchId: string,
    method: string,
    winnerId: string,
    loserId: string
  ) => {
    setMessage(null);
    const normalized = method || "";
    const usesEntrants = normalized === "pinfall" || normalized === "submission";
    const updates = {
      finish_method: normalized || null,
      finish_winner_entrant_id: usesEntrants ? winnerId || null : null,
      finish_loser_entrant_id: usesEntrants ? loserId || null : null,
    };
    const { error } = await supabase
      .from("matches")
      .update(updates)
      .eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await handleRecalculateScores({ silent: true });
    setToastMessage("Match finish updated.");
    refreshData();
  };

  const handleSetMatchLength = async (matchId: string, length: string) => {
    setMessage(null);
    const normalized = length || null;
    const { error } = await supabase
      .from("matches")
      .update({ match_length: normalized })
      .eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await handleRecalculateScores({ silent: true });
    setToastMessage("Match length updated.");
    refreshData();
  };

  const handleSetMatchInterference = async (matchId: string, value: string) => {
    setMessage(null);
    const normalized = value || null;
    const { error } = await supabase
      .from("matches")
      .update({ match_interference: normalized })
      .eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await handleRecalculateScores({ silent: true });
    setToastMessage("Match interference updated.");
    refreshData();
  };

  const handleDeleteMatch = async (matchId: string) => {
    setMessage(null);
    const { error } = await supabase.from("matches").delete().eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Match deleted.");
    refreshData();
  };

  const handleClearMatchResults = async (matchId: string) => {
    setMessage(null);
    const { error } = await supabase
      .from("matches")
      .update({
        winner_side_id: null,
        winner_entrant_id: null,
        finish_method: null,
        finish_winner_entrant_id: null,
        finish_loser_entrant_id: null,
        match_length: null,
        match_interference: null,
        gauntlet_survival_result: null,
        gauntlet_final_entrant_id: null,
      })
      .eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await supabase.from("gauntlet_actual_entrants").delete().eq("match_id", matchId);
    setToastMessage("Match results cleared.");
    setMatchLengthEdits((prev) => ({ ...prev, [matchId]: "" }));
    refreshData();
  };

  const handleClearEliminatorResults = async (eliminatorId: string) => {
    setMessage(null);
    const { error: entryError } = await supabase
      .from("eliminator_entries")
      .update({ entry_order: null })
      .eq("eliminator_id", eliminatorId);
    if (entryError) {
      setMessage(entryError.message);
      return;
    }
    const { error: elimError } = await supabase
      .from("eliminator_eliminations")
      .delete()
      .eq("eliminator_id", eliminatorId);
    if (elimError) {
      setMessage(elimError.message);
      return;
    }
    const { error: winnerError } = await supabase
      .from("eliminators")
      .update({ winner_entrant_id: null })
      .eq("id", eliminatorId);
    if (winnerError) {
      setMessage(winnerError.message);
      return;
    }
    setToastMessage("Eliminator results cleared.");
    refreshData();
  };

  const handleSetEliminatorWinner = async (
    eliminatorId: string,
    winnerId: string | null
  ) => {
    setMessage(null);
    const { error } = await supabase
      .from("eliminators")
      .update({ winner_entrant_id: winnerId || null })
      .eq("id", eliminatorId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setEliminators((prev) =>
      prev.map((row) =>
        row.id === eliminatorId
          ? { ...row, winner_entrant_id: winnerId || null }
          : row
      )
    );
  };

  useEffect(() => {
    if (!entryEntrantId) {
      if (entryNumber) {
        setEntryNumber("");
      }
      return;
    }
    if (entryConfirmed) {
      if (entryNumber) {
        setEntryNumber("");
      }
      return;
    }
    if (!entryNumber) {
      setEntryNumber(String(entries.length + 1));
    }
  }, [entryEntrantId, entryNumber, entries.length, entryConfirmed]);

  const handleElimination = async () => {
    setMessage(null);
    if (!eliminateEntryId) {
      setMessage("Choose a rumble entry to eliminate.");
      return;
    }
    const eliminatedBefore =
      entries.find((entry) => entry.id === eliminateEntryId) ?? null;
    const eliminatorBefore =
      eliminatedById &&
      entries.find((entry) => entry.entrant_id === eliminatedById);
    const eliminatedAt = new Date().toISOString();
    const { error } = await supabase
      .from("rumble_entries")
      .update({
        eliminated_by: eliminatedById || null,
        eliminated_at: eliminatedAt,
      })
      .eq("id", eliminateEntryId);
    if (error) {
      setMessage(error.message);
      return;
    }

    if (eliminatedById) {
      const { data: eliminatorEntry, error: eliminatorError } = await supabase
        .from("rumble_entries")
        .select("id, eliminations_count")
        .eq("event_id", activeEvent?.id ?? "")
        .eq("entrant_id", eliminatedById)
        .maybeSingle();
      if (!eliminatorError && eliminatorEntry) {
        await supabase
          .from("rumble_entries")
          .update({
            eliminations_count: (eliminatorEntry.eliminations_count ?? 0) + 1,
          })
          .eq("id", eliminatorEntry.id);
      }
    }

    if (activeEvent && eliminatedBefore) {
      const eliminatedAfter: RumbleEntryRow = {
        ...eliminatedBefore,
        eliminated_by: eliminatedById || null,
        eliminated_at: eliminatedAt,
      };
      const eliminatorAfter =
        eliminatorBefore && eliminatedById
          ? {
              ...eliminatorBefore,
              eliminations_count: (eliminatorBefore.eliminations_count ?? 0) + 1,
            }
          : null;
      await logEventAction(activeEvent.id, "elimination", {
        eliminated_entry_before: eliminatedBefore,
        eliminated_entry_after: eliminatedAfter,
        eliminator_before: eliminatorBefore ?? null,
        eliminator_after: eliminatorAfter,
        eliminated_entrant_name: entrantMap.get(eliminatedBefore.entrant_id)?.name ?? null,
        eliminator_name: eliminatedById
          ? entrantMap.get(eliminatedById)?.name ?? null
          : null,
      });
    }

    await handleRecalculateScores({ silent: true });
    setEliminateEntryId("");
    setEliminatedById("");
    refreshData();
  };

  const handleSaveAllEntries = async () => {
    if (!activeEvent) {
      setMessage("Create an event first.");
      return;
    }
    const changed = getChangedEntries();
    if (changed.length === 0) {
      setMessage("No entry changes to save.");
      return;
    }
    setBulkEntrySaveBusy(true);
    setMessage(null);
    const snapshotMap = new Map(entriesSnapshot.map((entry) => [entry.id, entry]));
    try {
      for (const entry of changed) {
        const nextEliminatedAt = entry.eliminated_by
          ? entry.eliminated_at ?? new Date().toISOString()
          : null;
        const { error } = await supabase
          .from("rumble_entries")
          .update({
            entry_number: entry.entry_number,
            eliminations_count: entry.eliminations_count,
            eliminated_by: entry.eliminated_by || null,
            eliminated_at: nextEliminatedAt,
            is_confirmed: entry.is_confirmed ?? false,
          })
          .eq("id", entry.id);
        if (error) throw error;
        const before = snapshotMap.get(entry.id);
        if (before) {
          await logEventAction(activeEvent.id, "update_entry", {
            entrant_id: entry.entrant_id,
            entrant_name: entrantMap.get(entry.entrant_id)?.name ?? null,
            before,
            after: { ...entry, eliminated_at: nextEliminatedAt },
          });
        }
        setEntries((prev) =>
          prev.map((item) =>
            item.id === entry.id
              ? { ...item, eliminated_at: nextEliminatedAt }
              : item
          )
        );
      }
      await handleRecalculateScores({ silent: true });
      setMessage(`Saved ${changed.length} entr${changed.length === 1 ? "y" : "ies"}.`);
      refreshData();
    } catch (error) {
      const err = error as { message?: string };
      setMessage(err.message ?? "Failed to save entries.");
    } finally {
      setBulkEntrySaveBusy(false);
    }
  };

  const handleRecalculateScores = async (
    options?: { silent?: boolean }
  ) => {
    if (!activeEvent) {
      setMessage("Create an event before recalculating scores.");
      return;
    }
    setRecalcBusy(true);
    if (!options?.silent) {
      setMessage(null);
    }

    const [
      { data: pickRows, error: pickError },
      { data: entryRows, error: entryError },
      { data: matchRows, error: matchError },
      { data: matchSideRows, error: matchSideError },
      { data: matchEntrantRows, error: matchEntrantError },
      { data: gauntletActualRows, error: gauntletActualError },
    ] = await Promise.all([
      supabase
        .from("picks")
        .select("id, user_id, payload")
        .eq("event_id", activeEvent.id),
      supabase
        .from("rumble_entries")
        .select(
          "id, entrant_id, entry_number, eliminated_at, eliminations_count, is_confirmed"
        )
        .eq("event_id", activeEvent.id),
      supabase
        .from("matches")
        .select(
          "id, match_type, winner_entrant_id, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id, match_length, match_interference, gauntlet_survival_result, gauntlet_final_entrant_id"
        )
        .eq("event_id", activeEvent.id),
      supabase
        .from("match_sides")
        .select("id, match_id, label, image_url"),
      supabase
        .from("match_entrants")
        .select("match_id, entrant_id, side_id"),
      supabase
        .from("gauntlet_actual_entrants")
        .select("match_id, entrant_id"),
    ]);

    if (pickError) {
      setMessage(pickError.message);
      setRecalcBusy(false);
      return;
    }
    if (entryError) {
      setMessage(entryError.message);
      setRecalcBusy(false);
      return;
    }
    if (matchError) {
      setMessage(matchError.message);
      setRecalcBusy(false);
      return;
    }
    if (matchSideError) {
      setMessage(matchSideError.message);
      setRecalcBusy(false);
      return;
    }
    if (matchEntrantError) {
      setMessage(matchEntrantError.message);
      setRecalcBusy(false);
      return;
    }
    if (gauntletActualError) {
      setMessage(gauntletActualError.message);
      setRecalcBusy(false);
      return;
    }

    const picks = (pickRows ?? []) as PickRow[];
    const entries = (entryRows ?? []) as RumbleEntryRow[];

    if (picks.length === 0) {
      setMessage("No picks found for this event yet.");
      setRecalcBusy(false);
      return;
    }

    const matchList = (matchRows ?? []) as {
      id: string;
      winner_entrant_id: string | null;
      winner_side_id: string | null;
      finish_method: string | null;
      finish_winner_entrant_id: string | null;
      finish_loser_entrant_id: string | null;
      match_length?: string | null;
      match_interference?: string | null;
      gauntlet_survival_result?: boolean | null;
      gauntlet_final_entrant_id?: string | null;
    }[];
    const matchIdSet = new Set(matchList.map((match) => match.id));
    const matchEntrantList = (matchEntrantRows ?? [])
      .filter((row) => matchIdSet.has(row.match_id)) as {
      match_id: string;
      entrant_id: string;
      side_id: string | null;
    }[];
    const matchSideList = (matchSideRows ?? [])
      .filter((row) => matchIdSet.has(row.match_id)) as {
      id: string;
      match_id: string;
      label: string | null;
    }[];
    const gauntletActualList = (gauntletActualRows ?? []).filter((row) =>
      matchIdSet.has(row.match_id)
    ) as { match_id: string; entrant_id: string }[];

    const eliminatorEntries: EliminatorEntryRow[] = [];
    const eliminatorEliminations: EliminatorEliminationRow[] = [];
    const eliminatorList: { id: string; winner_entrant_id: string | null }[] = [];
    const questionList: { id: string; correct_answer?: string | null }[] = [];
    if (activeEvent.show_id) {
      const [{ data: eliminatorRows }, { data: questionRows }] = await Promise.all([
        supabase
          .from("eliminators")
          .select("id, winner_entrant_id")
          .eq("show_id", activeEvent.show_id),
        supabase
          .from("show_questions")
          .select("id, correct_answer")
          .eq("show_id", activeEvent.show_id),
      ]);
      const eliminatorIds = (eliminatorRows ?? []).map((row) => row.id);
      eliminatorList.push(...((eliminatorRows ?? []) as { id: string; winner_entrant_id: string | null }[]));
      questionList.push(...((questionRows ?? []) as { id: string; correct_answer?: string | null }[]));
      if (eliminatorIds.length > 0) {
        const [
          { data: eliminatorEntryRows },
          { data: eliminatorEliminationRows },
        ] = await Promise.all([
          supabase
            .from("eliminator_entries")
            .select("eliminator_id, entrant_id, entry_order")
            .in("eliminator_id", eliminatorIds),
          supabase
            .from("eliminator_eliminations")
            .select(
              "eliminator_id, eliminated_entrant_id, eliminated_by_entrant_id, elimination_type, elimination_order"
            )
            .in("eliminator_id", eliminatorIds),
        ]);
        eliminatorEntries.push(
          ...((eliminatorEntryRows ?? []) as EliminatorEntryRow[])
        );
        eliminatorEliminations.push(
          ...((eliminatorEliminationRows ?? []) as EliminatorEliminationRow[])
        );
      }
    }
    const scoreRows = picks.map((pick) => {
      const payload = (pick.payload ?? {}) as PicksPayload;
      const { points, breakdown } = calculateScore(
        payload,
        entries,
        scoringRules,
        matchList,
        matchEntrantList,
        matchSideList,
        {
          ironPersonId: activeEvent.iron_person_entrant_id ?? null,
          useConfidencePoints: activeShow?.use_confidence_points ?? false,
        },
        eliminatorEntries,
        eliminatorEliminations,
        eliminatorList,
        questionList,
        gauntletActualList
      );
      return {
        user_id: pick.user_id,
        event_id: activeEvent.id,
        show_id:
          activeEvent.show_id ??
          activeShow?.id ??
          selectedShowId ??
          null,
        points,
        breakdown,
        updated_at: new Date().toISOString(),
      };
    });

    const { error: scoreError } = await supabase
      .from("scores")
      .upsert(scoreRows, { onConflict: "user_id,event_id" });

    if (scoreError) {
      setMessage(scoreError.message);
      setRecalcBusy(false);
      return;
    }

    if (!options?.silent) {
      setMessage("Scores recalculated.");
    }
    setRecalcBusy(false);
  };

  const handleClearShowScores = async () => {
    if (!activeShow) {
      setMessage("Select a show before clearing scores.");
      return;
    }
    const confirmed = window.confirm(
      `Clear all picks and scores for "${activeShow.name}"? This will delete all picks and reset the scoreboard.`
    );
    if (!confirmed) return;
    setClearScoresBusy(true);
    setMessage(null);
    try {
      const { error: picksError } = await supabase
        .from("picks")
        .delete()
        .eq("show_id", activeShow.id);
      if (picksError) throw picksError;

      const { error: scoresError } = await supabase
        .from("scores")
        .delete()
        .eq("show_id", activeShow.id);
      if (scoresError) throw scoresError;

      setMessage("Scores and picks cleared for this show.");
    } catch (error) {
      const err = error as { message?: string };
      setMessage(err.message ?? "Failed to clear scores and picks.");
    } finally {
      setClearScoresBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
          <p>Loading admin console…</p>
        </main>
      </div>
    );
  }

  if (!sessionEmail) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-semibold">Sign in required</h1>
          <p className="mt-4 text-sm text-zinc-400">
            Visit the login screen to access the admin console.
          </p>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-semibold">Admin access only</h1>
          <p className="mt-4 text-sm text-zinc-400">
            Your account does not have admin privileges.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr] lg:px-6 lg:py-8">
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <div className="rounded-3xl border border-zinc-800 bg-black/50 p-4">
            <p className="text-xl font-black uppercase italic tracking-wide text-amber-300">
              BoutPick
            </p>
            <label className="mt-5 block text-[10px] uppercase tracking-[0.25em] text-zinc-500">
              Promotion
              <select
                className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                value={activeShow?.promotion_id ?? ""}
                onChange={(event) => {
                  const nextShow = shows.find(
                    (show) => show.promotion_id === event.target.value
                  );
                  if (nextShow) setSelectedShowId(nextShow.id);
                }}
              >
                <option value="">Select promotion</option>
                {promotions.map((promotion) => (
                  <option key={promotion.id} value={promotion.id}>
                    {promotion.name}
                  </option>
                ))}
              </select>
            </label>
            <nav className="mt-5 grid gap-2">
              {[
                ["dashboard", "Dashboard"],
                ["setup", "Shows"],
                ["card", "Card Builder"],
                ["results", "Results"],
                ["scoreboard", "Scoreboard"],
                ["advanced", "Advanced"],
              ].map(([view, label]) => (
                <button
                  key={view}
                  className={`flex h-11 items-center justify-between rounded-xl px-3 text-left text-sm font-medium transition ${
                    adminView === view
                      ? "border border-amber-400/40 bg-amber-400/15 text-amber-200"
                      : "border border-transparent text-zinc-300 hover:border-zinc-800 hover:bg-zinc-900"
                  }`}
                  type="button"
                  onClick={() => setAdminView(view as AdminView)}
                >
                  <span>{label}</span>
                  {view === "advanced" ? <span className="text-zinc-500">+</span> : null}
                </button>
              ))}
            </nav>
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs font-semibold text-zinc-100">
                {sessionEmail ?? "Admin"}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                Admin
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
        <header className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
                {activePromotion?.name ?? "BoutPick Admin"}
              </p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
                {activeShow?.name ?? "Promoter Console"}
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                {activeShow?.starts_at
                  ? new Date(activeShow.starts_at).toLocaleString()
                  : "No show start time set"}
                {activeShow?.venue_name ? ` • ${activeShow.venue_name}` : ""}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
              <label className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                Current show
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                  value={selectedShowId}
                  onChange={(event) => setSelectedShowId(event.target.value)}
                >
                  {shows.length === 0 && <option value="">No shows</option>}
                  {shows.map((show) => (
                    <option key={show.id} value={show.id}>
                      {show.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                  Readiness
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-2xl font-semibold text-emerald-300">
                    {readinessPercent}%
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${readinessPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {[
              ["dashboard", "Dashboard"],
              ["setup", "Setup"],
              ["card", "Card"],
              ["results", "Results"],
              ["scoreboard", "Scoreboard"],
              ["advanced", "More"],
            ].map(([view, label]) => (
              <button
                key={`mobile-${view}`}
                className={`h-10 shrink-0 rounded-full px-4 text-xs font-semibold uppercase tracking-wide ${
                  adminView === view
                    ? "bg-amber-400 text-zinc-950"
                    : "border border-zinc-800 text-zinc-300"
                }`}
                type="button"
                onClick={() => setAdminView(view as AdminView)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {message && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/50 px-4 py-3 text-sm text-zinc-200">
            {message}
          </div>
        )}

        {toastMessage && (
          <div
            className={`fixed left-0 right-0 top-16 z-50 mx-auto w-[min(92vw,720px)] rounded-2xl border border-amber-400/60 bg-zinc-950/95 px-4 py-3 text-sm text-amber-100 shadow-lg shadow-black/40 transition-all duration-300 ${
              toastVisible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
            }`}
          >
            {toastMessage}
          </div>
        )}

        {adminView === "dashboard" && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-amber-400/40 bg-zinc-950 md:w-48 md:shrink-0">
                  {activeShow?.image_url ? (
                    <Image
                      src={activeShow.image_url}
                      alt={activeShow.name}
                      fill
                      sizes="192px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-4 text-center text-xs uppercase tracking-[0.25em] text-zinc-600">
                      No poster
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-amber-400/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                      {activeShow?.status ?? "No show"}
                    </span>
                    <span className="rounded-full border border-zinc-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
                      Card: {orderedShowMatches.length} matches
                    </span>
                    <span className="rounded-full border border-zinc-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
                      Picks: {activeShow?.lock_picks_at_start ? "Lock at start" : "Manual"}
                    </span>
                    {activeShow?.requires_location_verification ? (
                      <span className="rounded-full border border-emerald-400/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                        Gate enabled
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold">
                    {activeShow?.name ?? "Create your next show"}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    {activeShow?.tagline ??
                      "Set up the card, verify readiness, and run results from one place."}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-950 transition hover:bg-amber-300"
                      type="button"
                      onClick={() => setAdminView("setup")}
                    >
                      Open setup
                    </button>
                    {activeShowLinks && (
                      <>
                        <a
                          className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-700 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-300 hover:text-amber-200"
                          href={activeShowLinks.show}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Preview show
                        </a>
                        <a
                          className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-700 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-300 hover:text-amber-200"
                          href={activeShowLinks.picks}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open picks
                        </a>
                        <a
                          className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-700 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-300 hover:text-amber-200"
                          href={activeShowLinks.scoreboard}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open scoreboard
                        </a>
                        <a
                          className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-700 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-300 hover:text-amber-200"
                          href={activeShowLinks.qr}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Share QR
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Readiness overview</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Status guidance only; existing admin behavior is preserved.
                  </p>
                </div>
                <span className="text-3xl font-semibold text-emerald-300">
                  {readinessPercent}%
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {readinessItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm"
                  >
                    <span className="text-zinc-200">{item.label}</span>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        item.complete
                          ? item.warning
                            ? "text-amber-200"
                            : "text-emerald-300"
                          : "text-zinc-500"
                      }`}
                    >
                      {item.complete ? (item.warning ? "Locked" : "Ready") : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {(adminView === "dashboard" || adminView === "setup") && (
        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Shows</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Pick the card you want to manage. Events and matches below sync
                to the active show.
              </p>
              {activeShow ? (
                <p className="mt-3 text-xs uppercase tracking-[0.3em] text-amber-200">
                  Active show: {activeShow.name}
                </p>
              ) : null}
            </div>
            <div className="flex w-full flex-col gap-3 lg:max-w-xs">
              <label className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Switch show
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                  value={selectedShowId}
                  onChange={(event) => setSelectedShowId(event.target.value)}
                >
                  {shows.length === 0 && <option value="">No shows</option>}
                  {shows.map((show) => (
                    <option key={show.id} value={show.id}>
                      {show.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-4 text-[11px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                type="button"
                onClick={() => setShowModalOpen(true)}
              >
                Add new show
              </button>
            </div>
          </div>

          <ShowEditor
            activeShowName={activeShow?.name ?? null}
            name={showEditName}
            setName={setShowEditName}
            slug={showEditSlug}
            setSlug={setShowEditSlug}
            promotions={promotions}
            promotionId={showEditPromotionId}
            setPromotionId={setShowEditPromotionId}
            imageUrl={showEditImageUrl}
            setImageUrl={setShowEditImageUrl}
            tagline={showEditTagline}
            setTagline={setShowEditTagline}
            requiresEmailRegistration={showEditRequiresEmail}
            setRequiresEmailRegistration={setShowEditRequiresEmail}
            lockPicksAtStart={showEditLockPicksAtStart}
            setLockPicksAtStart={setShowEditLockPicksAtStart}
            isFeaturedPlayShow={showEditIsFeaturedPlayShow}
            setIsFeaturedPlayShow={setShowEditIsFeaturedPlayShow}
            isOver={showEditIsOver}
            setIsOver={setShowEditIsOver}
            useConfidencePoints={showEditUseConfidencePoints}
            setUseConfidencePoints={setShowEditUseConfidencePoints}
            requiresLocationVerification={
              showEditRequiresLocationVerification
            }
            setRequiresLocationVerification={
              setShowEditRequiresLocationVerification
            }
            venueName={showEditVenueName}
            setVenueName={setShowEditVenueName}
            venueAddress={showEditVenueAddress}
            setVenueAddress={setShowEditVenueAddress}
            venueLatitude={showEditVenueLatitude}
            setVenueLatitude={setShowEditVenueLatitude}
            venueLongitude={showEditVenueLongitude}
            setVenueLongitude={setShowEditVenueLongitude}
            locationRadiusMeters={showEditLocationRadiusMeters}
            setLocationRadiusMeters={setShowEditLocationRadiusMeters}
            startsAt={showEditStartsAt}
            setStartsAt={setShowEditStartsAt}
            saving={showEditBusy}
            disabled={!activeShow}
            onUseNow={() =>
              setShowEditStartsAt(formatLocalDateTime(new Date().toISOString()))
            }
            onSave={handleUpdateShow}
          />
          {activeShow && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-red-200">
                  Danger zone
                </p>
                <p className="mt-1 text-sm text-red-100">
                  Deleting a show removes its events, matches, picks, and scores.
                </p>
              </div>
              <button
                className="inline-flex h-10 items-center justify-center rounded-full border border-red-400 px-4 text-[11px] font-semibold uppercase tracking-wide text-red-100 transition hover:border-red-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={handleDeleteShow}
                disabled={showDeleteBusy}
              >
                {showDeleteBusy ? "Deleting..." : "Delete show"}
              </button>
            </div>
          )}

          {orderedShowItems.length > 0 && (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  Show card order
                </p>
                {focusedEventId && (
                  <button
                    className="text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:text-amber-100"
                    type="button"
                    onClick={() => setFocusedEventId("")}
                  >
                    Back to all events
                  </button>
                )}
              </div>
              <div className="mt-3 space-y-3 text-sm text-zinc-200">
                {orderedShowItems.map((item) => {
                  const key = `${item.type}:${item.id}`;
                  const orderValue =
                    orderIndexEdits[key] ??
                    (item.order_index !== null && item.order_index !== undefined
                      ? String(item.order_index)
                      : "");
                  const displayOrder =
                    item.order_index ?? orderedShowItems.indexOf(item) + 1;
                  return (
                    <div
                      key={key}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">
                          #{displayOrder}
                        </span>
                        <div>
                        <p className="font-medium text-zinc-100">{item.name}</p>
                        <p className="text-xs text-zinc-500">
                          {item.type.toUpperCase()} • {item.detail}
                        </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                          Order
                          <input
                            className="ml-2 h-9 w-20 rounded-xl border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100"
                            value={orderValue}
                            onChange={(event) =>
                              setOrderIndexEdits((prev) => ({
                                ...prev,
                                [key]: event.target.value,
                              }))
                            }
                            onBlur={() => handleUpdateShowOrder(item)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                handleUpdateShowOrder(item);
                              }
                            }}
                          />
                        </label>
                        <button
                          className="inline-flex h-9 items-center justify-center rounded-full border border-amber-400 px-4 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                          type="button"
                          onClick={() => {
                            if (item.type === "event") {
                              const event = showEvents.find(
                                (eventItem) => eventItem.id === item.id
                              );
                              if (event?.show_id) {
                                setSelectedShowId(event.show_id);
                              }
                              setAdminView("advanced");
                              setFocusedEventId(item.id);
                              setSelectedEventId(item.id);
                              setAdminTab("events");
                              scrollToEventEditor();
                              return;
                            }
                            if (item.type === "match") {
                              const match = orderedShowMatches.find(
                                (matchItem) => matchItem.id === item.id
                              );
                              if (match?.event_id) {
                                setSelectedEventId(match.event_id);
                              }
                              setAdminView("card");
                              setScrollMatchId(item.id);
                              return;
                            }
                            if (item.type === "question") {
                              setAdminView("advanced");
                              setAdminTab("questions");
                              return;
                            }
                            setAdminView("advanced");
                            setAdminTab("eliminators");
                            setScrollEliminatorId(item.id);
                          }}
                        >
                          Edit
                        </button>
                        {item.type === "match" && (
                          <button
                            className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-700 px-4 text-[10px] font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-300 hover:text-amber-200"
                            type="button"
                            onClick={() => handleClearMatchResults(item.id)}
                          >
                            Clear results
                          </button>
                        )}
                        {item.type === "eliminator" && (
                          <button
                            className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-700 px-4 text-[10px] font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-300 hover:text-amber-200"
                            type="button"
                            onClick={() => handleClearEliminatorResults(item.id)}
                          >
                            Clear results
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
        )}

        {adminView === "advanced" && (
        <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`h-11 flex-1 rounded-2xl px-4 text-xs font-semibold uppercase tracking-[0.2em] transition sm:flex-none ${
                adminTab === "events"
                  ? "bg-amber-400 text-zinc-900"
                  : "border border-zinc-800 text-zinc-300 hover:border-amber-300 hover:text-amber-200"
              }`}
              type="button"
              onClick={() => setAdminTab("events")}
            >
              Rumble events
            </button>
            <button
              className={`h-11 flex-1 rounded-2xl px-4 text-xs font-semibold uppercase tracking-[0.2em] transition sm:flex-none ${
                adminTab === "eliminators"
                  ? "bg-amber-400 text-zinc-900"
                  : "border border-zinc-800 text-zinc-300 hover:border-amber-300 hover:text-amber-200"
              }`}
              type="button"
              onClick={() => setAdminTab("eliminators")}
            >
              Eliminators
            </button>
            <button
              className={`h-11 flex-1 rounded-2xl px-4 text-xs font-semibold uppercase tracking-[0.2em] transition sm:flex-none ${
                adminTab === "questions"
                  ? "bg-amber-400 text-zinc-900"
                  : "border border-zinc-800 text-zinc-300 hover:border-amber-300 hover:text-amber-200"
              }`}
              type="button"
              onClick={() => setAdminTab("questions")}
            >
              Questions
            </button>
          </div>
        </div>
        )}

        {adminView === "advanced" && (
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          {adminTab === "events" && (
            <div
              id="event-editor"
              className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6"
            >
            <h2 className="text-lg font-semibold">Create event</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Add a new rumble event and define its roster settings.
            </p>
            <div className="mt-4 space-y-3">
              <input
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                placeholder="Event name"
                value={eventName}
                onChange={(event) => setEventName(event.target.value)}
              />
              <select
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                value={eventShowId}
                onChange={(event) => setEventShowId(event.target.value)}
              >
                <option value="">Assign to show (optional)</option>
                {shows.map((show) => (
                  <option key={show.id} value={show.id}>
                    {show.name}
                  </option>
                ))}
              </select>
              <select
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                value={eventGender}
                onChange={(event) => setEventGender(event.target.value)}
              >
                <option value="men">Men&apos;s Rumble</option>
                <option value="women">Women&apos;s Rumble</option>
              </select>
              <input
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                type="number"
                min="1900"
                max="2100"
                placeholder="Roster year (e.g. 2020)"
                value={eventRosterYear}
                onChange={(event) => setEventRosterYear(event.target.value)}
              />
              <button
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-amber-400 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300"
                type="button"
                onClick={handleCreateEvent}
              >
                Create event
              </button>
            </div>
          </div>
          )}

          {adminTab === "eliminators" && (
            <>
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                <h2 className="text-lg font-semibold">Create eliminator</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Add an eliminator match with 6–10 participants.
                </p>
                <details
                  className="group mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
                  open={eliminatorCreateOpen}
                  onToggle={(event) =>
                    setEliminatorCreateOpen(
                      (event.target as HTMLDetailsElement).open
                    )
                  }
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-zinc-100">
                    New eliminator
                    <span className="text-xs uppercase tracking-[0.3em] text-zinc-500 group-open:hidden">
                      Expand
                    </span>
                    <span className="hidden text-xs uppercase tracking-[0.3em] text-zinc-500 group-open:inline">
                      Collapse
                    </span>
                  </summary>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input
                      className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                      placeholder="Eliminator name"
                      value={eliminatorName}
                      onChange={(event) => setEliminatorName(event.target.value)}
                    />
                    <input
                      className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                      type="number"
                      min="6"
                      max="10"
                      placeholder="Entrant count (6-10)"
                      value={eliminatorEntrantLimit}
                      onChange={(event) =>
                        setEliminatorEntrantLimit(event.target.value)
                      }
                    />
                    <input
                      className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                      type="number"
                      min="1900"
                      max="2100"
                      placeholder="Roster year"
                      value={eliminatorRosterYear}
                      onChange={(event) =>
                        setEliminatorRosterYear(event.target.value)
                      }
                    />
                    <select
                      className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                      value={eliminatorRosterGender}
                      onChange={(event) =>
                        setEliminatorRosterGender(event.target.value)
                      }
                    >
                      <option value="men">Men</option>
                      <option value="women">Women</option>
                      <option value="intergender">Intergender</option>
                    </select>
                  </div>
                  <button
                    className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-4 text-[11px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                    type="button"
                    onClick={handleCreateEliminator}
                  >
                    Add eliminator
                  </button>
                </details>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                <h2 className="text-lg font-semibold">Eliminators</h2>
                {eliminators.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-400">
                    No eliminators added yet.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {eliminators.map((eliminator) => {
                      const eliminatorEntriesList = eliminatorEntries.filter(
                        (entry) => entry.eliminator_id === eliminator.id
                      );
                      const eliminatorElimsList = eliminatorEliminations.filter(
                        (entry) => entry.eliminator_id === eliminator.id
                      );
                      const eligibleEntrants = entrantOptions.filter((entrant) => {
                        if (!entrant.active) return false;
                        if (
                          eliminator.roster_year &&
                          entrant.roster_year !== eliminator.roster_year
                        ) {
                          return false;
                        }
                        if (
                          eliminator.roster_gender &&
                          eliminator.roster_gender !== "intergender" &&
                          entrant.gender !== eliminator.roster_gender
                        ) {
                          return false;
                        }
                        return true;
                      });
                      return (
                        <div
                          key={eliminator.id}
                          ref={(node) => {
                            eliminatorRefs.current[eliminator.id] = node;
                          }}
                          className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-zinc-100">
                                {eliminator.name}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {eliminator.roster_gender ?? "all"} •{" "}
                                {eliminator.roster_year ?? "any"} •{" "}
                                {eliminator.entrant_limit} entrants
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-[2fr,auto]">
                            <select
                              className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                              value={eliminatorEntrantId}
                              onChange={(event) =>
                                setEliminatorEntrantId(event.target.value)
                              }
                            >
                              <option value="">Select entrant</option>
                              {eligibleEntrants.map((entrant) => (
                                <option key={entrant.id} value={entrant.id}>
                                  {entrant.name}
                                </option>
                              ))}
                            </select>
                            <button
                              className="inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-4 text-[11px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                              type="button"
                              onClick={() => handleAddEliminatorEntry(eliminator.id)}
                            >
                              Add entrant
                            </button>
                          </div>
                          {eliminatorEntriesList.length > 0 && (
                            <div className="mt-4 space-y-2 text-sm text-zinc-200">
                              {eliminatorEntriesList.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2"
                                >
                                  <span>
                                    {entrantOptions.find(
                                      (entrant) => entrant.id === entry.entrant_id
                                    )?.name ?? "Entrant"}
                                  </span>
                                  <label className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                                    Entry order
                                    <select
                                      className="ml-2 h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100"
                                      value={entry.entry_order ?? ""}
                                      onChange={(event) => {
                                        const nextValue =
                                          event.target.value === ""
                                            ? null
                                            : Number(event.target.value);
                                        if (
                                          event.target.value !== "" &&
                                          Number.isNaN(nextValue)
                                        ) {
                                          return;
                                        }
                                        handleUpdateEliminatorEntryOrder(
                                          eliminator.id,
                                          entry.entrant_id,
                                          nextValue
                                        );
                                      }}
                                    >
                                      <option value="">—</option>
                                      {Array.from(
                                        { length: eliminator.entrant_limit ?? 0 },
                                        (_, index) => index + 1
                                      ).map((value) => (
                                        <option key={value} value={value}>
                                          {value}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <button
                                    className="text-xs font-semibold uppercase tracking-wide text-red-200 hover:text-red-100"
                                    type="button"
                                    onClick={() =>
                                      handleRemoveEliminatorEntry(
                                        eliminator.id,
                                        entry.entrant_id
                                      )
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {eliminatorEntriesList.length > 0 && (
                            <div className="mt-4">
                              <label className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                                Winner
                                <select
                                  className="mt-2 h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                                  value={eliminator.winner_entrant_id ?? ""}
                                  onChange={(event) =>
                                    handleSetEliminatorWinner(
                                      eliminator.id,
                                      event.target.value || null
                                    )
                                  }
                                >
                                  <option value="">Select winner</option>
                                  {eliminatorEntriesList.map((entry) => (
                                    <option key={entry.id} value={entry.entrant_id}>
                                      {entrantOptions.find(
                                        (entrant) => entrant.id === entry.entrant_id
                                      )?.name ?? "Entrant"}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          )}
                          <div className="mt-4 grid gap-3 md:grid-cols-[2fr,2fr,1fr,1fr,auto]">
                            <select
                              className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                              value={eliminatorEliminatedId}
                              onChange={(event) =>
                                setEliminatorEliminatedId(event.target.value)
                              }
                            >
                              <option value="">Eliminated entrant</option>
                              {eliminatorEntriesList.map((entry) => (
                                <option key={entry.id} value={entry.entrant_id}>
                                  {entrantOptions.find(
                                    (entrant) => entrant.id === entry.entrant_id
                                  )?.name ?? "Entrant"}
                                </option>
                              ))}
                            </select>
                            <select
                              className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                              value={eliminatorEliminatedById}
                              onChange={(event) =>
                                setEliminatorEliminatedById(event.target.value)
                              }
                            >
                              <option value="">Eliminated by</option>
                              {eliminatorEntriesList.map((entry) => (
                                <option key={entry.id} value={entry.entrant_id}>
                                  {entrantOptions.find(
                                    (entrant) => entrant.id === entry.entrant_id
                                  )?.name ?? "Entrant"}
                                </option>
                              ))}
                            </select>
                            <select
                              className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                              value={eliminatorEliminationType}
                              onChange={(event) =>
                                setEliminatorEliminationType(
                                  event.target.value as "pinfall" | "submission"
                                )
                              }
                            >
                              <option value="pinfall">Pinfall</option>
                              <option value="submission">Submission</option>
                            </select>
                            <input
                              className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                              placeholder="Order"
                              value={eliminatorEliminationOrder}
                              onChange={(event) =>
                                setEliminatorEliminationOrder(event.target.value)
                              }
                            />
                            <button
                              className="inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-4 text-[11px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                              type="button"
                              onClick={() =>
                                handleAddEliminatorElimination(eliminator.id)
                              }
                            >
                              Add elimination
                            </button>
                          </div>
                          {eliminatorElimsList.length > 0 && (
                            <div className="mt-4 space-y-2 text-sm text-zinc-200">
                              {eliminatorElimsList.map((elim) => (
                                <div
                                  key={elim.id}
                                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2"
                                >
                                  <span>
                                    {elim.elimination_order}.{" "}
                                    {entrantOptions.find(
                                      (entrant) =>
                                        entrant.id === elim.eliminated_entrant_id
                                    )?.name ?? "Entrant"}{" "}
                                    ({elim.elimination_type})
                                  </span>
                                  <button
                                    className="text-xs font-semibold uppercase tracking-wide text-red-200 hover:text-red-100"
                                    type="button"
                                    onClick={() =>
                                      handleRemoveEliminatorElimination(elim.id)
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {adminTab === "events" && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Edit event</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Update the active event, manage custom entrants, and approve user
                  submissions.
                </p>
              </div>
              {activeEvent && (
                <button
                  className="inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-4 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                  type="button"
                  onClick={() => setEventLogOpen(true)}
                >
                  View event log
                </button>
              )}
            </div>
            {!activeEvent ? (
              <p className="mt-4 text-sm text-zinc-400">
                Select an event to edit.
              </p>
            ) : (
              <>
                <div className="mt-4 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                    Event details
                  </p>
                  <input
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                    type="number"
                    min="1900"
                    max="2100"
                    placeholder="Roster year (e.g. 2020)"
                    value={eventRosterYear}
                    onChange={(event) => setEventRosterYear(event.target.value)}
                  />
                  <select
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                    value={eventIronPersonId}
                    onChange={(event) => setEventIronPersonId(event.target.value)}
                  >
                    <option value="">
                      {activeEvent?.rumble_gender === "women"
                        ? "Select iron woman (optional)"
                        : "Select iron man (optional)"}
                    </option>
                    {eventEntrantOptions.map((entrant) => (
                      <option key={entrant.id} value={entrant.id}>
                        {entrant.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                    value={eventShowId}
                    onChange={(event) => setEventShowId(event.target.value)}
                  >
                    <option value="">Assign to show (optional)</option>
                    {shows.map((show) => (
                      <option key={show.id} value={show.id}>
                        {show.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full border border-amber-400 px-5 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
                      type="button"
                      onClick={handleUpdateEvent}
                      disabled={eventUpdateBusy}
                    >
                      {eventUpdateBusy ? "Saving..." : "Save updates"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                    Add custom entrant
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      className="h-11 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                      placeholder="Custom entrant name"
                      value={customEntrantName}
                      onChange={(event) =>
                        setCustomEntrantName(event.target.value)
                      }
                    />
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full border border-amber-400 px-4 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                      type="button"
                      onClick={handleAddCustomEntrant}
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                    Custom entrant approvals
                  </p>
                  {pendingEntrants.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-400">
                      No pending entrants.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {pendingEntrants.map((entrant) => (
                        <div
                          key={entrant.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3"
                        >
                          <EntrantCard
                            name={entrant.name}
                            promotion={entrant.promotion}
                            imageUrl={entrant.image_url}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              className="inline-flex h-9 items-center justify-center rounded-full border border-emerald-400 px-4 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
                              type="button"
                              onClick={() =>
                                handleApproveCustomEntrant(entrant.id)
                              }
                            >
                              Approve
                            </button>
                            <button
                              className="inline-flex h-9 items-center justify-center rounded-full border border-red-500/70 px-4 text-xs font-semibold uppercase tracking-wide text-red-200 transition hover:border-red-400 hover:text-red-100"
                              type="button"
                              onClick={() =>
                                handleRejectCustomEntrant(entrant.id)
                              }
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          )}
          {adminTab === "questions" && (
            <div className="lg:col-span-2 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
              <h2 className="text-lg font-semibold">Show questions</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Add prediction questions for this show. Each question becomes its
                own step for users.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 md:col-span-2"
                  placeholder="Image URL (optional)"
                  value={newQuestionImageUrl}
                  onChange={(event) => setNewQuestionImageUrl(event.target.value)}
                />
                {newQuestionImageUrl.trim() ? (
                  <div className="relative h-48 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 md:col-span-2">
                    <Image
                      src={newQuestionImageUrl.trim()}
                      alt="Question preview"
                      fill
                      sizes="(max-width: 768px) 100vw, 800px"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <textarea
                  className="min-h-[88px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 md:col-span-2"
                  placeholder="Question text"
                  value={newQuestionText}
                  onChange={(event) => setNewQuestionText(event.target.value)}
                />
                <div className="md:col-span-2">
                  <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
                    Answers
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      className="h-11 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                      placeholder="Add an answer option"
                      value={newQuestionAnswerInput}
                      onChange={(event) =>
                        setNewQuestionAnswerInput(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          appendQuestionAnswer(newQuestionAnswerInput);
                          setNewQuestionAnswerInput("");
                        }
                      }}
                    />
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-700 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-100 transition hover:border-amber-300 hover:text-amber-200"
                      type="button"
                      onClick={() => {
                        appendQuestionAnswer(newQuestionAnswerInput);
                        setNewQuestionAnswerInput("");
                      }}
                    >
                      Add answer
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {newQuestionAnswers.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        Add at least two answers.
                      </p>
                    ) : (
                      newQuestionAnswers.map((answer) => (
                        <button
                          key={answer}
                          className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 transition hover:border-red-400 hover:text-red-200"
                          type="button"
                          onClick={() =>
                            setNewQuestionAnswers((prev) =>
                              prev.filter((item) => item !== answer)
                            )
                          }
                        >
                          <span>{answer}</span>
                          <span aria-hidden="true">x</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <button
                  className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 md:col-span-2"
                  type="button"
                  onClick={handleCreateShowQuestion}
                >
                  Add question
                </button>
              </div>
              <div className="mt-6 space-y-3">
                {showQuestions.length === 0 ? (
                  <p className="text-sm text-zinc-400">
                    No questions added for this show yet.
                  </p>
                ) : (
                  showQuestions.map((question) => (
                    <div
                      key={question.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="w-full space-y-3">
                          {question.image_url ? (
                            <div className="relative h-32 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                              <Image
                                src={question.image_url}
                                alt={question.question}
                                fill
                                sizes="(max-width: 768px) 100vw, 400px"
                                className="object-cover"
                              />
                            </div>
                          ) : null}
                          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                            Question
                          </p>
                          <input
                            className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                            value={questionImageEdits[question.id] ?? question.image_url ?? ""}
                            placeholder="Image URL (optional)"
                            onChange={(event) =>
                              setQuestionImageEdits((prev) => ({
                                ...prev,
                                [question.id]: event.target.value,
                              }))
                            }
                          />
                          <textarea
                            className="min-h-[88px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                            value={questionTextEdits[question.id] ?? question.question}
                            placeholder="Question text"
                            onChange={(event) =>
                              setQuestionTextEdits((prev) => ({
                                ...prev,
                                [question.id]: event.target.value,
                              }))
                            }
                          />
                          <textarea
                            className="min-h-[110px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                            value={
                              questionAnswerEdits[question.id] ?? question.answers.join("\n")
                            }
                            placeholder="Possible answers (one per line or comma-separated)"
                            onChange={(event) =>
                              setQuestionAnswerEdits((prev) => ({
                                ...prev,
                                [question.id]: event.target.value,
                              }))
                            }
                          />
                          <select
                            className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                            value={
                              questionCorrectAnswerEdits[question.id] ??
                              question.correct_answer ??
                              ""
                            }
                            onChange={(event) =>
                              setQuestionCorrectAnswerEdits((prev) => ({
                                ...prev,
                                [question.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Correct answer not set</option>
                            {parseQuestionAnswers(
                              questionAnswerEdits[question.id] ?? question.answers.join("\n")
                            ).map((answer) => (
                              <option key={`${question.id}-${answer}`} value={answer}>
                                {answer}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-zinc-400">
                            Correct custom-question picks are worth {scoringRules.question_correct} points.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="inline-flex h-9 items-center justify-center rounded-full border border-amber-400 px-4 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                            type="button"
                            onClick={() => handleUpdateShowQuestion(question)}
                          >
                            Save
                          </button>
                          <button
                            className="inline-flex h-9 items-center justify-center rounded-full border border-red-500/70 px-4 text-[10px] font-semibold uppercase tracking-wide text-red-200 transition hover:border-red-400 hover:text-red-100"
                            type="button"
                            onClick={() => handleDeleteShowQuestion(question.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
        )}

        {adminView === "results" && (
          <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
                  Results / Run Show
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Enter results</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  {matchCompletion.completed} of {matchCompletion.total} matches completed.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
                <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                  Show status
                </p>
                <p className="mt-2 text-emerald-300">
                  {matchCompletion.remaining === 0 && matchCompletion.total > 0
                    ? "All match results entered"
                    : `${matchCompletion.remaining} match${matchCompletion.remaining === 1 ? "" : "es"} remaining`}
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-800">
              <div className="min-w-[920px] divide-y divide-zinc-800">
                {orderedShowMatches.length === 0 ? (
                  <p className="p-5 text-sm text-zinc-400">No matches added yet.</p>
                ) : (
                  orderedShowMatches.map((match, index) => {
                    const sides = matchSidesByMatch[match.id] ?? [];
                    const participantRows = matchEntrantsByMatch[match.id] ?? [];
                    const sideEntries = sides.map((side, sideIndex) => {
                      const entrantsForSide = participantRows
                        .filter((row) => row.side_id === side.id)
                        .map((row) => entrantMap.get(row.entrant_id))
                        .filter(Boolean) as EntrantRow[];
                      return {
                        side,
                        label: side.label?.trim() || `Side ${sideIndex + 1}`,
                        entrants: entrantsForSide,
                      };
                    });
                    const allEntrants = participantRows
                      .map((row) => entrantMap.get(row.entrant_id))
                      .filter(Boolean) as EntrantRow[];
                    const finishState = matchFinishEdits[match.id] ?? {
                      method: match.finish_method ?? "",
                      winner: match.finish_winner_entrant_id ?? "",
                      loser: match.finish_loser_entrant_id ?? "",
                    };
                    const lengthValue =
                      matchLengthEdits[match.id] ?? match.match_length ?? "";
                    const interferenceValue =
                      matchInterferenceEdits[match.id] ??
                      match.match_interference ??
                      "";
                    const isBlindGauntlet = match.match_type === "blind_gauntlet";
                    const gauntletCandidates =
                      gauntletCandidateEntrantsByMatch[match.id] ?? [];
                    const gauntletActuals =
                      gauntletActualEntrantsByMatch[match.id] ?? [];
                    const gauntletActualIds = new Set(
                      gauntletActuals.map((row) => row.entrant_id)
                    );
                    const gauntletSurvivalState =
                      matchGauntletSurvivalEdits[match.id] ??
                      (typeof match.gauntlet_survival_result === "boolean"
                        ? String(match.gauntlet_survival_result)
                        : "");
                    const gauntletFinalState =
                      matchGauntletFinalEdits[match.id] ??
                      match.gauntlet_final_entrant_id ??
                      "";
                    const isCompleted =
                      Boolean(match.winner_side_id) ||
                      Boolean(match.winner_entrant_id) ||
                      match.status === "completed";
                    return (
                      <div
                        key={`results-${match.id}`}
                        className="bg-zinc-950/50 p-4 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 font-semibold text-amber-200">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-zinc-100">{match.name}</p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {formatMatchTypeLabel(match.match_type)}
                              {allEntrants.length > 0
                                ? ` - ${allEntrants.map((entrant) => entrant.name).join(" vs ")}`
                                : ""}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                              isCompleted
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {isCompleted ? "Saved" : "Not entered"}
                          </span>
                        </div>
                        {isBlindGauntlet ? (
                          <div className="mt-4 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 lg:grid-cols-3">
                            <div className="grid gap-2">
                              <label className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
                                Survival result
                              </label>
                              <select
                                className="h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                                value={gauntletSurvivalState}
                                onChange={(event) =>
                                  setMatchGauntletSurvivalEdits((prev) => ({
                                    ...prev,
                                    [match.id]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Choose result</option>
                                <option value="true">Known wrestler survived</option>
                                <option value="false">Known wrestler eliminated</option>
                              </select>
                              <button
                                className="inline-flex h-9 items-center justify-center rounded-full border border-amber-400 px-4 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                                type="button"
                                onClick={() => handleSetGauntletSurvivalResult(match.id)}
                              >
                                Save survival
                              </button>
                            </div>
                            <div className="grid gap-2">
                              <label className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
                                Actual entrants
                              </label>
                              <select
                                className="h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                                value={matchGauntletActualSelection[match.id] ?? ""}
                                onChange={(event) =>
                                  setMatchGauntletActualSelection((prev) => ({
                                    ...prev,
                                    [match.id]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Add entrant</option>
                                {gauntletCandidates
                                  .filter((row) => !gauntletActualIds.has(row.entrant_id))
                                  .map((row) => {
                                    const entrant = entrantMap.get(row.entrant_id);
                                    return entrant ? (
                                      <option key={row.id} value={row.entrant_id}>
                                        {entrant.name}
                                      </option>
                                    ) : null;
                                  })}
                              </select>
                              <button
                                className="inline-flex h-9 items-center justify-center rounded-full border border-amber-400 px-4 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                                type="button"
                                onClick={() => handleAddGauntletActual(match.id)}
                              >
                                Add actual
                              </button>
                              <div className="grid gap-2">
                                {gauntletActuals.length === 0 ? (
                                  <p className="text-xs text-zinc-500">
                                    No actual entrants entered.
                                  </p>
                                ) : (
                                  gauntletActuals.map((row) => {
                                    const entrant = entrantMap.get(row.entrant_id);
                                    return entrant ? (
                                      <div
                                        key={row.id}
                                        className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-2"
                                      >
                                        <EntrantCard
                                          name={entrant.name}
                                          promotion={entrant.promotion}
                                          imageUrl={entrant.image_url}
                                        />
                                        <button
                                          className="text-[10px] font-semibold uppercase tracking-wide text-red-300"
                                          type="button"
                                          onClick={() =>
                                            handleRemoveGauntletActual(
                                              match.id,
                                              row.entrant_id
                                            )
                                          }
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ) : null;
                                  })
                                )}
                              </div>
                            </div>
                            <div className="grid gap-2">
                              <label className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
                                Final entrant
                              </label>
                              <select
                                className="h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                                value={gauntletFinalState}
                                onChange={(event) =>
                                  setMatchGauntletFinalEdits((prev) => ({
                                    ...prev,
                                    [match.id]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Choose final entrant</option>
                                {gauntletActuals.map((row) => {
                                  const entrant = entrantMap.get(row.entrant_id);
                                  return entrant ? (
                                    <option key={row.id} value={row.entrant_id}>
                                      {entrant.name}
                                    </option>
                                  ) : null;
                                })}
                              </select>
                              <button
                                className="inline-flex h-9 items-center justify-center rounded-full border border-amber-400 px-4 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                                type="button"
                                onClick={() => handleSetGauntletFinalEntrant(match.id)}
                              >
                                Save final entrant
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.35fr_1fr_1fr]">
                            <select
                              className="h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                              value={match.winner_side_id ?? ""}
                              onChange={(event) =>
                                handleSetMatchWinner(match.id, event.target.value)
                              }
                            >
                              <option value="">Winner</option>
                              {sideEntries.map(({ side, label, entrants }) => (
                                <option key={side.id} value={side.id}>
                                  {label}
                                  {entrants.length > 0
                                    ? ` - ${entrants.map((entrant) => entrant.name).join(", ")}`
                                    : ""}
                                </option>
                              ))}
                            </select>
                            <div className="grid gap-2">
                            <select
                              className="h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                              value={finishState.method}
                              onChange={(event) =>
                                setMatchFinishEdits((prev) => ({
                                  ...prev,
                                  [match.id]: {
                                    ...finishState,
                                    method: event.target.value,
                                  },
                                }))
                              }
                            >
                              <option value="">Finish</option>
                              <option value="pinfall">Pinfall</option>
                              <option value="submission">Submission</option>
                              <option value="disqualification">Disqualification</option>
                            </select>
                            {(finishState.method === "pinfall" ||
                              finishState.method === "submission") && (
                              <div className="grid gap-2">
                                <select
                                  className="h-9 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100"
                                  value={finishState.winner}
                                  onChange={(event) =>
                                    setMatchFinishEdits((prev) => ({
                                      ...prev,
                                      [match.id]: {
                                        ...finishState,
                                        winner: event.target.value,
                                      },
                                    }))
                                  }
                                >
                                  <option value="">Finish winner</option>
                                  {allEntrants.map((entrant) => (
                                    <option key={entrant.id} value={entrant.id}>
                                      {entrant.name}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  className="h-9 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100"
                                  value={finishState.loser}
                                  onChange={(event) =>
                                    setMatchFinishEdits((prev) => ({
                                      ...prev,
                                      [match.id]: {
                                        ...finishState,
                                        loser: event.target.value,
                                      },
                                    }))
                                  }
                                >
                                  <option value="">Finish loser</option>
                                  {allEntrants.map((entrant) => (
                                    <option key={entrant.id} value={entrant.id}>
                                      {entrant.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            </div>
                            <select
                              className="h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                              value={lengthValue}
                              onChange={(event) =>
                                setMatchLengthEdits((prev) => ({
                                  ...prev,
                                  [match.id]: event.target.value,
                                }))
                              }
                            >
                              <option value="">Length</option>
                              <option value="sprint">Under 8 minutes</option>
                              <option value="standard">8 - 15 minutes</option>
                              <option value="epic">15+ minutes</option>
                            </select>
                            <select
                              className="h-10 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                              value={interferenceValue}
                              onChange={(event) =>
                                setMatchInterferenceEdits((prev) => ({
                                  ...prev,
                                  [match.id]: event.target.value,
                                }))
                              }
                            >
                              <option value="">Interference</option>
                              <option value="no">No</option>
                              <option value="yes">Yes</option>
                            </select>
                          </div>
                        )}
                        <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-zinc-800 pt-4">
                          {isBlindGauntlet ? null : (
                            <button
                              className="inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-5 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                              type="button"
                              onClick={() => {
                                void (async () => {
                                  await handleSetMatchFinish(
                                    match.id,
                                    finishState.method,
                                    finishState.winner,
                                    finishState.loser
                                  );
                                  await handleSetMatchLength(match.id, lengthValue);
                                  await handleSetMatchInterference(
                                    match.id,
                                    interferenceValue
                                  );
                                })();
                              }}
                            >
                              Save details
                            </button>
                          )}
                          {allEntrants.length === 0 ? (
                            <span className="text-[10px] uppercase tracking-wide text-red-200">
                              No participants
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        )}

        {adminView === "scoreboard" && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.8fr]">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
                    Scoreboard
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Live leaderboard</h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    Scoreboard behavior is unchanged; this view links to the existing public scoreboard.
                  </p>
                </div>
                {activeShowLinks ? (
                  <div className="flex flex-wrap gap-3">
                    <a
                      className="inline-flex h-10 items-center justify-center rounded-full bg-amber-400 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-950 transition hover:bg-amber-300"
                      href={activeShowLinks.scoreboard}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open scoreboard
                    </a>
                    <a
                      className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-300 hover:text-amber-200"
                      href={activeShowLinks.qr}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Share QR
                    </a>
                  </div>
                ) : null}
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                    Matches
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-zinc-100">
                    {matchCompletion.completed}/{matchCompletion.total}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">Completed</p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                    Picks status
                  </p>
                  <p className="mt-2 text-lg font-semibold text-zinc-100">
                    {activeShow?.lock_picks_at_start ? "Locks at start" : "Manual"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Existing lock behavior preserved.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                    Confidence points
                  </p>
                  <p className="mt-2 text-lg font-semibold text-zinc-100">
                    {activeShow?.use_confidence_points ? "Enabled" : "Disabled"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Uses current scoring rules.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Maintenance
              </p>
              <h2 className="mt-2 text-lg font-semibold">Scoring controls</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Recalculation keeps the current brownfield event-level behavior.
              </p>
              <div className="mt-5 grid gap-3">
                <button
                  className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                  type="button"
                  onClick={() => {
                    void handleRecalculateScores();
                  }}
                  disabled={recalcBusy}
                >
                  {recalcBusy ? "Recalculating..." : "Recalculate scores"}
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center rounded-full border border-red-500/70 px-6 text-sm font-semibold uppercase tracking-wide text-red-200 transition hover:border-red-400 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                  type="button"
                  onClick={handleClearShowScores}
                  disabled={clearScoresBusy || !activeShow}
                >
                  {clearScoresBusy ? "Clearing..." : "Clear picks & scores"}
                </button>
              </div>
            </div>
          </section>
        )}

        {adminView === "advanced" && adminTab === "events" && (
          <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold">Rumble Entry</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {entries.length} entries tracked • {filteredEntrantOptions.length} eligible{" "}
            {activeEvent?.rumble_gender ? `(${activeEvent.rumble_gender})` : ""}
          </p>
          <div className="mt-4 space-y-3">
            <select
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={entryEntrantId}
              onChange={(event) => setEntryEntrantId(event.target.value)}
            >
              <option value="">Select entrant</option>
              {Object.entries(entrantsByPromotion)
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
                  <optgroup key={promotion} label={promotion}>
                    {promotionEntrants.map((entrant) => (
                      <option key={entrant.id} value={entrant.id}>
                        {eventEntrantIdSet.has(entrant.id)
                          ? `✓ ${entrant.name} — ADDED`
                          : entrant.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
            <input
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              placeholder="Entry number (optional)"
              value={entryNumber}
              onChange={(event) => setEntryNumber(event.target.value)}
              disabled={entryConfirmed}
            />
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                checked={entryConfirmed}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setEntryConfirmed(checked);
                  if (checked) {
                    setEntryNumber("");
                  }
                }}
              />
              Mark as confirmed entrant
            </label>
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-zinc-700 text-sm font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-200"
              type="button"
              onClick={handleAddEntry}
            >
              Add entry
            </button>
          </div>
        </section>
        )}

        {adminView === "card" && (
          <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
                Card Builder
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Build the card</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Add matches, assign participants, and check whether the card is ready for fans.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {activeShowLinks ? (
                <a
                  className="inline-flex h-10 items-center justify-center rounded-full bg-amber-400 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-950 transition hover:bg-amber-300"
                  href={activeShowLinks.show}
                  target="_blank"
                  rel="noreferrer"
                >
                  Fan preview
                </a>
              ) : null}
              <button
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-300 hover:text-amber-200"
                type="button"
                onClick={() => setMatchCreateOpen((current) => !current)}
              >
                {matchCreateOpen ? "Close add match" : "Add match"}
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                Matches
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {orderedShowMatches.length}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                Participants
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {matchEntrants.length}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                Preview
              </p>
              <p className="mt-2 text-sm font-semibold text-zinc-100">
                {activeShowLinks ? "Available" : "Select a show"}
              </p>
            </div>
          </div>
          <details
            className="group mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
            open={matchCreateOpen}
            onToggle={(event) =>
              setMatchCreateOpen((event.target as HTMLDetailsElement).open)
            }
          >
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-zinc-100">
              Create a match
              <span className="text-xs uppercase tracking-[0.3em] text-zinc-500 group-open:hidden">
                Expand
              </span>
              <span className="text-xs uppercase tracking-[0.3em] text-zinc-500 hidden group-open:inline">
                Collapse
              </span>
            </summary>
            <div className="mt-4 grid gap-3 md:grid-cols-[2fr,1fr,auto]">
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Match title
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                  placeholder="Wrestler A vs Wrestler B"
                  value={matchName}
                  onChange={(event) => setMatchName(event.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Match type
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                  value={matchType}
                  onChange={(event) => setMatchType(event.target.value)}
                >
                  <option value="singles">Singles (1 vs 1)</option>
                  <option value="tag">Tag (2 vs 2)</option>
                  <option value="tag_3">Tag (3 vs 3)</option>
                  <option value="tag_4">Tag (4 vs 4)</option>
                  <option value="tag_4_way">4-Way Tag (2 v 2 v 2 v 2)</option>
                  <option value="triple_threat">Triple Threat</option>
                  <option value="fatal_4_way">Fatal 4-Way</option>
                  <option value="ladder_6">6-Man Ladder</option>
                  <option value="blind_gauntlet">Blind Gauntlet Match</option>
                  <option value="multi">Multi-person</option>
                </select>
              </label>
              <button
                className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-950 transition hover:bg-amber-300 md:self-end"
                type="button"
                onClick={handleAddMatch}
              >
                Add match
              </button>
            </div>
            <details className="mt-3 rounded-2xl border border-zinc-800 bg-black/20 p-3">
              <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                Advanced match options
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Match category
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    placeholder="match"
                    value={matchKind}
                    onChange={(event) => setMatchKind(event.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Roster year
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    type="number"
                    min="1900"
                    max="2100"
                    placeholder="2026"
                    value={matchRosterYear}
                    onChange={(event) => setMatchRosterYear(event.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Roster group
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    value={matchRosterGender}
                    onChange={(event) => setMatchRosterGender(event.target.value)}
                  >
                    <option value="men">Men</option>
                    <option value="women">Women</option>
                    <option value="intergender">Intergender</option>
                  </select>
                </label>
              </div>
            </details>
            {matchType === "blind_gauntlet" && (
              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-black/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
                  Blind Gauntlet setup
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.4fr]">
                  <select
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                    value={matchKnownWrestlerId}
                    onChange={(event) => {
                      const nextKnownId = event.target.value;
                      setMatchKnownWrestlerId(nextKnownId);
                      setMatchCandidateIds((prev) =>
                        prev.filter((id) => id !== nextKnownId)
                      );
                    }}
                  >
                    <option value="">Known wrestler</option>
                    {entrantOptions.map((entrant) => (
                      <option key={entrant.id} value={entrant.id}>
                        {entrant.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="min-h-32 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                    multiple
                    value={matchCandidateIds}
                    onChange={(event) =>
                      setMatchCandidateIds(
                        Array.from(event.target.selectedOptions).map(
                          (option) => option.value
                        )
                      )
                    }
                  >
                    {entrantOptions
                      .filter((entrant) => entrant.id !== matchKnownWrestlerId)
                      .map((entrant) => (
                        <option key={entrant.id} value={entrant.id}>
                          {entrant.name}
                        </option>
                      ))}
                  </select>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Select 3 to 20 candidate entrants. Hold Command or Shift to select multiple.
                </p>
              </div>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-400"
                  type="checkbox"
                  checked={matchIsMainEvent}
                  onChange={(event) => setMatchIsMainEvent(event.target.checked)}
                />
                Main event
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-400"
                  type="checkbox"
                  checked={matchIsChampionship}
                  onChange={(event) => setMatchIsChampionship(event.target.checked)}
                />
                Championship match
              </label>
            </div>
            {matchIsChampionship && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Championship name
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    placeholder="World Championship"
                    value={matchChampionshipName}
                    onChange={(event) => setMatchChampionshipName(event.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Championship image
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    placeholder="Paste the title image link"
                    value={matchChampionshipImageUrl}
                    onChange={(event) =>
                      setMatchChampionshipImageUrl(event.target.value)
                    }
                  />
                </label>
              </div>
            )}
          </details>

          {orderedShowMatches.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-400">No matches added yet.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {orderedShowMatches.map((match, index) => {
                const sides = matchSidesByMatch[match.id] ?? [];
                const participantRows = matchEntrantsByMatch[match.id] ?? [];
                const eligibleEntrants = entrantOptions.filter((entrant) => {
                  if (!entrant.active) return false;
                  if (match.roster_year && entrant.roster_year !== match.roster_year) {
                    return false;
                  }
                  const gender = match.roster_gender ?? "";
                  if (!gender || gender === "intergender") {
                    return true;
                  }
                  return entrant.gender === gender;
                });
                const sideEntries = sides.map((side, index) => {
                  const entrantsForSide = participantRows
                    .filter((row) => row.side_id === side.id)
                    .map((row) => entrantMap.get(row.entrant_id))
                    .filter(Boolean) as EntrantRow[];
                  const label =
                    side.label?.trim() || `Side ${index + 1}`;
                  return { side, label, entrants: entrantsForSide };
                });
                const allEntrants = participantRows
                  .map((row) => entrantMap.get(row.entrant_id))
                  .filter(Boolean) as EntrantRow[];
                const matchType = match.match_type;
                const isBlindGauntlet = matchType === "blind_gauntlet";
                const isMainEventEdit =
                  matchMainEventEdits[match.id] ?? Boolean(match.is_main_event);
                const isChampionshipEdit =
                  matchChampionshipEdits[match.id] ?? Boolean(match.is_championship);
                const beltNameEdit =
                  matchChampionshipNameEdits[match.id] ??
                  match.championship_name ??
                  "";
                const beltImageEdit =
                  matchChampionshipImageEdits[match.id] ??
                  match.championship_image_url ??
                  "";
                const championSideEdit =
                  matchChampionSideEdits[match.id] ??
                  match.champion_side_id ??
                  "";
                const knownWrestlerEdit =
                  matchKnownWrestlerEdits[match.id] ??
                  match.known_wrestler_id ??
                  "";
                const gauntletCandidates =
                  gauntletCandidateEntrantsByMatch[match.id] ?? [];
                const gauntletCandidateIds = new Set(
                  gauntletCandidates.map((row) => row.entrant_id)
                );
                const selection = matchEntrantSelection[match.id] ?? "";
                const sideSelection = matchSideSelection[match.id] ?? "";
                const participantsExist =
                  sideEntries.length > 0 || participantRows.length > 0;
                const participantsOpen =
                  matchParticipantsOpen[match.id] ?? !participantsExist;
                const isFocused = focusedMatchId === match.id;
                const missingSides = !isBlindGauntlet && sideEntries.length === 0;
                const emptySides = sideEntries.filter(
                  (side) => side.entrants.length === 0
                );
                const missingImages = allEntrants.filter(
                  (entrant) => !entrant.image_url
                );
                const genericSides = sideEntries.filter((side, sideIndex) => {
                  const expected = `Side ${sideIndex + 1}`;
                  return !side.side.label?.trim() || side.label === expected;
                });
                const championshipIncomplete =
                  isChampionshipEdit && !beltNameEdit.trim();
                const gauntletIncomplete =
                  isBlindGauntlet &&
                  (!knownWrestlerEdit || gauntletCandidates.length < 3);
                const blockerCount =
                  (missingSides ? 1 : 0) +
                  emptySides.length +
                  (gauntletIncomplete ? 1 : 0);
                const warningCount =
                  missingImages.length +
                  genericSides.length +
                  (championshipIncomplete ? 1 : 0);
                const sideSummary =
                  isBlindGauntlet
                    ? knownWrestlerEdit
                      ? entrantMap.get(knownWrestlerEdit)?.name ?? "Known wrestler set"
                      : "Known wrestler needed"
                    : sideEntries.length > 0
                      ? sideEntries
                          .map(({ label, entrants }) =>
                            entrants.length > 0
                              ? entrants.map((entrant) => entrant.name).join(" & ")
                              : label
                          )
                          .join(" vs ")
                      : "No sides added";
                const resultSummary =
                  match.winner_side_id ||
                  match.winner_entrant_id ||
                  match.finish_method ||
                  match.match_length ||
                  match.match_interference ||
                  typeof match.gauntlet_survival_result === "boolean" ||
                  match.gauntlet_final_entrant_id
                    ? "Results entered"
                    : "No results yet";
                const searchValue =
                  matchParticipantSearch[match.id]?.trim().toLowerCase() ?? "";
                const visibleEntrants = eligibleEntrants.filter((entrant) => {
                  if (!searchValue) return true;
                  return `${entrant.name} ${entrant.promotion ?? ""}`
                    .toLowerCase()
                    .includes(searchValue);
                });
                return (
                  <div
                    key={match.id}
                    ref={(element) => {
                      matchRefs.current[match.id] = element;
                    }}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
                  >
                    <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-lg font-semibold text-amber-200">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-zinc-100">
                            {match.name}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                            {formatMatchTypeLabel(match.match_type)}
                            {match.roster_year ? ` · ${match.roster_year}` : ""}
                            {match.roster_gender ? ` · ${match.roster_gender}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-h-12 flex-wrap items-center gap-2">
                          {sideEntries.length > 0 ? (
                            sideEntries.map(({ side, label, entrants }, sideIndex) => (
                              <div
                                key={`${match.id}-summary-${side.id}`}
                                className="flex min-w-0 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-2 py-2"
                              >
                                <div className="flex -space-x-2">
                                  {entrants.slice(0, 3).map((entrant) => (
                                    <Image
                                      key={entrant.id}
                                      src={entrant.image_url || "/images/placeholder-avatar.svg"}
                                      alt={entrant.name}
                                      width={32}
                                      height={32}
                                      sizes="32px"
                                      className="h-8 w-8 rounded-full border border-zinc-950 bg-zinc-800 object-cover"
                                    />
                                  ))}
                                  {entrants.length === 0 ? (
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-[10px] font-semibold text-zinc-500">
                                      {sideIndex + 1}
                                    </span>
                                  ) : null}
                                </div>
                                <span className="max-w-[12rem] truncate text-xs text-zinc-300">
                                  {entrants.length > 0
                                    ? entrants.map((entrant) => entrant.name).join(" & ")
                                    : label}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
                              No sides yet
                            </span>
                          )}
                        </div>
                        <p className="mt-2 truncate text-xs text-zinc-500">
                          {sideSummary}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {match.is_main_event ? (
                          <span className="rounded-full border border-amber-400/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                            Main event
                          </span>
                        ) : null}
                        {match.is_championship ? (
                          <span className="rounded-full border border-amber-400/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                            Championship
                          </span>
                        ) : null}
                        {isBlindGauntlet ? (
                          <span className="rounded-full border border-sky-400/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                            Blind Gauntlet
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                            blockerCount > 0
                              ? "bg-red-500/15 text-red-200"
                              : warningCount > 0
                                ? "bg-amber-400/15 text-amber-200"
                                : "bg-emerald-500/15 text-emerald-200"
                          }`}
                        >
                          {blockerCount > 0
                            ? `${blockerCount} blocker${blockerCount === 1 ? "" : "s"}`
                            : warningCount > 0
                              ? `${warningCount} warning${warningCount === 1 ? "" : "s"}`
                              : "Ready"}
                        </span>
                        <span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                          {resultSummary}
                        </span>
                        <button
                          className="inline-flex h-9 items-center justify-center rounded-full border border-amber-400 px-4 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                          type="button"
                          onClick={() =>
                            setFocusedMatchId((current) =>
                              current === match.id ? null : match.id
                            )
                          }
                        >
                          {isFocused ? "Close" : "Edit match"}
                        </button>
                      </div>
                    </div>
                    {isFocused && (
                    <>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                          {match.kind} · {formatMatchTypeLabel(match.match_type)}
                          {match.roster_year ? ` · ${match.roster_year}` : ""}
                          {match.roster_gender ? ` · ${match.roster_gender}` : ""}
                        </p>
                        <label className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                          Match name
                          <div className="mt-2 flex flex-wrap gap-2">
                            <input
                              className="h-10 min-w-[220px] flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                              value={matchNameEdits[match.id] ?? match.name}
                              onChange={(event) =>
                                setMatchNameEdits((prev) => ({
                                  ...prev,
                                  [match.id]: event.target.value,
                                }))
                              }
                            />
                            <button
                              className="inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-4 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                              type="button"
                              onClick={() =>
                                handleUpdateMatchName(
                                  match.id,
                                  matchNameEdits[match.id] ?? match.name
                                )
                              }
                            >
                              Save match
                            </button>
                          </div>
                        </label>
                        <p className="text-xs text-zinc-500">
                          Edit the match name and click “Save match”.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 px-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-amber-400 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                          type="button"
                          onClick={() => handleMoveMatchOrder(match.id, "up")}
                          disabled={index === 0}
                        >
                          Move up
                        </button>
                        <button
                          className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 px-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-amber-400 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                          type="button"
                          onClick={() => handleMoveMatchOrder(match.id, "down")}
                          disabled={index === orderedShowMatches.length - 1}
                        >
                          Move down
                        </button>
                        <button
                          className="inline-flex h-10 items-center justify-center rounded-full border border-red-500/60 px-4 text-[10px] font-semibold uppercase tracking-wide text-red-200 transition hover:border-red-400 hover:text-red-100"
                          type="button"
                          onClick={() => handleDeleteMatch(match.id)}
                        >
                          Delete match
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3">
                      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                        Match details
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                          <input
                            className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-400"
                            type="checkbox"
                            checked={isMainEventEdit}
                            onChange={(event) =>
                              setMatchMainEventEdits((prev) => ({
                                ...prev,
                                [match.id]: event.target.checked,
                              }))
                            }
                          />
                          Main event
                        </label>
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                          <input
                            className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-400"
                            type="checkbox"
                            checked={isChampionshipEdit}
                            onChange={(event) =>
                              setMatchChampionshipEdits((prev) => ({
                                ...prev,
                                [match.id]: event.target.checked,
                              }))
                            }
                          />
                          Championship match
                        </label>
                        <button
                          className="ml-auto inline-flex h-9 items-center justify-center rounded-full border border-amber-400 px-3 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                          type="button"
                          onClick={() => handleUpdateMatchDetails(match.id)}
                        >
                          Save details
                        </button>
                      </div>
                      {isChampionshipEdit && (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <input
                            className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                            placeholder="Championship name"
                            value={beltNameEdit}
                            onChange={(event) =>
                              setMatchChampionshipNameEdits((prev) => ({
                                ...prev,
                                [match.id]: event.target.value,
                              }))
                            }
                          />
                          <input
                            className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                            placeholder="Championship image URL"
                            value={beltImageEdit}
                            onChange={(event) =>
                              setMatchChampionshipImageEdits((prev) => ({
                                ...prev,
                                [match.id]: event.target.value,
                              }))
                            }
                          />
                          <select
                            className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 md:col-span-2"
                            value={championSideEdit}
                            onChange={(event) =>
                              setMatchChampionSideEdits((prev) => ({
                                ...prev,
                                [match.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Select current champion side</option>
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
                      )}
                    </div>

                    {isBlindGauntlet && (
                      <div className="mt-4 rounded-2xl border border-amber-400/20 bg-black/30 p-3">
                        <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
                          Blind Gauntlet setup
                        </p>
                        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
                          <select
                            className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                            value={knownWrestlerEdit}
                            onChange={(event) =>
                              setMatchKnownWrestlerEdits((prev) => ({
                                ...prev,
                                [match.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Known wrestler</option>
                            {eligibleEntrants
                              .filter((entrant) => !gauntletCandidateIds.has(entrant.id))
                              .map((entrant) => (
                                <option key={entrant.id} value={entrant.id}>
                                  {entrant.name}
                                </option>
                              ))}
                          </select>
                          <button
                            className="inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-4 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                            type="button"
                            onClick={() =>
                              handleUpdateBlindGauntletKnownWrestler(match.id)
                            }
                          >
                            Save known wrestler
                          </button>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                          <select
                            className="h-10 min-w-[240px] rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                            value={matchGauntletCandidateSelection[match.id] ?? ""}
                            onChange={(event) =>
                              setMatchGauntletCandidateSelection((prev) => ({
                                ...prev,
                                [match.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Add candidate entrant</option>
                            {eligibleEntrants
                              .filter(
                                (entrant) =>
                                  entrant.id !== knownWrestlerEdit &&
                                  !gauntletCandidateIds.has(entrant.id)
                              )
                              .map((entrant) => (
                                <option key={entrant.id} value={entrant.id}>
                                  {entrant.name}
                                </option>
                              ))}
                          </select>
                          <button
                            className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-200"
                            type="button"
                            onClick={() => handleAddGauntletCandidate(match.id)}
                          >
                            Add candidate
                          </button>
                          <span className="text-xs text-zinc-500">
                            {gauntletCandidates.length} selected · required 3-20
                          </span>
                        </div>
                        {gauntletCandidates.length > 0 && (
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {gauntletCandidates.map((row) => {
                              const entrant = entrantMap.get(row.entrant_id);
                              return (
                                <div
                                  key={row.id}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2"
                                >
                                  <EntrantCard
                                    name={entrant?.name ?? "Entrant"}
                                    promotion={entrant?.promotion ?? null}
                                    imageUrl={entrant?.image_url ?? null}
                                  />
                                  <button
                                    className="inline-flex h-8 items-center justify-center rounded-full border border-red-500/70 px-3 text-[10px] font-semibold uppercase tracking-wide text-red-200 transition hover:border-red-400 hover:text-red-100"
                                    type="button"
                                    onClick={() =>
                                      handleRemoveGauntletCandidate(
                                        match.id,
                                        row.entrant_id
                                      )
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                          Results
                        </p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {resultSummary}. Winner and result details are managed from Results.
                        </p>
                      </div>
                      <button
                        className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-700 px-4 text-[10px] font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-200"
                        type="button"
                        onClick={() => setAdminView("results")}
                      >
                        Open Results
                      </button>
                    </div>

                    {!isBlindGauntlet && (!participantsOpen ? (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-400">
                        <span>Participants saved.</span>
                        <button
                          className="inline-flex h-8 items-center justify-center rounded-full border border-amber-400 px-4 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                          type="button"
                          onClick={() =>
                            setMatchParticipantsOpen((prev) => ({
                              ...prev,
                              [match.id]: true,
                            }))
                          }
                        >
                          Edit participants
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3">
                        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Find wrestler
                            <input
                              className="mt-2 h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                              placeholder="Search by wrestler or promotion"
                              value={matchParticipantSearch[match.id] ?? ""}
                              onChange={(event) =>
                                setMatchParticipantSearch((prev) => ({
                                  ...prev,
                                  [match.id]: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <span className="text-xs text-zinc-500">
                            {visibleEntrants.length} available
                          </span>
                        </div>
                        {searchValue ? (
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {visibleEntrants.slice(0, 9).map((entrant) => {
                              const selected = selection === entrant.id;
                              return (
                                <button
                                  key={entrant.id}
                                  className={`flex items-center justify-between gap-3 rounded-xl border p-2 text-left transition ${
                                    selected
                                      ? "border-amber-400 bg-amber-400/10"
                                      : "border-zinc-800 bg-zinc-900/70 hover:border-amber-400/60"
                                  }`}
                                  type="button"
                                  onClick={() =>
                                    setMatchEntrantSelection((prev) => ({
                                      ...prev,
                                      [match.id]: entrant.id,
                                    }))
                                  }
                                >
                                  <EntrantCard
                                    name={entrant.name}
                                    promotion={entrant.promotion}
                                    imageUrl={entrant.image_url}
                                  />
                                  {selected ? (
                                    <span className="rounded-full bg-amber-400 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-950">
                                      Selected
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                            {visibleEntrants.length === 0 ? (
                              <p className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-500 md:col-span-2 xl:col-span-3">
                                No wrestlers match this search.
                              </p>
                            ) : null}
                            {visibleEntrants.length > 9 ? (
                              <p className="text-xs text-zinc-500 md:col-span-2 xl:col-span-3">
                                Showing first 9 matches. Keep typing to narrow results.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <select
                          className="h-10 min-w-[200px] rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                          value={sideSelection}
                          onChange={(event) =>
                            setMatchSideSelection((prev) => ({
                              ...prev,
                              [match.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select side</option>
                          {sideEntries.map(({ side, label }) => (
                            <option key={side.id} value={side.id}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="h-10 min-w-[240px] rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                          value={selection}
                          onChange={(event) =>
                            setMatchEntrantSelection((prev) => ({
                              ...prev,
                              [match.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Add participant</option>
                          {visibleEntrants.map((entrant) => (
                            <option key={entrant.id} value={entrant.id}>
                              {entrant.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-200"
                          type="button"
                          onClick={() => {
                            if (!selection || !sideSelection) return;
                            handleAddMatchEntrant(match.id, selection, sideSelection);
                            setMatchEntrantSelection((prev) => ({
                              ...prev,
                              [match.id]: "",
                            }));
                            setMatchSideSelection((prev) => ({
                              ...prev,
                              [match.id]: "",
                            }));
                            setMatchParticipantsOpen((prev) => ({
                              ...prev,
                              [match.id]: false,
                            }));
                          }}
                        >
                          Add participant
                        </button>
                        <button
                          className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-200"
                          type="button"
                          onClick={() => {
                            handleAddMatchSide(match.id);
                            setMatchParticipantsOpen((prev) => ({
                              ...prev,
                              [match.id]: false,
                            }));
                          }}
                        >
                          Add side
                        </button>
                      </div>
                      </div>
                    ))}

                    {!isBlindGauntlet && (sideEntries.length === 0 ? (
                      <p className="mt-3 text-xs text-zinc-500">
                        No sides added yet.
                      </p>
                    ) : (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {sideEntries.map(({ side, label, entrants }) => {
                          const sideImageEdit =
                            matchSideImageEdits[side.id] ?? side.image_url ?? "";
                          const canPreviewSideImage =
                            sideImageEdit.startsWith("http://") ||
                            sideImageEdit.startsWith("https://") ||
                            sideImageEdit.startsWith("/");
                          return (
                            <div
                              key={side.id}
                              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3"
                            >
                            <div className="grid gap-3">
                              <div className="flex items-center justify-between gap-2">
                                <input
                                  className="h-9 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100"
                                  value={matchSideLabelEdits[side.id] ?? label}
                                  onChange={(event) =>
                                    setMatchSideLabelEdits((prev) => ({
                                      ...prev,
                                      [side.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Side label"
                                />
                                <button
                                  className="inline-flex h-9 items-center justify-center rounded-full border border-amber-400 px-3 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                                  type="button"
                                  onClick={() =>
                                    handleUpdateMatchSideLabel(
                                      side.id,
                                      matchSideLabelEdits[side.id] ?? label
                                    )
                                  }
                                >
                                  Save
                                </button>
                              </div>
                              <div className="grid gap-2">
                                {canPreviewSideImage ? (
                                  <div className="relative aspect-video overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                                    <Image
                                      src={sideImageEdit}
                                      alt={`${label} side image`}
                                      fill
                                      sizes="(min-width: 768px) 360px, 90vw"
                                      className="object-cover object-center"
                                    />
                                  </div>
                                ) : null}
                                <div className="flex items-center justify-between gap-2">
                                  <input
                                    className="h-9 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100"
                                    value={sideImageEdit}
                                    onChange={(event) =>
                                      setMatchSideImageEdits((prev) => ({
                                        ...prev,
                                        [side.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="Optional side image URL, ideally 1200 x 675"
                                  />
                                  <button
                                    className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-700 px-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-200"
                                    type="button"
                                    onClick={() =>
                                      handleUpdateMatchSideImage(
                                        side.id,
                                        sideImageEdit
                                      )
                                    }
                                  >
                                    Save image
                                  </button>
                                </div>
                              </div>
                            </div>
                            {entrants.length === 0 ? (
                              <p className="mt-3 text-xs text-zinc-500">
                                No participants yet.
                              </p>
                            ) : (
                              <div className="mt-3 space-y-2">
                                {entrants.map((entrant) => (
                                  <div
                                    key={entrant.id}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2"
                                  >
                                    <EntrantCard
                                      name={entrant.name}
                                      promotion={entrant.promotion}
                                      imageUrl={entrant.image_url}
                                    />
                                    <button
                                      className="inline-flex h-8 items-center justify-center rounded-full border border-red-500/70 px-3 text-[10px] font-semibold uppercase tracking-wide text-red-200 transition hover:border-red-400 hover:text-red-100"
                                      type="button"
                                      onClick={() =>
                                        handleRemoveMatchEntrant(match.id, entrant.id)
                                      }
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    ))}
                    </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {adminView === "advanced" && adminTab === "events" && (
          <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold">Eliminations</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Mark eliminations to keep the live scoreboard up to date.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <select
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={eliminateEntryId}
              onChange={(event) => setEliminateEntryId(event.target.value)}
            >
              <option value="">Select eliminated entrant</option>
              {entries.map((entry) => {
                const entrant = entrants.find(
                  (candidate) => candidate.id === entry.entrant_id
                );
                return (
                  <option key={entry.id} value={entry.id}>
                    {entrant?.name ?? "Unknown entrant"}
                  </option>
                );
              })}
            </select>
            <select
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={eliminatedById}
              onChange={(event) => setEliminatedById(event.target.value)}
            >
              <option value="">Eliminated by (optional)</option>
              {eventEntrantOptions.map((entrant) => (
                <option key={entrant.id} value={entrant.id}>
                  {entrant.name}
                </option>
              ))}
            </select>
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-amber-400 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300"
              type="button"
              onClick={handleElimination}
            >
              Record elimination
            </button>
          </div>
        </section>
        )}

        {adminView === "advanced" && adminTab === "events" && (
          <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold">Active Event Entries</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Edit entry numbers, eliminations, or the credited eliminator.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              {getChangedEntries().length} unsaved change
              {getChangedEntries().length === 1 ? "" : "s"}
            </p>
            <button
              className="inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-4 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleSaveAllEntries}
              disabled={bulkEntrySaveBusy}
            >
              {bulkEntrySaveBusy ? "Saving..." : "Save all"}
            </button>
          </div>
          <div className="mt-6 max-h-[420px] space-y-4 overflow-y-auto pr-1">
            {entries.length === 0 ? (
              <p className="text-sm text-zinc-400">No entries yet.</p>
            ) : (
              entries.map((entry) => {
                const entrant = entrantMap.get(entry.entrant_id);
                return (
                  <div
                    key={entry.id}
                    className={`rounded-2xl border p-4 ${
                      entry.eliminated_at
                        ? "border-red-500/60 bg-red-500/5"
                        : "border-zinc-800 bg-zinc-950/60"
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <EntrantCard
                          name={entrant?.name ?? "Unknown entrant"}
                          promotion={entrant?.promotion ?? "Unknown promotion"}
                          imageUrl={entrant?.image_url}
                        />
                        {entry.is_confirmed ? (
                          <span className="rounded-full border border-emerald-400/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                            Confirmed
                          </span>
                        ) : null}
                        {entry.eliminated_at ? (
                          <span className="rounded-full border border-red-500/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-200">
                            Eliminated
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex flex-col text-xs text-zinc-400">
                          Entry #
                          <input
                            className="mt-1 h-10 w-24 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                            value={entry.entry_number ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setEntries((prev) =>
                                prev.map((item) =>
                                  item.id === entry.id
                                    ? {
                                        ...item,
                                        entry_number:
                                          value === ""
                                            ? null
                                            : Number(value),
                                      }
                                    : item
                                )
                              );
                            }}
                          />
                        </label>
                        <label className="flex flex-col text-xs text-zinc-400">
                          Eliminations
                          <input
                            className="mt-1 h-10 w-28 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                            value={entry.eliminations_count ?? 0}
                            onChange={(event) => {
                              const value = event.target.value;
                              setEntries((prev) =>
                                prev.map((item) =>
                                  item.id === entry.id
                                    ? {
                                        ...item,
                                        eliminations_count:
                                          value === ""
                                            ? 0
                                            : Number(value),
                                      }
                                    : item
                                )
                              );
                            }}
                          />
                        </label>
                        <label className="flex flex-col text-xs text-zinc-400">
                          Confirmed
                          <input
                            type="checkbox"
                            className="mt-3 h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                            checked={!!entry.is_confirmed}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setEntries((prev) =>
                                prev.map((item) =>
                                  item.id === entry.id
                                    ? { ...item, is_confirmed: checked }
                                    : item
                                )
                              );
                            }}
                          />
                        </label>
                        <label className="flex flex-col text-xs text-zinc-400">
                          Eliminated by
                          <select
                            className="mt-1 h-10 min-w-[200px] rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                            value={entry.eliminated_by ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setEntries((prev) =>
                                prev.map((item) =>
                                  item.id === entry.id
                                    ? {
                                        ...item,
                                        eliminated_by: value || null,
                                      }
                                    : item
                                )
                              );
                            }}
                          >
                            <option value="">Not set</option>
                            {eventEntrantOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="mt-5 h-10 rounded-full border border-amber-400 px-4 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-200 hover:text-amber-100"
                          type="button"
                          onClick={() => handleUpdateEntry(entry)}
                        >
                          Save
                        </button>
                        <button
                          className="mt-5 h-10 rounded-full border border-red-500/70 px-4 text-xs font-semibold uppercase tracking-wide text-red-200 transition hover:border-red-400 hover:text-red-100"
                          type="button"
                          onClick={() => handleRemoveEntry(entry.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
        )}

        {adminView === "advanced" && (
        <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold">Scoring</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Recalculate scores after updating eliminations or results.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              onClick={() => {
                void handleRecalculateScores();
              }}
              disabled={recalcBusy}
            >
              {recalcBusy ? "Recalculating…" : "Recalculate scores"}
            </button>
            <button
              className="inline-flex h-11 items-center justify-center rounded-full border border-red-500/70 px-6 text-sm font-semibold uppercase tracking-wide text-red-200 transition hover:border-red-400 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              onClick={handleClearShowScores}
              disabled={clearScoresBusy || !activeShow}
            >
              {clearScoresBusy ? "Clearing…" : "Clear picks & scores"}
            </button>
          </div>
        </section>
        )}

        {eventLogOpen && activeEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl shadow-black/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">
                    Event activity log
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    {activeEvent.name}
                  </p>
                </div>
                <button
                  className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-700 px-4 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
                  type="button"
                  onClick={() => setEventLogOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="mt-5 max-h-[360px] space-y-3 overflow-y-auto">
                {eventLogs.length === 0 ? (
                  <p className="text-sm text-zinc-400">
                    No entries yet for this event.
                  </p>
                ) : (
                  eventLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200"
                    >
                      <div>
                        <p className="font-medium text-zinc-100">
                          {formatLogSummary(log)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        className="inline-flex h-9 items-center justify-center rounded-full border border-amber-400 px-4 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        onClick={() => handleUndoLog(log)}
                        disabled={eventLogBusy}
                      >
                        {eventLogBusy ? "Working..." : "Undo"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {showModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl shadow-black/40">
              <h3 className="text-lg font-semibold text-zinc-100">Create show</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Add a new show card. This becomes the active show.
              </p>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Show title
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    placeholder="Sunday Night's Main Event"
                    value={showName}
                    onChange={(event) => setShowName(event.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Share URL name
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    placeholder="sunday-nights-main-event"
                    value={showSlug}
                    onChange={(event) => setShowSlug(event.target.value)}
                  />
                  <span className="mt-2 block text-xs font-normal normal-case tracking-normal text-zinc-400">
                    Leave blank to create one from the show title.
                  </span>
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Promotion
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    value={showPromotionId}
                    onChange={(event) => setShowPromotionId(event.target.value)}
                  >
                    <option value="">Select promotion</option>
                    {promotions.map((promotion) => (
                      <option key={promotion.id} value={promotion.id}>
                        {promotion.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Show poster image
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    placeholder="Paste the show poster link"
                    value={showImageUrl}
                    onChange={(event) => setShowImageUrl(event.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Short show description
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    placeholder="A quick line fans will see on the show page"
                    value={showTagline}
                    onChange={(event) => setShowTagline(event.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Show date and start time
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    type="datetime-local"
                    value={showStartsAt}
                    onChange={(event) => setShowStartsAt(event.target.value)}
                  />
                </label>
                <label className="flex items-center gap-3 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
                    checked={showRequiresEmail}
                    onChange={(event) => setShowRequiresEmail(event.target.checked)}
                  />
                  Require email registration
                </label>
                <label className="flex items-center gap-3 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
                    checked={showLockPicksAtStart}
                    onChange={(event) => setShowLockPicksAtStart(event.target.checked)}
                  />
                  Lock all picks at show start
                </label>
                <label className="flex items-center gap-3 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
                    checked={showIsFeaturedPlayShow}
                    onChange={(event) =>
                      setShowIsFeaturedPlayShow(event.target.checked)
                    }
                  />
                  Send /play to this show
                </label>
                <label className="flex items-center gap-3 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
                    checked={showIsOver}
                    onChange={(event) => setShowIsOver(event.target.checked)}
                  />
                  Mark show as over
                </label>
                <label className="flex items-center gap-3 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
                    checked={showUseConfidencePoints}
                    onChange={(event) =>
                      setShowUseConfidencePoints(event.target.checked)
                    }
                  />
                  Use confidence points for match winners
                </label>
                <label className="flex items-center gap-3 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
                    checked={showRequiresLocationVerification}
                    onChange={(event) =>
                      setShowRequiresLocationVerification(event.target.checked)
                    }
                  />
                  Require location verification
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Venue name
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    placeholder="Arena or event venue"
                    value={showVenueName}
                    onChange={(event) => setShowVenueName(event.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Venue address
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    placeholder="Street address or city"
                    value={showVenueAddress}
                    onChange={(event) => setShowVenueAddress(event.target.value)}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Venue latitude
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                      inputMode="decimal"
                      placeholder="Map latitude"
                      value={showVenueLatitude}
                      onChange={(event) =>
                        setShowVenueLatitude(event.target.value)
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Venue longitude
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                      inputMode="decimal"
                      placeholder="Map longitude"
                      value={showVenueLongitude}
                      onChange={(event) =>
                        setShowVenueLongitude(event.target.value)
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Location check-in radius
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                      inputMode="numeric"
                      placeholder="Meters from the venue"
                      value={showLocationRadiusMeters}
                      onChange={(event) =>
                        setShowLocationRadiusMeters(event.target.value)
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
                <span>Need a new promotion?</span>
                <button
                  className="inline-flex items-center justify-center rounded-full border border-zinc-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-amber-400 hover:text-amber-200"
                  type="button"
                  onClick={() => setPromotionModalOpen(true)}
                >
                  Add promotion
                </button>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                <button
                  className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
                  type="button"
                  onClick={() => setShowModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center rounded-full bg-amber-400 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300"
                  type="button"
                  onClick={handleCreateShow}
                >
                  Save show
                </button>
              </div>
            </div>
          </div>
        )}

        {promotionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl shadow-black/40">
              <h3 className="text-lg font-semibold text-zinc-100">
                Create promotion
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Add a promotion grouping for shows.
              </p>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Promotion name
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    placeholder="AWR Wrestling"
                    value={promotionName}
                    onChange={(event) => setPromotionName(event.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Promotion URL name
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    placeholder="awr-wrestling"
                    value={promotionSlug}
                    onChange={(event) => setPromotionSlug(event.target.value)}
                  />
                  <span className="mt-2 block text-xs font-normal normal-case tracking-normal text-zinc-400">
                    Leave blank to create one from the promotion name.
                  </span>
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Promotion image
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
                    placeholder="Paste the promotion image link"
                    value={promotionImageUrl}
                    onChange={(event) => setPromotionImageUrl(event.target.value)}
                  />
                </label>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                <button
                  className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
                  type="button"
                  onClick={() => setPromotionModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center rounded-full bg-amber-400 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300"
                  type="button"
                  onClick={handleCreatePromotion}
                >
                  Save promotion
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
