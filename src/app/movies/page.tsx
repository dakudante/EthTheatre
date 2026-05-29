import type { Metadata } from "next";
import { getAllMovies } from "@/lib/data";
import { MovieCard } from "@/components/movie-card";
import { SectionHeader } from "@/components/section-header";

export const metadata: Metadata = {
  title: "Movies",
  description: "Browse movies now playing and find the best screen for each.",
};

export default async function MoviesPage() {
  const movies = await getAllMovies();

  return (
    <div className="container py-10">
      <SectionHeader
        eyebrow="In cinemas"
        title="Now playing"
        description="Choose a title to see its DCP-ranked screens across every tracked theatre."
      />
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {movies.map((m, i) => (
          <MovieCard key={m.id} movie={m} priority={i < 6} />
        ))}
      </div>
    </div>
  );
}
