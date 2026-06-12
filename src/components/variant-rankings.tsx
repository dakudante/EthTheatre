"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import type { RankedVariantGroup } from "@/lib/data";
import { RankedScreenCard } from "@/components/ranked-screen-card";
import { FormatBadge } from "@/components/format-badge";
import { Reveal } from "@/components/reveal";
import { cn } from "@/lib/utils";

/**
 * BMS-style per-DCP-variant ranked sections: an always-visible chip row of
 * every available DCP build, a tab strip (best variant first), and the ranked
 * screen list for the selected variant.
 */
export function VariantRankings({ variants }: { variants: RankedVariantGroup[] }) {
  const [active, setActive] = useState(0);
  if (variants.length === 0) return null;
  const current = variants[Math.min(active, variants.length - 1)];

  return (
    <div>
      {/* Available DCP formats — informational, always visible */}
      <div className="mb-5 rounded-2xl glass p-4">
        <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Layers className="size-3.5" />
          Available DCP formats
        </p>
        <div className="flex flex-wrap gap-1.5">
          {variants.map((v) => (
            <span
              key={v.dcp.id}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-foreground/85"
            >
              {v.dcp.resolution}
              <span className="text-muted-foreground">·</span>
              {v.dcp.format.length ? v.dcp.format.join(", ") : "2D"}
              <span className="text-muted-foreground">·</span>
              {v.dcp.audio_mix}
            </span>
          ))}
        </div>
      </div>

      {/* Variant tabs (best tier first) */}
      {variants.length > 1 && (
        <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
          {variants.map((v, i) => (
            <button
              key={v.dcp.id}
              onClick={() => setActive(i)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                i === active
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/25 hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* Selected variant header + ranked list */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FormatBadge value={current.label.split(" · ")[0]} />
        <span className="text-sm text-muted-foreground">
          {current.rankings.length}{" "}
          {current.rankings.length === 1 ? "screen" : "screens"} can present
          this build
        </span>
      </div>
      <div className="space-y-5">
        {current.rankings.map((r, i) => (
          <Reveal key={`${current.dcp.id}-${r.screen.id}`} delay={i * 0.04}>
            <RankedScreenCard ranked={r} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
