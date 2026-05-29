import { NextResponse, type NextRequest } from "next/server";
import { RecommendationQuerySchema } from "@/lib/ranking";
import { getMovie, getMovieRankings } from "@/lib/data";
import type { RankedScreen } from "@/lib/types";

// Depends on the request query string, so never statically cached.
export const dynamic = "force-dynamic";

/**
 * GET /api/recommendations/:movieId?city=&format=
 *
 * Returns DCP-ranked screens for a movie. Path + query params are validated
 * with Zod before the ranking engine / data layer is touched.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { movieId: string } },
) {
  const parsed = RecommendationQuerySchema.safeParse({
    movieId: params.movieId,
    city: request.nextUrl.searchParams.get("city") ?? undefined,
    format: request.nextUrl.searchParams.get("format") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join(".") || "(root)",
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const { movieId, city, format } = parsed.data;

  const movie = await getMovie(movieId);
  if (!movie) {
    return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  }

  let rankings = await getMovieRankings(movieId);

  if (city) {
    const c = city.toLowerCase();
    rankings = rankings.filter((r) => r.theatre.city.toLowerCase().includes(c));
  }

  if (format) {
    const f = format.toLowerCase();
    rankings = rankings.filter(
      (r) =>
        r.screen.screen_format.toLowerCase().includes(f) ||
        (r.screen.three_d_system ?? "").toLowerCase().includes(f) ||
        (r.dcp?.format ?? []).some((x) => x.toLowerCase().includes(f)),
    );
  }

  // Re-number ranks sequentially after filtering so positions stay 1..N.
  const recommendations = rankings.map((r, i) => serialize(r, i + 1));

  return NextResponse.json({
    movie: { id: movie.id, title: movie.title },
    filters: { city: city ?? null, format: format ?? null },
    count: recommendations.length,
    recommendations,
  });
}

function serialize(r: RankedScreen, rank: number) {
  return {
    rank,
    score: r.score,
    reason: r.reason,
    screen: {
      id: r.screen.id,
      name: r.screen.name,
      screen_format: r.screen.screen_format,
      projection_system: r.screen.projection_system,
      sound_system: r.screen.sound_system,
      screen_spec: r.screen.screen_spec,
      three_d_system: r.screen.three_d_system,
      user_rating: r.screen.user_rating,
      review_count: r.screen.review_count,
    },
    theatre: {
      id: r.theatre.id,
      name: r.theatre.name,
      city: r.theatre.city,
      location: r.theatre.location,
    },
    dcp: r.dcp
      ? {
          resolution: r.dcp.resolution,
          format: r.dcp.format,
          aspect_ratio_container: r.dcp.aspect_ratio_container,
          audio_mix: r.dcp.audio_mix,
          verified: r.dcp.verified,
          source: r.dcp.source,
        }
      : null,
    showtimes: r.showtimes.map((s) => ({
      time: s.time,
      language: s.language,
      format: s.format,
      booking_url: s.booking_url,
    })),
  };
}
