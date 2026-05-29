import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Gauge,
  MonitorPlay,
  Sparkles,
} from "lucide-react";
import {
  getNowPlaying,
  getPopularTechTerms,
  getTheatres,
  getScreensForTheatre,
  DEMO_MODE,
} from "@/lib/data";
import { Button } from "@/components/ui/button";
import { MovieCard } from "@/components/movie-card";
import { TheatreCard } from "@/components/theatre-card";
import { TechTermCard } from "@/components/tech-term-card";
import { SectionHeader } from "@/components/section-header";
import { Reveal } from "@/components/reveal";

export default async function HomePage() {
  const [movies, terms, theatres] = await Promise.all([
    getNowPlaying(),
    getPopularTechTerms(),
    getTheatres(),
  ]);

  const featuredTheatres = await Promise.all(
    theatres.slice(0, 4).map(async (t) => ({
      theatre: t,
      screens: await getScreensForTheatre(t.id),
    })),
  );

  return (
    <div className="pb-10">
      {DEMO_MODE && (
        <div className="border-b border-amber-400/20 bg-amber-400/[0.06]">
          <div className="container py-2 text-center text-xs text-amber-200/90">
            Running in <strong>demo mode</strong> with bundled sample data — add
            Supabase + TMDB keys in <code>.env.local</code> to go live.
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container relative grid gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              DCP-first cinema rankings
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Find the <span className="text-primary text-glow">best screen</span>{" "}
              for any movie.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              ScreenRank ranks every auditorium by the actual{" "}
              <span className="text-foreground">DCP it plays</span> — resolution,
              aspect ratio, audio mix — then by the room&apos;s hardware. No more
              guessing which &ldquo;premium&rdquo; is actually premium.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/movies">
                  Browse now playing <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/learn">Learn the tech</Link>
              </Button>
            </div>
          </div>

          {/* How it works panel */}
          <Reveal className="flex items-center">
            <div className="w-full rounded-3xl glass p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
                How the ranking works
              </p>
              <ol className="space-y-4">
                {[
                  {
                    icon: FileText,
                    title: "DCP specification first",
                    desc: "Resolution, format flags, aspect-ratio container and audio mix — weighted ~60%.",
                  },
                  {
                    icon: MonitorPlay,
                    title: "Screen hardware second",
                    desc: "Projection light engine, sound system and physical screen class — ~35%.",
                  },
                  {
                    icon: Gauge,
                    title: "A transparent score",
                    desc: "Each screen gets a 0–100 score and a plain-English reason it ranked there.",
                  },
                ].map((step, i) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                      <step.icon className="size-5" />
                    </span>
                    <div>
                      <p className="font-medium">
                        {i + 1}. {step.title}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {step.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Now playing */}
      <section className="container mt-8">
        <SectionHeader
          eyebrow="In cinemas"
          title="Now playing"
          description="Pick a title to see which screen wins it — and exactly why."
          href="/movies"
        />
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
          {movies.map((m, i) => (
            <MovieCard key={m.id} movie={m} priority={i < 4} />
          ))}
        </div>
      </section>

      {/* Featured theatres */}
      <section className="container mt-20">
        <SectionHeader
          eyebrow="Premium venues"
          title="Featured theatres"
          description="The large-format and premium houses we track most closely."
          href="/theatres"
        />
        <div className="grid gap-5 md:grid-cols-2">
          {featuredTheatres.map(({ theatre, screens }) => (
            <TheatreCard key={theatre.id} theatre={theatre} screens={screens} />
          ))}
        </div>
      </section>

      {/* Learn the tech */}
      <section className="container mt-20">
        <SectionHeader
          eyebrow="Decoded"
          title="Learn the tech"
          description="Every term on ScreenRank links to a simple, visual explainer."
          href="/learn"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {terms.map((t) => (
            <TechTermCard key={t.id} term={t} />
          ))}
        </div>
      </section>
    </div>
  );
}
