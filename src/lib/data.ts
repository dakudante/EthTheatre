import "server-only";

import { isSupabaseConfigured } from "./supabase/server";
import { createReadClient } from "./supabase/admin";
import { rankScreens } from "./ranking";
import * as demo from "./sample-data";
import type {
  Dcp,
  Movie,
  MovieAvailableFormat,
  MovieKeyframe,
  RankedScreen,
  Screen,
  ScreenWithTheatre,
  Showtime,
  TechTerm,
  Theatre,
  TheatreInteriorTemplate,
} from "./types";

/**
 * Single data-access surface for Server Components.
 *
 * Two sources:
 *  - DEMO_MODE (no Supabase env): bundled sample dataset.
 *  - Live Supabase: the project's actual schema, which differs from the app's
 *    internal model, so live rows are mapped to the app types here. Notably the
 *    live DB has integer ids, `movie_name`/`screen_name`, `location` = city,
 *    `address` = street, and NO is_now_playing / dcps / showtimes / tech_terms.
 *    Mappers below bridge that gap; features needing absent tables degrade.
 */

export const DEMO_MODE = !isSupabaseConfigured();

const EPOCH = new Date(0).toISOString();

// ----------------------------- Live row shapes -----------------------------
interface DbMovieRow {
  id: number | string;
  movie_name: string | null;
  runtime: number | null;
  resolution: string | null;
  "aspect_ratio and container_format": string | null;
  audio_mix: string | null;
  formats: string | null;
}
interface DbTheatreRow {
  id: number | string;
  name: string | null;
  address: string | null;
  location: string | null;
  total_screens: number | null;
}
interface DbScreenRow {
  id: number | string;
  theatre_id: number | string;
  screen_name: string | null;
  screen_format: string | null;
  projection_system: string | null;
  sound_system: string | null;
  // NEW FIELDS
  projector_brand: string | null;
  projector_model: string | null;
  screen_brand: string | null;
  screen_dimensions: string | null;
}

function splitFormats(s: string | null): string[] {
  return (s ?? "")
    .split(/[,/|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function mapMovie(r: DbMovieRow): Movie {
  return {
    id: String(r.id),
    tmdb_id: null,
    title: r.movie_name ?? "Untitled",
    poster: null,
    backdrop: null,
    synopsis: null,
    release_date: null,
    duration: r.runtime ?? null,
    genre: [],
    format: splitFormats(r.formats),
    is_now_playing: true, // live schema has no flag — treat catalogue as current
    created_at: EPOCH,
  };
}

function mapTheatre(r: DbTheatreRow): Theatre {
  return {
    id: String(r.id),
    name: r.name ?? "Unnamed theatre",
    location: r.address ?? r.location ?? "",
    city: r.location ?? "", // live `location` column holds the city
    lat: null,
    lng: null,
    images: [],
    amenities: [],
    description: null,
    website: null,
    created_at: EPOCH,
  };
}

function mapScreen(r: DbScreenRow): Screen {
  return {
    id: String(r.id),
    theatre_id: String(r.theatre_id),
    name: r.screen_name ?? "Screen",
    screen_format: r.screen_format ?? "Standard",
    projection_system: r.projection_system ?? "—",
    sound_system: r.sound_system ?? "—",
    screen_spec: null,
    number_of_seats: null,
    three_d_system: null,
    user_rating: 0,
    review_count: 0,
    created_at: EPOCH,
    // NEW FIELDS
    projector_brand: r.projector_brand ?? null,
    projector_model: r.projector_model ?? null,
    screen_brand: r.screen_brand ?? null,
    screen_dimensions: r.screen_dimensions ?? null,
  };
}

// The live `movies` row carries DCP-ish fields; reconstruct a package from it so
// the ranking engine can still rank screens for that title.
function syntheticDcp(r: DbMovieRow, screenId: string): Dcp {
  return {
    id: `dcp-${r.id}-${screenId}`,
    screen_id: screenId,
    movie_id: String(r.id),
    runtime: r.runtime ?? null,
    resolution: r.resolution ?? "2K 2048x1080",
    format: splitFormats(r.formats),
    aspect_ratio_container: r["aspect_ratio and container_format"] ?? "Flat(1.85:1)",
    audio_mix: r.audio_mix ?? "Dolby Surround 5.1",
    verified: false,
    source: "Theatre catalogue",
    created_at: EPOCH,
  };
}

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
  // Live schema has no is_now_playing column — surface the whole catalogue.
  return getAllMovies();
}

export async function getAllMovies(): Promise<Movie[]> {
  if (DEMO_MODE) return demo.movies;
  const supabase = createReadClient();
  const { data, error } = await supabase
    .from("movies")
    .select("*")
    .order("movie_name", { ascending: true });
  if (error) console.error("getAllMovies:", error.message);
  // The live `movies` table stores one row per DCP variant, so the same title
  // can appear several times. Listing grids represent the movie *entity*, so
  // collapse to one card per unique title (the detail page still ranks every
  // screen for it). Keeping the first occurrence is deterministic given the
  // movie_name ordering above.
  return dedupeByTitle(((data as DbMovieRow[]) ?? []).map(mapMovie));
}

function dedupeByTitle(movies: Movie[]): Movie[] {
  const seen = new Set<string>();
  return movies.filter((m) => {
    const key = m.title.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getMovie(id: string): Promise<Movie | null> {
  if (DEMO_MODE) return demo.movies.find((m) => m.id === id) ?? null;
  const row = await fetchMovieRow(id);
  return row ? mapMovie(row) : null;
}

async function fetchMovieRow(id: string): Promise<DbMovieRow | null> {
  const supabase = createReadClient();
  const { data, error } = await supabase
    .from("movies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("fetchMovieRow:", error.message);
  return (data as DbMovieRow) ?? null;
}

// --------------------------- DCPs / Master spec -----------------------------
export async function getDcpsForMovie(movieId: string): Promise<Dcp[]> {
  if (DEMO_MODE) return demo.dcps.filter((d) => d.movie_id === movieId);
  // Live schema has no dcps table; the movie row carries the master spec.
  const row = await fetchMovieRow(movieId);
  return row ? [syntheticDcp(row, "master")] : [];
}

const RES_RANK = (r?: string | null) => {
  const v = (r ?? "").toLowerCase();
  if (v.includes("8k")) return 3;
  if (v.includes("4k")) return 2;
  if (v.includes("2k")) return 1;
  return 0;
};

/**
 * The single "Master DCP Specification" to headline a movie page: the best
 * available verified package (demo), or the spec the movie ships in (live).
 */
export async function getMovieMasterDcp(movieId: string): Promise<Dcp | null> {
  const dcps = await getDcpsForMovie(movieId);
  if (!dcps.length) return null;
  return [...dcps].sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    return RES_RANK(b.resolution) - RES_RANK(a.resolution);
  })[0];
}

async function getScreensByIds(ids: string[]): Promise<Screen[]> {
  if (!ids.length) return [];
  if (DEMO_MODE) return demo.screens.filter((s) => ids.includes(s.id));
  const supabase = createReadClient();
  const { data } = await supabase.from("screens").select("*").in("id", ids);
  return ((data as DbScreenRow[]) ?? []).map(mapScreen);
}

export async function getMovieRankings(movieId: string): Promise<RankedScreen[]> {
  if (DEMO_MODE) return getMovieRankingsDemo(movieId);

  // Live: rank ALL screens for this title using a synthetic DCP built from the
  // movie row (resolution / aspect / audio / format it ships in).
  const row = await fetchMovieRow(movieId);
  if (!row) return [];
  const movie = mapMovie(row);

  const supabase = createReadClient();
  const [{ data: screenRows }, { data: theatreRows }] = await Promise.all([
    supabase.from("screens").select("*"),
    supabase.from("theatres").select("*"),
  ]);

  const screens = ((screenRows as DbScreenRow[]) ?? []).map(mapScreen);
  const theatres = new Map(
    ((theatreRows as DbTheatreRow[]) ?? []).map((t) => [
      String(t.id),
      mapTheatre(t),
    ]),
  );

  const candidates = screens.map((screen) => ({
    screen,
    dcp: syntheticDcp(row, screen.id),
  }));

  return rankScreens(movie, candidates)
    .slice(0, 12)
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

async function getMovieRankingsDemo(movieId: string): Promise<RankedScreen[]> {
  const movie = await getMovie(movieId);
  if (!movie) return [];

  const dcps = await getDcpsForMovie(movieId);
  const screenIds = Array.from(new Set(dcps.map((d) => d.screen_id)));
  const screens = await getScreensByIds(screenIds);
  const theatres = new Map(
    demo.theatres.map((t) => [t.id, t] as const),
  );

  const dcpByScreen = new Map(dcps.map((d) => [d.screen_id, d]));
  const candidates = screens.map((screen) => ({
    screen,
    dcp: dcpByScreen.get(screen.id) ?? null,
  }));

  return rankScreens(movie, candidates)
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
  const supabase = createReadClient();
  const { data, error } = await supabase
    .from("theatres")
    .select("*")
    .order("name", { ascending: true });
  if (error) console.error("getTheatres:", error.message);
  return ((data as DbTheatreRow[]) ?? []).map(mapTheatre);
}

export async function getTheatre(id: string): Promise<Theatre | null> {
  if (DEMO_MODE) return demo.theatres.find((t) => t.id === id) ?? null;
  const supabase = createReadClient();
  const { data, error } = await supabase
    .from("theatres")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("getTheatre:", error.message);
  return data ? mapTheatre(data as DbTheatreRow) : null;
}

export async function getScreensForTheatre(theatreId: string): Promise<Screen[]> {
  if (DEMO_MODE)
    return demo.screens.filter((s) => s.theatre_id === theatreId);
  const supabase = createReadClient();
  const { data, error } = await supabase
    .from("screens")
    .select("*")
    .eq("theatre_id", theatreId)
    .order("screen_name", { ascending: true });
  if (error) console.error("getScreensForTheatre:", error.message);
  return ((data as DbScreenRow[]) ?? []).map(mapScreen);
}

// --------------------------- Screens ----------------------------------------
export async function getScreen(id: string): Promise<ScreenWithTheatre | null> {
  let screen: Screen | null;
  if (DEMO_MODE) {
    screen = demo.screens.find((s) => s.id === id) ?? null;
  } else {
    const { data, error } = await createReadClient()
      .from("screens")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) console.error("getScreen:", error.message);
    screen = data ? mapScreen(data as DbScreenRow) : null;
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

export async function getScreenProgramme(
  screenId: string,
): Promise<ScreenProgramme[]> {
  if (!DEMO_MODE) return []; // no movie↔screen linkage in the live schema
  const dcps = demo.dcps.filter((d) => d.screen_id === screenId);
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
// Static educational content — always served from bundled data (the live DB
// has no tech_terms table).
export async function getTechTerms(): Promise<TechTerm[]> {
  return demo.techTerms;
}

export async function getPopularTechTerms(): Promise<TechTerm[]> {
  return demo.techTerms.filter((t) => t.is_popular);
}

export async function getTechTerm(slug: string): Promise<TechTerm | null> {
  return demo.techTerms.find((t) => t.slug === slug) ?? null;
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
// ── Format Visualizer data ──────────────────────────────────────────────

export async function getMovieKeyframes(movieId: string): Promise<MovieKeyframe[]> {
  if (DEMO_MODE) {
    // Return demo keyframes from sample-data (we'll add these later)
    return demo.keyframes?.filter((k) => k.movie_id === movieId) ?? [];
  }
  const supabase = createReadClient();
  const { data, error } = await supabase
    .from("movie_keyframes")
    .select("*")
    .eq("movie_id", movieId)
    .order("display_order", { ascending: true });
  if (error) console.error("getMovieKeyframes:", error.message);
  return (data as MovieKeyframe[]) ?? [];
}

export async function getTheatreInteriorTemplates(): Promise<TheatreInteriorTemplate[]> {
  if (DEMO_MODE) {
    return demo.interiorTemplates ?? [];
  }
  const supabase = createReadClient();
  const { data, error } = await supabase
    .from("theatre_interior_templates")
    .select("*")
    .order("name", { ascending: true });
  if (error) console.error("getTheatreInteriorTemplates:", error.message);
  return (data as TheatreInteriorTemplate[]) ?? [];
}

export async function getMovieAvailableFormats(movieId: string): Promise<MovieAvailableFormat[]> {
  if (DEMO_MODE) {
    return demo.availableFormats?.filter((f) => f.movie_id === movieId) ?? [];
  }
  const supabase = createReadClient();
  const { data, error } = await supabase
    .from("movie_available_formats")
    .select("*")
    .eq("movie_id", movieId)
    .eq("is_available", true)
    .order("aspect_ratio", { ascending: true });
  if (error) console.error("getMovieAvailableFormats:", error.message);
  return (data as MovieAvailableFormat[]) ?? [];
}