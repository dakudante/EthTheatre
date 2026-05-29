import "server-only";

/**
 * Minimal TMDB client (v4 read-access token).
 * Used to enrich the `movies` table with posters, backdrops and synopses.
 * Returns rows shaped for direct upsert into the `movies` table.
 */

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

function token() {
  const t = process.env.TMDB_API_KEY;
  if (!t) throw new Error("TMDB_API_KEY is not configured.");
  return t;
}

async function tmdb<T>(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/json",
    },
    // Cache TMDB responses for an hour.
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${res.statusText}`);
  return (await res.json()) as T;
}

export interface TmdbMovieRow {
  tmdb_id: number;
  title: string;
  poster: string | null;
  backdrop: string | null;
  synopsis: string | null;
  release_date: string | null;
  duration: number | null;
  genre: string[];
}

interface TmdbListItem {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  genre_ids: number[];
}

interface TmdbDetail extends TmdbListItem {
  runtime: number | null;
  genres: { id: number; name: string }[];
}

const img = (path: string | null, size: string) =>
  path ? `${IMG}/${size}${path}` : null;

export async function getNowPlayingFromTmdb(): Promise<TmdbMovieRow[]> {
  const data = await tmdb<{ results: TmdbListItem[] }>("/movie/now_playing", {
    language: "en-US",
    page: "1",
  });
  // Fetch details (for runtime + genre names) for the first dozen.
  const rows = await Promise.all(
    data.results.slice(0, 12).map((m) => getMovieFromTmdb(m.id)),
  );
  return rows.filter((r): r is TmdbMovieRow => r !== null);
}

export async function getMovieFromTmdb(
  id: number,
): Promise<TmdbMovieRow | null> {
  try {
    const d = await tmdb<TmdbDetail>(`/movie/${id}`, { language: "en-US" });
    return {
      tmdb_id: d.id,
      title: d.title,
      poster: img(d.poster_path, "w500"),
      backdrop: img(d.backdrop_path, "w1280"),
      synopsis: d.overview || null,
      release_date: d.release_date || null,
      duration: d.runtime ?? null,
      genre: d.genres?.map((g) => g.name) ?? [],
    };
  } catch {
    return null;
  }
}
