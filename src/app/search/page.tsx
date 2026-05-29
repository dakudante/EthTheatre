import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { search } from "@/lib/data";
import { MovieCard } from "@/components/movie-card";
import { TheatreCard } from "@/components/theatre-card";
import { TechTermCard } from "@/components/tech-term-card";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q ?? "";
  const { movies, theatres, terms } = await search(q);
  const total = movies.length + theatres.length + terms.length;

  return (
    <div className="container py-10">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {q ? (
          <>
            Results for <span className="text-primary">“{q}”</span>
          </>
        ) : (
          "Search"
        )}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {q ? `${total} ${total === 1 ? "result" : "results"}` : "Type in the search bar above to begin."}
      </p>

      {q && total === 0 && (
        <div className="mt-10 rounded-2xl glass p-10 text-center text-muted-foreground">
          <SearchX className="mx-auto mb-3 size-7" />
          Nothing matched “{q}”. Try a movie title, a city, or a format like
          “IMAX”.
        </div>
      )}

      {movies.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-bold">Movies</h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {movies.map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </div>
        </section>
      )}

      {theatres.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-bold">Theatres</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {theatres.map((t) => (
              <TheatreCard key={t.id} theatre={t} />
            ))}
          </div>
        </section>
      )}

      {terms.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-bold">Tech terms</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {terms.map((t) => (
              <TechTermCard key={t.id} term={t} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 text-sm text-muted-foreground">
        Looking for something else?{" "}
        <Link href="/movies" className="text-primary hover:underline">
          Browse all movies
        </Link>
        .
      </div>
    </div>
  );
}
