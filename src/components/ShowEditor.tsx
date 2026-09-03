"use client";

type ShowEditorProps = {
  activeShowName: string | null;
  name: string;
  setName: (value: string) => void;
  slug: string;
  setSlug: (value: string) => void;
  promotions: { id: string; name: string }[];
  promotionId: string;
  setPromotionId: (value: string) => void;
  imageUrl: string;
  setImageUrl: (value: string) => void;
  tagline: string;
  setTagline: (value: string) => void;
  requiresEmailRegistration: boolean;
  setRequiresEmailRegistration: (value: boolean) => void;
  lockPicksAtStart: boolean;
  setLockPicksAtStart: (value: boolean) => void;
  isFeaturedPlayShow: boolean;
  setIsFeaturedPlayShow: (value: boolean) => void;
  isOver: boolean;
  setIsOver: (value: boolean) => void;
  useConfidencePoints: boolean;
  setUseConfidencePoints: (value: boolean) => void;
  requiresLocationVerification: boolean;
  setRequiresLocationVerification: (value: boolean) => void;
  venueName: string;
  setVenueName: (value: string) => void;
  venueAddress: string;
  setVenueAddress: (value: string) => void;
  venueLatitude: string;
  setVenueLatitude: (value: string) => void;
  venueLongitude: string;
  setVenueLongitude: (value: string) => void;
  locationRadiusMeters: string;
  setLocationRadiusMeters: (value: string) => void;
  startsAt: string;
  setStartsAt: (value: string) => void;
  saving: boolean;
  disabled: boolean;
  onUseNow: () => void;
  onSave: () => void;
};

export const ShowEditor = ({
  activeShowName,
  name,
  setName,
  slug,
  setSlug,
  promotions,
  promotionId,
  setPromotionId,
  imageUrl,
  setImageUrl,
  tagline,
  setTagline,
  requiresEmailRegistration,
  setRequiresEmailRegistration,
  lockPicksAtStart,
  setLockPicksAtStart,
  isFeaturedPlayShow,
  setIsFeaturedPlayShow,
  isOver,
  setIsOver,
  useConfidencePoints,
  setUseConfidencePoints,
  requiresLocationVerification,
  setRequiresLocationVerification,
  venueName,
  setVenueName,
  venueAddress,
  setVenueAddress,
  venueLatitude,
  setVenueLatitude,
  venueLongitude,
  setVenueLongitude,
  locationRadiusMeters,
  setLocationRadiusMeters,
  startsAt,
  setStartsAt,
  saving,
  disabled,
  onUseNow,
  onSave,
}: ShowEditorProps) => (
  <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
          Edit active show
        </p>
        <p className="mt-1 text-sm text-zinc-300">
          {activeShowName ? `Editing: ${activeShowName}` : "Select a show to edit."}
        </p>
      </div>
      <button
        className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-700 px-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-amber-300 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        onClick={onUseNow}
        disabled={disabled}
      >
        Use current time
      </button>
    </div>
    <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1fr_1.2fr_1fr_auto]">
      <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        Show title
        <input
          className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
          placeholder="Sunday Night's Main Event"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        Promotion
        <select
          className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
          value={promotionId}
          onChange={(event) => setPromotionId(event.target.value)}
          disabled={disabled}
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
          className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
          placeholder="Paste the show poster link"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        Show date and start time
        <input
          className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
          disabled={disabled}
        />
      </label>
      <button
        className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70 lg:self-end"
        type="button"
        onClick={onSave}
        disabled={disabled || saving}
      >
        {saving ? "Saving…" : "Save show"}
      </button>
    </div>
    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
      Share URL name
      <input
        className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
        placeholder="sunday-nights-main-event"
        value={slug}
        onChange={(event) => setSlug(event.target.value)}
        disabled={disabled}
      />
      <span className="mt-2 block text-xs font-normal normal-case tracking-normal text-amber-200/80">
        Changing this can affect friendly links that have already been shared.
        Use lowercase letters, numbers, and dashes.
      </span>
    </label>
    <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
      Short show description
      <input
        className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
        placeholder="A quick line fans will see on the show page"
        value={tagline}
        onChange={(event) => setTagline(event.target.value)}
        disabled={disabled}
      />
    </label>
    <details className="mt-4 rounded-2xl border border-zinc-800 bg-black/20 p-4">
      <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
        Advanced show settings
      </summary>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
            checked={requiresEmailRegistration}
            onChange={(event) =>
              setRequiresEmailRegistration(event.target.checked)
            }
            disabled={disabled}
          />
          Require email registration
        </label>
        <label className="flex items-center gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
            checked={lockPicksAtStart}
            onChange={(event) => setLockPicksAtStart(event.target.checked)}
            disabled={disabled}
          />
          Lock picks at show start
        </label>
        <label className="flex items-center gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
            checked={isFeaturedPlayShow}
            onChange={(event) => setIsFeaturedPlayShow(event.target.checked)}
            disabled={disabled}
          />
          Send /play to this show
        </label>
        <label className="flex items-center gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
            checked={isOver}
            onChange={(event) => setIsOver(event.target.checked)}
            disabled={disabled}
          />
          Mark show as over
        </label>
        <label className="flex items-center gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
            checked={useConfidencePoints}
            onChange={(event) => setUseConfidencePoints(event.target.checked)}
            disabled={disabled}
          />
          Use confidence points
        </label>
        <label className="flex items-center gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
            checked={requiresLocationVerification}
            onChange={(event) =>
              setRequiresLocationVerification(event.target.checked)
            }
            disabled={disabled}
          />
          Require location verification
        </label>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_0.8fr_0.8fr_0.8fr]">
        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Venue name
          <input
            className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
            placeholder="Arena or event venue"
            value={venueName}
            onChange={(event) => setVenueName(event.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Venue address
          <input
            className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
            placeholder="Street address or city"
            value={venueAddress}
            onChange={(event) => setVenueAddress(event.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Venue latitude
          <input
            className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
            inputMode="decimal"
            placeholder="Map latitude"
            value={venueLatitude}
            onChange={(event) => setVenueLatitude(event.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Venue longitude
          <input
            className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
            inputMode="decimal"
            placeholder="Map longitude"
            value={venueLongitude}
            onChange={(event) => setVenueLongitude(event.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Location check-in radius
          <input
            className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-normal normal-case tracking-normal text-zinc-100"
            inputMode="numeric"
            placeholder="Meters from the venue"
            value={locationRadiusMeters}
            onChange={(event) => setLocationRadiusMeters(event.target.value)}
            disabled={disabled}
          />
        </label>
      </div>
    </details>
  </div>
);
