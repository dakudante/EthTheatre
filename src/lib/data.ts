import "server-only";

import { isSupabaseConfigured } from "./supabase/server";
import { createReadClient } from "./supabase/admin";
import { rankScreens } from "./ranking";
import * as demo from "./sample-data";
import type {
  Dcp,
  Movie,
  MovieAvailableFormat,
  MovieDcpVariants,
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
  "aspect_ratio and container_format"?: string | null;
  aspect_ratio_legacy?: string | null; // renamed by migration 0004
  audio_mix: string | null;
  formats: string | null;
  // Canonical columns (synced by migration 0004; may be empty pre-cleanup)
  title?: string | null;
  tmdb_id?: number | null;
  poster?: string | null;
  backdrop?: string | null;
  synopsis?: string | null;
  release_date?: string | null;
  duration?: number | null;
  genre?: string[] | null;
  format?: string[] | null;
  is_now_playing?: boolean | null;
  created_at?: string | null;
  // V2.0 columns (present after migration 0003; optional for older rows)
  dcp_variants?: MovieDcpVariants | null;
  aspect_ratio_primary?: string | null;
  aspect_ratio_secondary?: string | null;
  is_variable_aspect?: boolean | null;
  aspect_ratio_variants?: string[] | null;
  venue_types?: string[] | null;
  has_3d?: boolean | null;
  has_hfr?: boolean | null;
  frame_rate?: number | null;
  is_upscaled?: boolean | null;
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
    tmdb_id: r.tmdb_id ?? null,
    // Canonical columns first, legacy columns as fallback (pre-0004 rows).
    title: r.title || r.movie_name || "Untitled",
    poster: r.poster ?? null,
    backdrop: r.backdrop ?? null,
    synopsis: r.synopsis ?? null,
    release_date: r.release_date ?? null,
    duration: r.duration ?? r.runtime ?? null,
    genre: r.genre ?? [],
    // `format` exists but is often `{}` while legacy `formats` holds the data.
    format: r.format?.length ? r.format : splitFormats(r.formats),
    is_now_playing: r.is_now_playing ?? true,
    created_at: r.created_at ?? EPOCH,
    // V2.0
    dcp_variants: r.dcp_variants ?? null,
    aspect_ratio_primary: r.aspect_ratio_primary ?? null,
    aspect_ratio_secondary: r.aspect_ratio_secondary ?? null,
    is_variable_aspect: r.is_variable_aspect ?? false,
    aspect_ratio_variants: r.aspect_ratio_variants ?? [],
    venue_types: r.venue_types ?? [],
    has_3d: r.has_3d ?? false,
    has_hfr: r.has_hfr ?? false,
    frame_rate: r.frame_rate ?? 24,
    is_upscaled: r.is_upscaled ?? false,
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
    aspect_ratio_container:
      r.aspect_ratio_primary ??
      r.aspect_ratio_legacy ??
      r["aspect_ratio and container_format"] ??
      "Flat(1.85:1)",
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

// --------------------------- DCP variants (V2.0) ----------------------------
// A movie's `dcp_variants` JSONB is the distributor spec sheet: which builds
// ("4K 7.1 ATMO", "4K 12CH IMAX DMR", …) exist per venue class. We parse those
// free-text specs, pick the best build a given screen can present, and convert
// it into the internal Dcp shape the ranking engine consumes.

export interface ParsedDcpVariant {
  venueType: string;
  resolution: string | null;
  audioChannels: string | null;
  audioFormat: string | null;
  is3D: boolean;
  rawSpec: string;
}

export function parseDcpVariant(raw: string): ParsedDcpVariant {
  const lower = raw.toLowerCase();

  let resolution: string | null = null;
  if (lower.includes("8k")) resolution = "8K";
  else if (lower.includes("4k")) resolution = "4K";
  else if (lower.includes("2k")) resolution = "2K";

  let audioFormat: string | null = null;
  if (lower.includes("atmo")) audioFormat = "dolby_atmos";
  else if (lower.includes("dts:x") || lower.includes("dts_x")) audioFormat = "dts_x";
  else if (lower.includes("imax") && (lower.includes("ch") || lower.includes("channel")))
    audioFormat = "imax";
  else if (lower.includes("iab")) audioFormat = "iab";
  else if (lower.includes("5.1") || lower.includes("7.1")) audioFormat = "standard";

  let audioChannels: string | null = null;
  if (lower.includes("12ch") || lower.includes("12 ch")) audioChannels = "12.0";
  else if (lower.includes("5ch") || lower.includes("5 ch")) audioChannels = "5.0";
  else if (lower.includes("7.1")) audioChannels = "7.1";
  else if (lower.includes("5.1")) audioChannels = "5.1";

  const is3D = lower.includes("3d");

  return { venueType: "", resolution, audioChannels, audioFormat, is3D, rawSpec: raw };
}

export function getDcpVariantsForMovie(movie: Movie): ParsedDcpVariant[] {
  if (!movie.dcp_variants) return [];
  const variants: ParsedDcpVariant[] = [];

  const add = (venueType: string, specs: string[] | null | undefined) => {
    if (!specs) return;
    for (const spec of specs) {
      const parsed = parseDcpVariant(spec);
      parsed.venueType = venueType;
      variants.push(parsed);
    }
  };

  add("normal", movie.dcp_variants.normal_venue);
  add("atmos", movie.dcp_variants.atmos_venue);
  add("imax", movie.dcp_variants.imax);
  add("epiq", movie.dcp_variants.epiq);
  add("dolby_cinema", movie.dcp_variants.dolby_cinema);

  return variants;
}

export function selectBestDcpVariant(
  movie: Movie,
  screen: Screen,
): ParsedDcpVariant | null {
  const variants = getDcpVariantsForMovie(movie);
  if (variants.length === 0) return null;

  const screenHasAtmos = screen.sound_system.toLowerCase().includes("atmos");
  const screenIsIMAX = screen.screen_format.toLowerCase().includes("imax");
  const screenIsEPIQ = screen.screen_format.toLowerCase().includes("epiq");
  const screenIsDolby = screen.screen_format.toLowerCase().includes("dolby");

  let compatible = variants;

  if (screenIsIMAX) {
    const imax = variants.filter((v) => v.venueType === "imax");
    if (imax.length > 0) compatible = imax;
    else {
      const atmos = variants.filter((v) => v.venueType === "atmos");
      if (atmos.length > 0) compatible = atmos;
    }
  } else if (screenIsDolby) {
    const dolby = variants.filter((v) => v.venueType === "dolby_cinema");
    if (dolby.length > 0) compatible = dolby;
    else {
      const atmos = variants.filter((v) => v.venueType === "atmos");
      if (atmos.length > 0) compatible = atmos;
    }
  } else if (screenHasAtmos) {
    const atmos = variants.filter((v) => v.venueType === "atmos");
    if (atmos.length > 0) compatible = atmos;
  } else if (screenIsEPIQ) {
    const epiq = variants.filter((v) => v.venueType === "epiq");
    if (epiq.length > 0) compatible = epiq;
  } else {
    const normal = variants.filter((v) => v.venueType === "normal");
    if (normal.length > 0) compatible = normal;
  }

  compatible = [...compatible].sort((a, b) => {
    const resOrder: Record<string, number> = { "8K": 4, "4K": 3, "2K": 2 };
    return (resOrder[b.resolution ?? ""] || 0) - (resOrder[a.resolution ?? ""] || 0);
  });

  return compatible[0] ?? null;
}

const VARIANT_AUDIO_LABELS: Record<string, string> = {
  dolby_atmos: "Dolby Atmos",
  dts_x: "DTS:X",
  imax: "IMAX",
  iab: "IAB",
  standard: "Surround",
};

// Pull a bare "W:1"-style ratio out of any spec/container text, e.g.
// "Scope(2.39:1)" → "2.39:1", "4K 2.76:1 ATMO" → "2.76:1". Null when absent.
function extractRatio(text: string | null | undefined): string | null {
  const m = (text ?? "").match(/(\d\.\d{2})\s*:\s*1/);
  return m ? `${m[1]}:1` : null;
}

// "Scope 2.39:1" → "Scope(2.39:1)"; values already in Name(ratio) form pass through.
function normalizeAspectRatio(ratio: string | null | undefined): string {
  if (!ratio) return "Scope(2.39:1)";
  if (ratio.includes("(")) return ratio;
  return ratio.replace(/^([^(]+?)\s+([0-9.:]+)$/, "$1($2)");
}

// The container a NON-IMAX build ships in. For variable-aspect titles the
// secondary ratio is normally the standard release (e.g. Dune 2's Scope 2.39),
// so an IMAX-primary movie must NOT hand its IMAX ratio to a normal-venue DCP.
function getStandardAspectRatio(movie: Movie): string {
  if (movie.is_variable_aspect && movie.aspect_ratio_secondary) {
    const sec = normalizeAspectRatio(movie.aspect_ratio_secondary);
    if (!sec.toLowerCase().includes("imax")) return sec;
  }
  const primary = normalizeAspectRatio(movie.aspect_ratio_primary);
  if (!primary.toLowerCase().includes("imax")) return primary;
  return "Scope(2.39:1)";
}

function convertVariantToDcp(variant: ParsedDcpVariant, movie: Movie): Dcp {
  const format: string[] = [];
  if (variant.is3D) format.push("3D");
  if (variant.venueType === "imax") format.push("IMAX");
  if (variant.venueType === "epiq") format.push("EPIQ");
  if (movie.venue_types.includes("Dolby Vision")) format.push("Dolby Vision");
  if (movie.is_upscaled) format.push("Upscaled");

  const resolution = variant.resolution || "2K";

  // Aspect ratio follows the variant's venue, not blindly the movie's primary.
  let aspectRatio: string;
  if (variant.venueType === "imax") {
    if (movie.aspect_ratio_variants?.includes("IMAX 1.43:1")) {
      aspectRatio = "IMAX(1.43:1)";
    } else if (movie.aspect_ratio_variants?.includes("IMAX 1.90:1")) {
      aspectRatio = "IMAX(1.90:1)";
    } else {
      const primary = normalizeAspectRatio(movie.aspect_ratio_primary);
      aspectRatio = primary.toLowerCase().includes("imax") ? primary : "IMAX(1.90:1)";
    }
  } else {
    aspectRatio = getStandardAspectRatio(movie);
  }

  // Human-readable audio mix (e.g. "Dolby Atmos 7.1", "IMAX 12.0").
  let audioMix =
    VARIANT_AUDIO_LABELS[variant.audioFormat ?? ""] ?? (variant.audioFormat || "5.1");
  if (variant.audioChannels && !audioMix.includes(variant.audioChannels)) {
    audioMix += ` ${variant.audioChannels}`;
  }

  return {
    id: `variant-${movie.id}-${variant.venueType}`,
    screen_id: "",
    movie_id: movie.id,
    runtime: movie.duration || 0,
    resolution,
    format,
    aspect_ratio_container: aspectRatio,
    audio_mix: audioMix,
    verified: false,
    source: `distributor_sheet:${variant.venueType}`,
    created_at: new Date().toISOString(),
  };
}

// --------------------------- DCPs / Master spec -----------------------------
export async function getDcpsForMovie(movieId: string): Promise<Dcp[]> {
  if (DEMO_MODE) {
    // Derive from the movie's distributor variant sheet (V2); the legacy
    // hand-written demo.dcps array only backs movies without variants.
    const movie = demo.movies.find((m) => m.id === movieId);
    if (movie?.dcp_variants) {
      return getDcpVariantsForMovie(movie).map((v) => convertVariantToDcp(v, movie));
    }
    return demo.dcps.filter((d) => d.movie_id === movieId);
  }
  // Live schema has no dcps table; prefer the V2 distributor variant sheet,
  // falling back to the movie row's own spec columns.
  const row = await fetchMovieRow(movieId);
  if (!row) return [];
  const movie = mapMovie(row);
  const variants = getDcpVariantsForMovie(movie);
  if (variants.length > 0) {
    return variants.map((v) => convertVariantToDcp(v, movie));
  }
  return [syntheticDcp(row, "master")];
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

  // V2.0: when the movie carries a distributor variant sheet, pick the best
  // build each screen can present; otherwise fall back to the legacy synthetic
  // DCP derived from the movie row's own spec columns.
  const candidates = screens.map((screen) => {
    const variant = selectBestDcpVariant(movie, screen);
    return {
      screen,
      dcp: variant ? convertVariantToDcp(variant, movie) : syntheticDcp(row, screen.id),
    };
  });

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
  const movie = demo.movies.find((m) => m.id === movieId);
  if (!movie) return [];

  const theatres = new Map(demo.theatres.map((t) => [t.id, t] as const));

  // V2: rank EVERY demo screen by selecting the best distributor variant it
  // can present — the exact same pipeline as live mode, so aspect
  // compatibility and IMAX exclusivity behave identically in demo. The legacy
  // hand-written demo.dcps entries are only a fallback for movies without a
  // variant sheet, never an override (they used different aspect ratios and
  // made demo titles behave differently from live ones).
  const demoDcpByScreen = new Map(
    demo.dcps.filter((d) => d.movie_id === movieId).map((d) => [d.screen_id, d]),
  );
  const candidates = demo.screens.map((screen) => {
    const variant = selectBestDcpVariant(movie, screen);
    return {
      screen,
      dcp: variant
        ? convertVariantToDcp(variant, movie)
        : (demoDcpByScreen.get(screen.id) ?? null),
    };
  });

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
  const [screen] = await getScreensByIds([screenId]);
  if (!screen) return [];
  const out: ScreenProgramme[] = [];
  for (const movie of demo.movies.filter((m) => m.is_now_playing)) {
    // Same variant pipeline as the rankings, so the screen page shows the same
    // package the movie page ranks. demo.dcps is only a legacy fallback.
    const variant = selectBestDcpVariant(movie, screen);
    const dcp = variant
      ? convertVariantToDcp(variant, movie)
      : (demo.dcps.find((d) => d.screen_id === screenId && d.movie_id === movie.id) ?? null);
    if (!dcp) continue;
    // An IMAX-only build can't play on this screen — skip incompatible titles.
    const dcpIsImax = dcp.format.some((f) => f.toLowerCase().includes("imax"));
    if (dcpIsImax && !screen.screen_format.toLowerCase().includes("imax")) continue;
    out.push({ movie, dcp, showtimes: generateShowtimes(screen, movie) });
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
    const curated = demo.availableFormats?.filter((f) => f.movie_id === movieId) ?? [];
    if (curated.length) return curated;
    // Derive from the movie's distributor variant sheet. The aspect ratio per
    // entry comes from the spec text when present, otherwise from the
    // variant's resolved container (handles 2.76:1, 2.20:1, 1.43:1 titles).
    const movie = demo.movies.find((m) => m.id === movieId);
    if (!movie?.dcp_variants) return [];
    return getDcpVariantsForMovie(movie).map((v, i) => {
      const container = convertVariantToDcp(v, movie).aspect_ratio_container;
      return {
        id: `fmt-${movieId}-${v.venueType}-${i}`,
        movie_id: movieId,
        format_name: v.venueType,
        aspect_ratio: extractRatio(v.rawSpec) ?? extractRatio(container) ?? "2.39:1",
        container_type: container,
        is_available: true,
        notes: v.rawSpec,
        created_at: new Date().toISOString(),
      };
    });
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