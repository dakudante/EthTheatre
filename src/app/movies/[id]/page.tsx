import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, Clock, Film, Info, Trophy } from "lucide-react";
import { getMovie, getMovieMasterDcp, getMovieRankedVariants } from "@/lib/data";
import { Poster, Backdrop } from "@/components/poster";
import { FormatBadge } from "@/components/format-badge";
import { MasterDcpSpec } from "@/components/master-dcp-spec";
import { VariantRankings } from "@/components/variant-rankings";
import { Reveal } from "@/components/reveal";
import { formatRuntime, formatDate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const movie = await getMovie(params.id);
  if (!movie) return { title: "Movie not found" };
  return {
    title: movie.title,
    description: movie.synopsis ?? `Find the best screen for ${movie.title}.`,
  };
}

export default async function MoviePage({
  params,
}: {
  params: { id: string };
}) {
  const movie = await getMovie(params.id);
  if (!movie) notFound();

  const [rankedVariants, masterDcp] = await Promise.all([
    getMovieRankedVariants(movie.id),
    getMovieMasterDcp(movie.id),
  ]);
  const variants = rankedVariants?.variants ?? [];
  const best = variants[0]?.rankings[0];

  return (
    <div className="pb-12">
      {/* Hero */}
      <section className="relative">
        <div className="relative h-[340px] w-full sm:h-[420px]">
          <Backdrop src={movie.backdrop} title={movie.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />
        </div>

        <div className="container relative -mt-48 sm:-mt-56">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="w-36 shrink-0 sm:w-48">
              <Poster
                src={movie.poster}
                title={movie.title}
                className="shadow-2xl ring-1 ring-white/15"
                priority
              />
            </div>
            <div className="pb-1">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {movie.format.map((f) => (
                  <FormatBadge key={f} value={f} glow />
                ))}
              </div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                {movie.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" /> {formatRuntime(movie.duration)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" />{" "}
                  {formatDate(movie.release_date)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Film className="size-4" /> {movie.genre.join(", ")}
                </span>
              </div>
            </div>
          </div>

          {movie.synopsis && (
            <p className="mt-6 max-w-3xl leading-relaxed text-foreground/90">
              {movie.synopsis}
            </p>
          )}
        </div>
      </section>

      {/* Master DCP spec — only when a single variant exists. Multi-variant
          titles list every build in the "Available DCP formats" chips below
          (one master spec was the root-cause UI confusion). */}
      {variants.length <= 1 && (
        <section className="container mt-10">
          <Reveal>
            <MasterDcpSpec movie={movie} dcp={variants[0]?.dcp ?? masterDcp} />
          </Reveal>
        </section>
      )}

      {/* Rankings */}
      <section className="container mt-12">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <Trophy className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">
              Best screens for {movie.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              Ranked by DCP specification first, then screen hardware.
            </p>
          </div>
        </div>

        {variants.length === 0 ? (
          <div className="rounded-2xl glass p-8 text-center text-muted-foreground">
            <Info className="mx-auto mb-3 size-6" />
            No screens currently have a confirmed package for this title.
          </div>
        ) : (
          <>
            {best && (
              <Reveal className="mb-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {best.theatre.city}
                  </span>
                  ’s {best.screen.name} tops the {variants[0].label} list with a
                  score of{" "}
                  <span className="font-semibold text-primary">
                    {best.score}
                  </span>
                  .
                </div>
              </Reveal>
            )}
            <VariantRankings variants={variants} />
          </>
        )}
      </section>
    </div>
  );
}
