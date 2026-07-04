import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArmchairIcon,
  BadgeCheck,
  Box,
  MapPin,
  Projector,
  Ruler,
  Speaker,
  Star,
} from "lucide-react";
import { getScreen, getScreenProgramme } from "@/lib/data";
import { FormatBadge } from "@/components/format-badge";
import { SpecValue } from "@/components/spec-value";
import { Poster } from "@/components/poster";
import { ShowtimeRow } from "@/components/showtime-row";
import { Reveal } from "@/components/reveal";
import { accentFor } from "@/lib/format-config";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const screen = await getScreen(params.id);
  if (!screen) return { title: "Screen not found" };
  return {
    title: `${screen.name} · ${screen.theatre.name}`,
    description: `${screen.screen_format} · ${screen.projection_system} · ${screen.sound_system}`,
  };
}

export default async function ScreenPage({
  params,
}: {
  params: { id: string };
}) {
  const screen = await getScreen(params.id);
  if (!screen) notFound();
  const programme = await getScreenProgramme(screen.id);
  const accent = accentFor(screen.screen_format);

  const specs = [
    { icon: Projector, label: "Projection system", value: screen.projection_system },
    { icon: Speaker, label: "Sound system", value: screen.sound_system },
    ...(screen.projector_brand
      ? [
          {
            icon: Projector,
            label: "Projector",
            value: `${screen.projector_brand}${
              screen.projector_model ? ` ${screen.projector_model}` : ""
            }`,
          },
        ]
      : []),
    ...(screen.screen_brand
      ? [
          {
            icon: Ruler,
            label: "Screen brand",
            value: `${screen.screen_brand}${
              screen.screen_dimensions ? ` (${screen.screen_dimensions})` : ""
            }`,
          },
        ]
      : []),
    ...(screen.screen_dimensions && !screen.screen_brand
      ? [{ icon: Ruler, label: "Screen size", value: screen.screen_dimensions }]
      : []),
    ...(screen.screen_spec
      ? [{ icon: Ruler, label: "Screen", value: screen.screen_spec }]
      : []),
    ...(screen.three_d_system
      ? [{ icon: Box, label: "3D system", value: screen.three_d_system }]
      : []),
  ];

  return (
    <div className="container py-10">
      <div className={cn("rounded-3xl glass p-6 sm:p-8", accent.ring)}>
        <Link
          href={`/theatres/${screen.theatre.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <MapPin className="size-4" />
          {screen.theatre.name} · {screen.theatre.city}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {screen.name}
          </h1>
          <FormatBadge value={screen.screen_format} glow />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-amber-300">
            <Star className="size-4 fill-amber-400 text-amber-400" />
            <span className="font-medium">{(screen.user_rating ?? 0).toFixed(1)}</span>
            <span className="text-muted-foreground">
              · {screen.review_count.toLocaleString()} reviews
            </span>
          </span>
          {screen.number_of_seats && (
            <span className="inline-flex items-center gap-1.5">
              <ArmchairIcon className="size-4" /> {screen.number_of_seats} seats
            </span>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {specs.map((s) => (
            <div
              key={s.label}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 text-primary">
                <s.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </p>
                <p className="mt-0.5 font-medium">
                  <SpecValue value={s.value} />
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Programme */}
      <h2 className="mb-5 mt-10 font-display text-2xl font-bold tracking-tight">
        What&apos;s playing here
      </h2>
      {programme.length === 0 ? (
        <p className="rounded-2xl glass p-6 text-muted-foreground">
          No scheduled titles for this screen right now.
        </p>
      ) : (
        <div className="space-y-5">
          {programme.map(({ movie, dcp, showtimes }, i) => (
            <Reveal key={movie.id} delay={i * 0.05}>
              <div className="rounded-2xl glass p-5">
                <div className="flex gap-4">
                  <Link href={`/movies/${movie.id}`} className="w-20 shrink-0 sm:w-24">
                    <Poster src={movie.poster} title={movie.title} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/movies/${movie.id}`}
                        className="font-display text-lg font-semibold transition-colors hover:text-primary"
                      >
                        {movie.title}
                      </Link>
                      {dcp?.verified && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">
                          <BadgeCheck className="size-3" /> Verified DCP
                        </span>
                      )}
                    </div>
                    {dcp && (
                      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                        {[dcp.resolution, dcp.aspect_ratio_container, dcp.audio_mix].map(
                          (v) => (
                            <span
                              key={v}
                              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-foreground/80"
                            >
                              <SpecValue value={v} />
                            </span>
                          ),
                        )}
                      </div>
                    )}
                    <div className="mt-4">
                      <ShowtimeRow showtimes={showtimes} />
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
