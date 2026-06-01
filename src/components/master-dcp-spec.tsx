import { BadgeCheck, Clapperboard, RectangleHorizontal, ScanLine, Speaker } from "lucide-react";
import type { Dcp, Movie } from "@/lib/types";
import { accentFor } from "@/lib/format-config";
import { FormatBadge } from "@/components/format-badge";
import { SpecValue } from "@/components/spec-value";
import { cn } from "@/lib/utils";

/**
 * Movie-level "Master DCP Specification" — the technical master the film ships
 * in (a property of the MOVIE, not any one theatre). Shown above the ranked
 * screens. Falls back to the movie's format array when no DCP is on record.
 */
export function MasterDcpSpec({
  movie,
  dcp,
}: {
  movie: Movie;
  dcp: Dcp | null;
}) {
  const formats = (dcp?.format?.length ? dcp.format : movie.format) ?? [];

  const tiles = dcp
    ? [
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
      ]
    : [];

  const toneClass: Record<string, string> = {
    premium: "border-amber-400/30 text-amber-200",
    imax: "border-cyan-400/30 text-cyan-200",
    dolby: "border-violet-400/30 text-violet-200",
    epiq: "border-emerald-400/30 text-emerald-200",
    neutral: "border-white/10 text-foreground/90",
  };

  return (
    <section className="rounded-2xl glass p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <Clapperboard className="size-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
            Master DCP Specification
          </p>
          <h2 className="font-display text-xl font-bold leading-tight">
            {movie.title}
          </h2>
        </div>
      </div>

      {dcp ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tiles.map((t) => (
            <div
              key={t.label}
              className={cn(
                "rounded-xl border bg-white/[0.03] p-4",
                toneClass[t.tone] ?? toneClass.neutral,
              )}
            >
              <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
                <t.icon className="size-3.5" />
                {t.label}
              </div>
              <div className="text-base font-semibold text-foreground">
                <SpecValue value={t.value} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No confirmed master package — showing the formats this title is
          presented in.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {formats.map((f) => (
          <FormatBadge key={f} value={f} />
        ))}
        {dcp?.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">
            <BadgeCheck className="size-3" /> Verified
            {dcp.source ? ` · ${dcp.source}` : ""}
          </span>
        ) : (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">
            Catalogue spec
          </span>
        )}
      </div>
    </section>
  );
}
