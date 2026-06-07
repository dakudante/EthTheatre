import Link from "next/link";
import {
  BadgeCheck,
  MapPin,
  Quote,
  Sparkles,
  Star,
} from "lucide-react";
import type { RankedScreen } from "@/lib/types";
import { accentFor } from "@/lib/format-config";
import { ScoreRing } from "@/components/score-ring";
import { FormatBadge } from "@/components/format-badge";
import { SpecTile } from "@/components/spec-value";
import { ShowtimeRow } from "@/components/showtime-row";
import { cn } from "@/lib/utils";

const RANK_LABELS: Record<number, string> = {
  1: "Best screen",
  2: "Runner-up",
  3: "Also great",
};

export function RankedScreenCard({ ranked }: { ranked: RankedScreen }) {
  const { rank, score, reason, screen, theatre, dcp, showtimes } = ranked;
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
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                isTop ? "bg-primary/15 text-primary" : "bg-white/5 text-muted-foreground",
              )}
            >
              {isTop && <Sparkles className="size-3" />}
              {RANK_LABELS[rank] ?? `Rank #${rank}`}
            </span>
            <FormatBadge value={screen.screen_format} glow={isTop} />
            {dcp?.verified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">
                <BadgeCheck className="size-3" /> Verified DCP
              </span>
            )}
          </div>

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

          {/* Why it ranks here */}
          <div className="mt-3 flex gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <Quote className="size-4 shrink-0 text-primary/70" />
            <p className="text-sm leading-relaxed text-foreground/90">{reason}</p>
          </div>

          {/* Screen hardware (theatre-level; the DCP master spec lives at the
              top of the movie page) */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Screen hardware
            </p>
            <div className="grid grid-cols-2 gap-2">
              <SpecTile label="Projection" value={screen.projection_system} />
              <SpecTile label="Sound system" value={screen.sound_system} />
              {/* New hardware fields — only render when populated */}
              {screen.projector_brand && (
                <SpecTile
                  label="Projector"
                  value={`${screen.projector_brand}${
                    screen.projector_model ? ` ${screen.projector_model}` : ""
                  }`}
                />
              )}
              {screen.screen_brand && (
                <SpecTile
                  label="Screen"
                  value={`${screen.screen_brand}${
                    screen.screen_dimensions ? ` (${screen.screen_dimensions})` : ""
                  }`}
                />
              )}
              {screen.screen_dimensions && !screen.screen_brand && (
                <SpecTile label="Screen size" value={screen.screen_dimensions} />
              )}
              {screen.screen_spec && (
                <SpecTile label="Screen size" value={screen.screen_spec} />
              )}
              <div
                className={cn(
                  "rounded-xl border bg-white/[0.03] px-3 py-2.5",
                  accent.border,
                )}
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
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

          {/* rating + showtimes */}
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
