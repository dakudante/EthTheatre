"use client";

import type { RankedVariantGroup } from "@/lib/data";
import { RankedScreenCard } from "@/components/ranked-screen-card";
import { Reveal } from "@/components/reveal";

/**
 * Flat, unified ranked list across ALL DCP variants.
 *
 * What changed:
 *  - Removed the "Available DCP formats" chip panel at the top.
 *  - Removed the variant tab strip (no IMAX / Dolby / Standard separation).
 *  - All screens from every variant are merged into one list, already ordered
 *    by score (best screen first regardless of format).
 *  - The DCP that applies to each screen is shown inline on the card itself
 *    (see ScreenDcpSpec inside RankedScreenCard).
 *
 * The variants prop still arrives pre-sorted by tier from rankByVariants(),
 * but we merge and re-sort by score so the #1 slot is always the globally
 * best screen+DCP combination, not just the best within the top-tier variant.
 */
export function VariantRankings({
  variants,
}: {
  variants: RankedVariantGroup[];
}) {
  if (variants.length === 0) return null;

  // Merge all ranked screens from every variant, then re-rank by score.
  // Each entry carries its own dcp reference already (set by toRankedScreen).
  const merged = variants
    .flatMap((v) => v.rankings)
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) > 5) return scoreDiff;
      // Tiebreak: verified DCP wins
      const aV = a.dcp?.verified ? 1 : 0;
      const bV = b.dcp?.verified ? 1 : 0;
      if (aV !== bV) return bV - aV;
      return scoreDiff;
    })
    // De-dupe: a screen might appear in multiple variant groups (e.g. it can
    // play both the standard and Atmos builds). Keep only its highest-scored
    // appearance so each physical screen appears at most once.
    .filter((r, _, arr) => {
      const first = arr.find((x) => x.screen.id === r.screen.id);
      return first === r;
    })
    // Re-assign rank numbers after de-dupe + re-sort
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return (
    <div className="space-y-5">
      {merged.map((r, i) => (
        <Reveal key={`${r.screen.id}-${r.dcp?.id ?? "nodcp"}`} delay={i * 0.04}>
          <RankedScreenCard ranked={r} />
        </Reveal>
      ))}
    </div>
  );
}
