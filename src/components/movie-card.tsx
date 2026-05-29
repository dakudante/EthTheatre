import Link from "next/link";
import { CalendarDays, Clock } from "lucide-react";
import type { Movie } from "@/lib/types";
import { Poster } from "@/components/poster";
import { FormatBadge } from "@/components/format-badge";
import { formatRuntime } from "@/lib/utils";

export function MovieCard({
  movie,
  priority = false,
}: {
  movie: Movie;
  priority?: boolean;
}) {
  return (
    <Link href={`/movies/${movie.id}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10 transition-all duration-300 group-hover:ring-white/25 group-hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
        <Poster
          src={movie.poster}
          title={movie.title}
          subtitle={movie.genre.slice(0, 2).join(" · ")}
          rounded="rounded-none"
          priority={priority}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-3 pt-10">
          <div className="flex flex-wrap gap-1">
            {movie.format.slice(0, 2).map((f) => (
              <FormatBadge key={f} value={f} />
            ))}
          </div>
        </div>
        {movie.is_now_playing && (
          <span className="absolute right-2 top-2 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-950">
            Now Playing
          </span>
        )}
      </div>
      <div className="mt-3 px-0.5">
        <h3 className="line-clamp-1 font-display font-semibold leading-tight transition-colors group-hover:text-primary">
          {movie.title}
        </h3>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {formatRuntime(movie.duration)}
          </span>
          {movie.release_date && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" />
              {new Date(movie.release_date).getFullYear()}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
