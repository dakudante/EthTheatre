import Link from "next/link";
import {
  BadgeCheck,
  Clapperboard,
  Cpu,
  MapPin,
  Maximize,
  Projector,
  Quote,
  RectangleHorizontal,
  ScanLine,
  Speaker,
  Sparkles,
  Star,
  Tv,
  Volume2,
} from "lucide-react";
import type { RankedScreen } from "@/lib/types";
import { accentFor } from "@/lib/format-config";
import { ScoreRing } from "@/components/score-ring";
import { FormatBadge } from "@/components/format-badge";
import { SpecTile, SpecValue } from "@/components/spec-value";
import { ShowtimeRow } from "@/components/showtime-row";
import { cn } from "@/lib/utils";

const RANK_LABELS: Record<number, string> = {
  1: "Best screen",
  2: "Runner-up",
  3: "Also great",
};

/** Inline DCP spec block — mirrors the old MasterDcpSpec look but scoped to
 *  the specific DCP that will actually play on this screen. */
function ScreenDcpSpec({ ranked }: { ranked: RankedScreen }) {
  const { dcp } = ranked;

  const toneClass: Record<string, string> = {
    premium: "border-amber-400/30 text-amber-200",
    imax: "border-cyan-400/30 text-cyan-200",
    dolby: "border-violet-400/30 text-violet-200",
    epiq: "border-emerald-400/30 text-emerald-200",
    neutral: "border-white/10 text-foreground/90",
  };

  if (!dcp) {
    return (
      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Clapperboard className="size-3" />
          DCP for this screen
        </p>
        <p className="text-xs text-muted-foreground">No confirmed package on record.</p>
      </div>
    );
  }

  const tiles = [
    {
      label: "Resolution",
      value: dcp.resolution,
      icon: ScanLine,
      tone: "premium" as const,
    },
    {
      label: "Aspect ratio",
      value: dcp.aspect_ratio_container,
      icon: RectangleHorizontal,
      tone: "imax" as const,
    },
    {
      label: "Audio mix",
      value: dcp.audio_mix,
      icon: Speaker,
      tone: accentFor(dcp.audio_mix).key,
    },
  ];

  const formats = dcp.format ?? [];

  return (
    <div className="mt-4">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Clapperboard className="size-3" />
        DCP for this screen
      </p>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((t) => (
            <div
              key={t.label}
              className={cn(
                "rounded-lg border bg-white/[0.03] px-3 py-2",
                toneClass[t.tone] ?? toneClass.neutral,
              )}
            >
              <div className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-70">
                <t.icon className="size-3" />
                {t.label}
              </div>
              <div className="text-sm font-semibold text-foreground">
                <SpecValue value={t.value} />
              </div>
            </div>
          ))}
        </div>

        {/* Format badges + verified pill */}
        {(formats.length > 0 || dcp.verified) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {formats.map((f) => (
              <FormatBadge key={f} value={f} />
            ))}
            {dcp.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">
                <BadgeCheck className="size-3" />
                Verified{dcp.source ? ` · ${dcp.source}` : ""}
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">
                Unverified spec
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function RankedScreenCard({ ranked }: { ranked: RankedScreen }) {
  const { rank, score, reason, screen, theatre, showtimes } = ranked;
  const accent = accentFor(screen.screen_format);
  const isTop = rank === 1;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl glass p-5 transition-all duration-300 sm:p-6",
        isTop && accent.ring,
      )}
    >
      {isTop && (
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
      )}

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
        {/* Rank + score */}
        <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-center sm:gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "grid size-10 place-items-center rounded-xl font-display text-lg font-bold",
                isTop
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/5 text-foreground/80",
              )}
            >
              {rank}
            </span>
          </div>
          <ScoreRing score={score} size={isTop ? 76 : 64} />
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                isTop
                  ? "bg-primary/15 text-primary"
                  : "bg-white/5 text-muted-foreground",
              )}
            >
              {isTop && <Sparkles className="size-3" />}
              {RANK_LABELS[rank] ?? `Rank #${rank}`}
            </span>
            <FormatBadge value={screen.screen_format} glow={isTop} />
            {ranked.dcp?.verified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">
                <BadgeCheck className="size-3" /> Verified DCP
              </span>
            )}
          </div>

          {/* Screen name */}
          <h3 className="mt-2.5 font-display text-xl font-bold leading-tight">
            <Link
              href={`/screens/${screen.id}`}
              className="transition-colors hover:text-primary"
            >
              {screen.name}
            </Link>
          </h3>
          <Link
            href={`/theatres/${theatre.id}`}
            className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <MapPin className="size-3.5" />
            {theatre.name} · {theatre.city}
          </Link>

          {/* Ranking reason */}
          <div className="mt-3 flex gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <Quote className="size-4 shrink-0 text-primary/70" />
            <p className="text-sm leading-relaxed text-foreground/90">{reason}</p>
          </div>

          {/* ── DCP spec for THIS screen ── */}
          <ScreenDcpSpec ranked={ranked} />

          {/* ── Screen hardware ── */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Screen hardware
            </p>
            <div className="grid grid-cols-2 gap-2">
              <SpecTile
                label="Projection"
                value={screen.projection_system}
                icon={Projector}
              />
              <SpecTile
                label="Sound system"
                value={screen.sound_system}
                icon={Volume2}
              />
              {screen.projector_brand && (
                <SpecTile
                  label="Projector"
                  icon={Cpu}
                  value={`${screen.projector_brand}${
                    screen.projector_model ? ` ${screen.projector_model}` : ""
                  }`}
                />
              )}
              {screen.screen_brand && (
                <SpecTile
                  label="Screen type"
                  icon={Tv}
                  value={screen.screen_brand}
                />
              )}
              {screen.screen_dimensions && (
                <SpecTile
                  label="Screen size"
                  icon={Maximize}
                  value={screen.screen_dimensions}
                />
              )}
              <div
                className={cn(
                  "rounded-xl border bg-white/[0.03] px-3 py-2.5",
                  accent.border,
                )}
              >
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Tv className="size-3" />
                  Screen class
                </p>
                <p className={cn("mt-0.5 text-sm font-medium", accent.text)}>
                  {screen.screen_format}
                </p>
              </div>
            </div>
            {(screen.number_of_seats || screen.three_d_system) && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {screen.number_of_seats ? (
                  <span>Seats: {screen.number_of_seats.toLocaleString()}</span>
                ) : null}
                {screen.three_d_system ? (
                  <span>3D: {screen.three_d_system}</span>
                ) : null}
              </div>
            )}
          </div>

          {/* Rating + showtimes */}
          <div className="mt-4 flex items-center gap-1.5 text-sm">
            <Star className="size-4 fill-amber-400 text-amber-400" />
            <span className="font-medium">{screen.user_rating.toFixed(1)}</span>
            <span className="text-muted-foreground">
              ({screen.review_count.toLocaleString()} reviews)
            </span>
          </div>

          {showtimes.length > 0 && (
            <div className="mt-3">
              <ShowtimeRow showtimes={showtimes} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
