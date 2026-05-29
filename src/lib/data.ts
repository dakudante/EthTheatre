import "server-only";

import { createClient, isSupabaseConfigured } from "./supabase/server";
import { rankScreens } from "./ranking";
import * as demo from "./sample-data";
import type {
  Dcp,
  Movie,
  RankedScreen,
  Screen,
  ScreenWithTheatre,
  Showtime,
  TechTerm,
  Theatre,
} from "./types";

/**
 * Single data-access surface for Server Components.
 * Uses Supabase when credentials are present; otherwise falls back to the
 * bundled demo dataset so the app is fully explorable out of the box.
 */

export const DEMO_MODE = !isSupabaseConfigured();

// ----------------------------- Showtimes -----------------------------------
// Deterministic pseudo-random so a given screen+movie keeps stable times.
function seeded(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

const SLOT_TIMES = [10, 12, 13, 15, 16, 18, 19, 20, 21, 22];

function generateShowtimes(screen: Screen, movie: Movie): Showtime[] {
  const out: Showtime[] = [];
  const base = seeded(screen.id + movie.id);
  const slotCount = 3 + Math.floor(base * 3); // 3..5 per day
  const langs = ["English", "Hindi", "English (Subtitled)"];
  const fmt =
    screen.three_d_system && seeded(movie.id + "3d") > 0.6
      ? "3D"
      : (screen.screen_format ?? "").includes("IMAX")
        ? "IMAX 2D"
        : "2D";

  for (let day = 0; day < 3; day++) {
    const picked = [...SLOT_TIMES]
      .sort((a, b) => seeded(`${a}${screen.id}`) - seeded(`${b}${screen.id}`))
      .slice(0, slotCount)
      .sort((a, b) => a - b);

    for (const hour of picked) {
      const d = new Date();
      d.setDate(d.getDate() + day);
      d.setHours(hour, seeded(`${hour}${screen.id}`) > 0.5 ? 30 : 15, 0, 0);
      if (d.getTime() < Date.now()) continue; // skip past slots today
      out.push({
        id: `${screen.id}-${movie.id}-${day}-${hour}`,
        screen_id: screen.id,
        movie_id: movie.id,
        time: d.toISOString(),
        language: langs[Math.floor(seeded(`${hour}${day}lang`) * langs.length)],
        format: fmt,
        booking_url: "#",
        created_at: new Date().toISOString(),
      });
    }
  }
  return out;
}

// ----------------------------- Movies --------------------------------------
export async function getNowPlaying(): Promise<Movie[]> {
  if (DEMO_MODE) return demo.movies.filter((m) => m.is_now_playing);
  const supabase = createClient();
  const { data } = await supabase
    .from("movies")
    .select("*")
    .eq("is_now_playing", true)
    .order("release_date", { ascending: false });
  return (data as Movie[]) ?? [];
}

export async function getAllMovies(): Promise<Movie[]> {
  if (DEMO_MODE) return demo.movies;
  const supabase = createClient();
  const { data } = await supabase
    .from("movies")
    .select("*")
    .order("release_date", { ascending: false });
  return (data as Movie[]) ?? [];
}

export async function getMovie(id: string): Promise<Movie | null> {
  if (DEMO_MODE) return demo.movies.find((m) => m.id === id) ?? null;
  const supabase = createClient();
  const { data } = await supabase.from("movies").select("*").eq("id", id).single();
  return (data as Movie) ?? null;
}

// --------------------------- Rankings ---------------------------------------
async function getDcpsForMovie(movieId: string): Promise<Dcp[]> {
  if (DEMO_MODE) return demo.dcps.filter((d) => d.movie_id === movieId);
  const supabase = createClient();
  const { data } = await supabase.from("dcps").select("*").eq("movie_id", movieId);
  return (data as Dcp[]) ?? [];
}

async function getScreensByIds(ids: string[]): Promise<Screen[]> {
  if (!ids.length) return [];
  if (DEMO_MODE) return demo.screens.filter((s) => ids.includes(s.id));
  const supabase = createClient();
  const { data } = await supabase.from("screens").select("*").in("id", ids);
  return (data as Screen[]) ?? [];
}

async function getTheatresByIds(ids: string[]): Promise<Map<string, Theatre>> {
  const map = new Map<string, Theatre>();
  if (!ids.length) return map;
  const list = DEMO_MODE
    ? demo.theatres.filter((t) => ids.includes(t.id))
    : (((await createClient().from("theatres").select("*").in("id", ids)).data as Theatre[]) ?? []);
  list.forEach((t) => map.set(t.id, t));
  return map;
}

export async function getMovieRankings(movieId: string): Promise<RankedScreen[]> {
  const movie = await getMovie(movieId);
  if (!movie) return [];

  const dcps = await getDcpsForMovie(movieId);
  const screenIds = Array.from(new Set(dcps.map((d) => d.screen_id)));
  const screens = await getScreensByIds(screenIds);
  const theatres = await getTheatresByIds(
    Array.from(new Set(screens.map((s) => s.theatre_id))),
  );

  const dcpByScreen = new Map(dcps.map((d) => [d.screen_id, d]));
  const candidates = screens.map((screen) => ({
    screen,
    dcp: dcpByScreen.get(screen.id) ?? null,
  }));

  const ranked = rankScreens(movie, candidates);

  return ranked
    .map((r) => {
      const theatre = theatres.get(r.screen.theatre_id);
      if (!theatre) return null;
      return {
        rank: r.rank,
        score: r.score,
        reason: r.reason,
        screen: r.screen,
        theatre,
        dcp: r.dcp,
        showtimes: generateShowtimes(r.screen, movie),
      } satisfies RankedScreen;
    })
    .filter((x): x is RankedScreen => x !== null);
}

// --------------------------- Theatres ---------------------------------------
export async function getTheatres(): Promise<Theatre[]> {
  if (DEMO_MODE) return demo.theatres;
  const supabase = createClient();
  const { data } = await supabase.from("theatres").select("*").order("name");
  return (data as Theatre[]) ?? [];
}

export async function getTheatre(id: string): Promise<Theatre | null> {
  if (DEMO_MODE) return demo.theatres.find((t) => t.id === id) ?? null;
  const supabase = createClient();
  const { data } = await supabase.from("theatres").select("*").eq("id", id).single();
  return (data as Theatre) ?? null;
}

export async function getScreensForTheatre(theatreId: string): Promise<Screen[]> {
  if (DEMO_MODE)
    return demo.screens.filter((s) => s.theatre_id === theatreId);
  const supabase = createClient();
  const { data } = await supabase
    .from("screens")
    .select("*")
    .eq("theatre_id", theatreId)
    .order("user_rating", { ascending: false });
  return (data as Screen[]) ?? [];
}

// --------------------------- Screens ----------------------------------------
export async function getScreen(id: string): Promise<ScreenWithTheatre | null> {
  let screen: Screen | null;
  if (DEMO_MODE) {
    screen = demo.screens.find((s) => s.id === id) ?? null;
  } else {
    screen = ((await createClient().from("screens").select("*").eq("id", id).single()).data as Screen) ?? null;
  }
  if (!screen) return null;
  const theatre = await getTheatre(screen.theatre_id);
  if (!theatre) return null;
  return { ...screen, theatre };
}

export interface ScreenProgramme {
  movie: Movie;
  dcp: Dcp | null;
  showtimes: Showtime[];
}

export async function getScreenProgramme(screenId: string): Promise<ScreenProgramme[]> {
  let dcps: Dcp[];
  if (DEMO_MODE) {
    dcps = demo.dcps.filter((d) => d.screen_id === screenId);
  } else {
    dcps = (((await createClient().from("dcps").select("*").eq("screen_id", screenId)).data) as Dcp[]) ?? [];
  }
  const [screen] = await getScreensByIds([screenId]);
  if (!screen) return [];
  const out: ScreenProgramme[] = [];
  for (const d of dcps) {
    const movie = await getMovie(d.movie_id);
    if (!movie) continue;
    out.push({ movie, dcp: d, showtimes: generateShowtimes(screen, movie) });
  }
  return out;
}

// --------------------------- Tech terms -------------------------------------
export async function getTechTerms(): Promise<TechTerm[]> {
  if (DEMO_MODE) return demo.techTerms;
  const supabase = createClient();
  const { data } = await supabase.from("tech_terms").select("*").order("title");
  return (data as TechTerm[]) ?? [];
}

export async function getPopularTechTerms(): Promise<TechTerm[]> {
  const all = await getTechTerms();
  return all.filter((t) => t.is_popular);
}

export async function getTechTerm(slug: string): Promise<TechTerm | null> {
  if (DEMO_MODE) return demo.techTerms.find((t) => t.slug === slug) ?? null;
  const supabase = createClient();
  const { data } = await supabase
    .from("tech_terms")
    .select("*")
    .eq("slug", slug)
    .single();
  return (data as TechTerm) ?? null;
}

// --------------------------- Search -----------------------------------------
export interface SearchResults {
  movies: Movie[];
  theatres: Theatre[];
  terms: TechTerm[];
}

export async function search(query: string): Promise<SearchResults> {
  const q = query.trim().toLowerCase();
  if (!q) return { movies: [], theatres: [], terms: [] };
  const [movies, theatres, terms] = await Promise.all([
    getAllMovies(),
    getTheatres(),
    getTechTerms(),
  ]);
  return {
    movies: movies.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.genre.some((g) => g.toLowerCase().includes(q)),
    ),
    theatres: theatres.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.city.toLowerCase().includes(q),
    ),
    terms: terms.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.short_desc.toLowerCase().includes(q),
    ),
  };
}
