import Link from "next/link";
import { MapPin, Monitor } from "lucide-react";
import type { Screen, Theatre } from "@/lib/types";
import { FormatBadge } from "@/components/format-badge";

export function TheatreCard({
  theatre,
  screens = [],
}: {
  theatre: Theatre;
  screens?: Screen[];
}) {
  // Show the most prestigious formats this venue offers.
  const formats = Array.from(new Set(screens.map((s) => s.screen_format))).slice(
    0,
    4,
  );

  return (
    <Link
      href={`/theatres/${theatre.id}`}
      className="group block rounded-2xl glass glass-hover p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold leading-tight transition-colors group-hover:text-primary">
            {theatre.name}
          </h3>
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" />
            {theatre.location}, {theatre.city}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted-foreground">
          <Monitor className="size-3.5" />
          {screens.length} {screens.length === 1 ? "screen" : "screens"}
        </span>
      </div>

      {theatre.description && (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground/90">
          {theatre.description}
        </p>
      )}

      {formats.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {formats.map((f) => (
            <FormatBadge key={f} value={f} />
          ))}
        </div>
      )}
    </Link>
  );
}
