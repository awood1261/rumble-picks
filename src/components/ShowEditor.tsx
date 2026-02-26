"use client";

type ShowEditorProps = {
  activeShowName: string | null;
  name: string;
  setName: (value: string) => void;
  promotions: { id: string; name: string }[];
  promotionId: string;
  setPromotionId: (value: string) => void;
  imageUrl: string;
  setImageUrl: (value: string) => void;
  tagline: string;
  setTagline: (value: string) => void;
  requiresEmailRegistration: boolean;
  setRequiresEmailRegistration: (value: boolean) => void;
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
  promotions,
  promotionId,
  setPromotionId,
  imageUrl,
  setImageUrl,
  tagline,
  setTagline,
  requiresEmailRegistration,
  setRequiresEmailRegistration,
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
      <input
        className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
        placeholder="Show name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={disabled}
      />
      <select
        className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
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
      <input
        className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
        placeholder="Show image URL"
        value={imageUrl}
        onChange={(event) => setImageUrl(event.target.value)}
        disabled={disabled}
      />
      <input
        className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
        type="datetime-local"
        value={startsAt}
        onChange={(event) => setStartsAt(event.target.value)}
        disabled={disabled}
      />
      <button
        className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-5 text-xs font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
        type="button"
        onClick={onSave}
        disabled={disabled || saving}
      >
        {saving ? "Saving…" : "Save show"}
      </button>
    </div>
    <input
      className="mt-3 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
      placeholder="Show tagline"
      value={tagline}
      onChange={(event) => setTagline(event.target.value)}
      disabled={disabled}
    />
    <label className="mt-3 flex items-center gap-3 text-sm text-zinc-300">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-300 focus:ring-amber-400"
        checked={requiresEmailRegistration}
        onChange={(event) => setRequiresEmailRegistration(event.target.checked)}
        disabled={disabled}
      />
      Require email registration for this show
    </label>
  </div>
);
