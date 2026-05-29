import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Check, ExternalLink, MapPin, Monitor } from "lucide-react";
import { getScreensForTheatre, getTheatre } from "@/lib/data";
import { ScreenCard } from "@/components/screen-card";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const theatre = await getTheatre(params.id);
  if (!theatre) return { title: "Theatre not found" };
  return { title: theatre.name, description: theatre.description ?? undefined };
}

export default async function TheatrePage({
  params,
}: {
  params: { id: string };
}) {
  const theatre = await getTheatre(params.id);
  if (!theatre) notFound();
  const screens = await getScreensForTheatre(theatre.id);

  return (
    <div className="container py-10">
      <div className="rounded-3xl glass p-6 sm:p-8">
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          {theatre.location}, {theatre.city}
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {theatre.name}
        </h1>
        {theatre.description && (
          <p className="mt-3 max-w-3xl leading-relaxed text-foreground/90">
            {theatre.description}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm">
            <Monitor className="size-4" />
            {screens.length} {screens.length === 1 ? "screen" : "screens"}
          </span>
          {theatre.website && (
            <Button asChild variant="outline" size="sm">
              <Link href={theatre.website} target="_blank" rel="noreferrer">
                Visit website <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          )}
        </div>

        {theatre.amenities.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {theatre.amenities.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-foreground/80"
              >
                <Check className="size-3 text-emerald-400" />
                {a}
              </span>
            ))}
          </div>
        )}
      </div>

      <h2 className="mb-5 mt-10 font-display text-2xl font-bold tracking-tight">
        Screens
      </h2>
      <div className="grid gap-5 md:grid-cols-2">
        {screens.map((s, i) => (
          <Reveal key={s.id} delay={i * 0.04}>
            <ScreenCard screen={s} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
