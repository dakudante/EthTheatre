"use client";

import { useMemo, useState } from "react";
import type { Showtime } from "@/lib/types";
import { formatShowtime } from "@/lib/utils";
import { cn } from "@/lib/utils";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

export function ShowtimeRow({ showtimes }: { showtimes: Showtime[] }) {
  const days = useMemo(() => {
    const map = new Map<string, Showtime[]>();
    for (const s of [...showtimes].sort(
      (a, b) => +new Date(a.time) - +new Date(b.time),
    )) {
      const label = dayLabel(s.time);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(s);
    }
    return Array.from(map.entries());
  }, [showtimes]);

  const [active, setActive] = useState(0);
  if (days.length === 0) return null;
  const [, slots] = days[Math.min(active, days.length - 1)];

  return (
    <div>
      <div className="mb-2 flex gap-1.5">
        {days.map(([label], i) => (
          <button
            key={label}
            onClick={() => setActive(i)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              i === active
                ? "bg-white/15 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {slots.map((s) => (
          <a
            key={s.id}
            href={s.booking_url || "#"}
            className="group inline-flex flex-col items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-center transition-colors hover:border-primary/50 hover:bg-primary/10"
          >
            <span className="text-sm font-semibold tabular-nums">
              {formatShowtime(s.time)}
            </span>
            <span className="text-[10px] text-muted-foreground group-hover:text-primary/80">
              {s.format} · {s.language.replace(" (Subtitled)", " Sub")}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
