import "server-only";

import { isSupabaseConfigured } from "./supabase/server";
import { createReadClient } from "./supabase/admin";
import {
  resolutionScore,
  formatScore,
  audioScore,
  isCompatible,
  dcpVariantTier,
  rankByVariants,
  rankScreens,
  rankScreensDeduped,
} from "./ranking";
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

/** Default page size for paginated catalogue queries. */
const DEFAULT_PAGE_SIZE = 100;
/** Upper bound on screens fetched per movie ranking. */
const MAX_SCREENS_PER_MOVIE = 500;

/**
 * Thrown when a live Supabase fetch fails. Distinguishes a genuine error from
 * an empty-but-successful result (which previously both rendered as `[]`).
 */
export class DataFetchError extends Error {
  constructor(
    public readonly source: string,
    message: string,
  ) {
    super(`${source}: ${message}`);
    this.name = "DataFetchError";
  }
}

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
  // Added by migration 0005 (optional until it runs)
  user_rating?: number | null;
  review_count?: number | null;
  number_of_seats?: number | null;
  three_d_system?: string | null;
  screen_width_ft?: number | null;
  screen_height_ft?: number | null;
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

// Parse "72 x 31 ft" → { width: 72, height: 31 } (fallback when the structured
// screen_width_ft/height_ft columns aren't populated yet).
function parseDimensions(s: string | null | undefined): {
  width: number | null;
  height: number | null;
} {
  const m = (s ?? "").match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  return m
    ? { width: parseFloat(m[1]), height: parseFloat(m[2]) }
    : { width: null, height: null };
}

function mapScreen(r: DbScreenRow): Screen {
  const dims = parseDimensions(r.screen_dimensions);
  return {
    id: String(r.id),
    theatre_id: String(r.theatre_id),
    name: r.screen_name ?? "Screen",
    screen_format: r.screen_format ?? "Standard",
    projection_system: r.projection_system ?? "—",
    sound_system: r.sound_system ?? "—",
    // Read the real live columns (added by migration 0005) instead of
    // hardcoding inert values; screen_spec mirrors the free-text dimensions.
    screen_spec: r.screen_dimensions ?? null,
    number_of_seats: r.number_of_seats ?? null,
    three_d_system: r.three_d_system ?? null,
    user_rating: r.user_rating ?? null,
    review_count: r.review_count ?? 0,
    created_at: EPOCH,
    // NEW FIELDS
    projector_brand: r.projector_brand ?? null,
    projector_model: r.projector_model ?? null,
    screen_brand: r.screen_brand ?? null,
    screen_dimensions: r.screen_dimensions ?? null,
    // Prefer the structured columns; fall back to parsing screen_dimensions.
    screen_width_ft: r.screen_width_ft ?? dims.width,
    screen_height_ft: r.screen_height_ft ?? dims.height,
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

export async function getAllMovies(
  limit = DEFAULT_PAGE_SIZE,
  offset = 0,
): Promise<Movie[]> {
  if (DEMO_MODE) return demo.movies;
  const supabase = createReadClient();
  const { data, error } = await supabase
    .from("movies")
    .select("*")
    .order("movie_name", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw new DataFetchError("getAllMovies", error.message);
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
  if (error) throw new DataFetchError("fetchMovieRow", error.message);
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
  is70mm: boolean;
  rawSpec: string;
}

export function parseDcpVariant(raw: string): ParsedDcpVariant {
  const lower = raw.toLowerCase();

  let resolution: string | null = null;
  if (lower.includes("8k")) resolution = "8K";
  else if (lower.includes("4k")) resolution = "4K";
  else if (lower.includes("2k")) resolution = "2K";

  // Channel count: "12ch", "12 ch", "12-Channel", "12 Channel", "5-Channel"…
  const chMatch = lower.match(/(\d+)\s*(?:ch\b|[-\s]?channel)/);

  let audioFormat: string | null = null;
  if (lower.includes("atmo")) audioFormat = "dolby_atmos";
  // "dts:x", "dts_x", "dts-x", "dts x", "dtsx"
  else if (/dts[\s:_-]?x/.test(lower)) audioFormat = "dts_x";
  else if (lower.includes("imax") && (chMatch || lower.includes("channel")))
    audioFormat = "imax";
  else if (lower.includes("iab")) audioFormat = "iab";
  else if (lower.includes("5.1") || lower.includes("7.1")) audioFormat = "standard";

  let audioChannels: string | null = null;
  if (chMatch) audioChannels = `${chMatch[1]}.0`; // "12-Channel" → "12.0"
  else if (lower.includes("7.1")) audioChannels = "7.1";
  else if (lower.includes("5.1")) audioChannels = "5.1";

  const is3D = lower.includes("3d");
  const is70mm = lower.includes("70mm");

  return { venueType: "", resolution, audioChannels, audioFormat, is3D, is70mm, rawSpec: raw };
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

export function selectBestDcpVariant(movie: Movie, screen: Screen): ParsedDcpVariant | null {
  const variants = getDcpVariantsForMovie(movie);
  if (variants.length === 0) return null;

  // Filter to compatible variants
  const compatible = variants.filter((v) => {
    const dcp = convertVariantToDcp(v, movie);
    return isCompatible(screen, dcp);
  });

  if (compatible.length === 0) return null;

  // Sort by tier, then by raw DCP score
  compatible.sort((a, b) => {
    const dcpA = convertVariantToDcp(a, movie);
    const dcpB = convertVariantToDcp(b, movie);
    const tierA = dcpVariantTier(dcpA);
    const tierB = dcpVariantTier(dcpB);
    if (tierA !== tierB) return tierA - tierB;

    // Fallback: compare raw DCP scores
    const scoreA =
      resolutionScore(dcpA.resolution) * 0.40 +
      formatScore(dcpA.format) * 0.11 +
      audioScore(dcpA.audio_mix) * 0.24 +
      (dcpA.verified ? 1.0 : 0.6) * 0.10;
    const scoreB =
      resolutionScore(dcpB.resolution) * 0.40 +
      formatScore(dcpB.format) * 0.11 +
      audioScore(dcpB.audio_mix) * 0.24 +
      (dcpB.verified ? 1.0 : 0.6) * 0.10;
    return scoreB - scoreA;
  });

  return compatible[0];
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

// "Scope 2.39:1" → "Scope(2.39:1)"; values already in Name(ratio) form pass
// through. Missing data → "Unknown" (a neutral 0.6 in the aspect scorer) rather
// than confidently asserting Scope, which would misrank Flat films whenever an
// incomplete community record omits the aspect ratio.
function normalizeAspectRatio(ratio: string | null | undefined): string {
  if (!ratio || !ratio.trim()) return "Unknown";
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
  return "Unknown"; // neutral rather than a confident Scope assertion
}

function convertVariantToDcp(variant: ParsedDcpVariant, movie: Movie): Dcp {
  const format: string[] = [];
  if (variant.is3D) format.push("3D");
  if (variant.venueType === "imax") {
    format.push("IMAX");
    if (variant.is70mm) format.push("70mm");
  }
  if (variant.venueType === "epiq") format.push("EPIQ");
  if (variant.venueType === "dolby_cinema" && movie.venue_types.includes("Dolby Vision")) format.push("Dolby Vision");
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
      if (primary.toLowerCase().includes("imax")) {
        aspectRatio = primary;
      } else if (movie.aspect_ratio_primary?.toLowerCase().includes("scope")) {
        aspectRatio = "Scope(2.39:1)"; // IMAX DMR of scope film is still scope
      } else if (movie.aspect_ratio_primary?.toLowerCase().includes("flat")) {
        aspectRatio = "Flat(1.85:1)";
      } else {
        aspectRatio = "IMAX(1.90:1)";
      }
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
    // Unique per spec string — one venue can ship several builds (e.g. IMAX
    // 5CH and 12CH) and grouping by id must keep them distinct.
    id: `variant-${movie.id}-${variant.venueType}-${variant.rawSpec.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    screen_id: "",
    movie_id: movie.id,
    runtime: movie.duration || 0,
    resolution,
    format,
    aspect_ratio_container: aspectRatio,
    audio_mix: audioMix,
    // Variants come from an actual distributor spec sheet — authoritative data.
    verified: true,
    source: `distributor_sheet:${variant.venueType}`,
    created_at: new Date().toISOString(),
  };
}

// --------------------------- DCPs / Master spec -----------------------------
export async function getDcpsForMovie(movieId: string): Promise<Dcp[]> {
  // The V2 dcp_variants sheet is the sole source of DCP data in both modes.
  if (DEMO_MODE) {
    const movie = demo.movies.find((m) => m.id === movieId);
    if (!movie) return [];
    return getDcpVariantsForMovie(movie).map((v) => convertVariantToDcp(v, movie));
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

/**
 * Expand a movie into its full list of DCP variants (one Dcp per build).
 * - V2 sheet present → one Dcp per parsed variant spec.
 * - Legacy IMAX title without a sheet → an IMAX variant AND a standard
 *   variant, so non-IMAX screens still rank under the standard build.
 * - Otherwise → single synthetic DCP from the movie row / demo array.
 */
function buildDcpVariants(movie: Movie, row: DbMovieRow | null): Dcp[] {
  const parsed = getDcpVariantsForMovie(movie);
  if (parsed.length > 0) {
    return parsed.map((v) => convertVariantToDcp(v, movie));
  }
  if (!row) return [];
  const base = syntheticDcp(row, "global");
  const isImaxMovie = base.format.some((f) => f.toLowerCase().includes("imax"));
  if (isImaxMovie) {
    const imaxVariant: Dcp = { ...base, id: `dcp-${row.id}-imax` };
    const standardVariant: Dcp = {
      ...base,
      id: `dcp-${row.id}-std`,
      format: base.format.filter((f) => !f.toLowerCase().includes("imax")),
      aspect_ratio_container: base.aspect_ratio_container.includes("1.90")
        ? "Flat(1.85:1)" // best guess for the standard container
        : base.aspect_ratio_container,
    };
    return [imaxVariant, standardVariant];
  }
  return [base];
}

interface MovieCandidates {
  movie: Movie;
  candidates: { screen: Screen; dcp: Dcp | null }[];
  theatres: Map<string, Theatre>;
}

/**
 * Shared candidate construction for ranking: every (screen × DCP variant)
 * pair the screen can physically present. A screen may appear once per
 * compatible variant — consumers either dedupe (flat list) or group by
 * variant (tabbed UI).
 */
async function buildMovieCandidates(
  movieId: string,
  city?: string,
): Promise<MovieCandidates | null> {
  let movie: Movie | null;
  let row: DbMovieRow | null = null;
  let screens: Screen[];
  let theatres: Map<string, Theatre>;

  if (DEMO_MODE) {
    movie = demo.movies.find((m) => m.id === movieId) ?? null;
    if (!movie) return null;
    screens = demo.screens;
    theatres = new Map(demo.theatres.map((t) => [t.id, t] as const));
  } else {
    row = await fetchMovieRow(movieId);
    if (!row) return null;
    movie = mapMovie(row);
    const supabase = createReadClient();

    // City filter is pushed into the theatres query (live `location` = city);
    // screens are then limited to those theatres in-query, and paginated.
    // Filters (.eq/.in) must precede transforms (.order/.range) on the builder.
    let theatreQuery = supabase.from("theatres").select("*");
    if (city) theatreQuery = theatreQuery.ilike("location", `%${city}%`);
    const { data: theatreRows, error: theatreErr } = await theatreQuery.order(
      "name",
      { ascending: true },
    );
    if (theatreErr) {
      throw new DataFetchError("buildMovieCandidates/theatres", theatreErr.message);
    }
    const theatreList = (theatreRows as DbTheatreRow[]) ?? [];
    theatres = new Map(
      theatreList.map((t) => [String(t.id), mapTheatre(t)]),
    );

    let screenQuery = supabase.from("screens").select("*");
    if (city) {
      screenQuery = screenQuery.in(
        "theatre_id",
        theatreList.map((t) => t.id),
      );
    }
    const { data: screenRows, error: screenErr } = await screenQuery.range(
      0,
      MAX_SCREENS_PER_MOVIE - 1,
    );
    if (screenErr) {
      throw new DataFetchError("buildMovieCandidates/screens", screenErr.message);
    }
    screens = ((screenRows as DbScreenRow[]) ?? []).map(mapScreen);
  }

  // Demo mode filters in-memory (the live path already filtered in-query).
  if (DEMO_MODE && city) {
    const c = city.toLowerCase();
    const matching = new Set(
      Array.from(theatres.values())
        .filter((t) => t.city.toLowerCase().includes(c))
        .map((t) => t.id),
    );
    screens = screens.filter((s) => matching.has(s.theatre_id));
  }

  // When V2 distributor variants exist, use selectBestDcpVariant to pick one
  // DCP per screen (source of truth for venue-class gating). This ensures
  // IMAX screens get IMAX DCPs, Dolby screens get Dolby DCPs, etc.
  const parsedVariants = getDcpVariantsForMovie(movie);
  if (parsedVariants.length > 0) {
    const candidates = screens
      .map((screen) => {
        const variant = selectBestDcpVariant(movie, screen);
        if (!variant) return null;
        const dcp = convertVariantToDcp(variant, movie);
        return { screen, dcp };
      })
      .filter((c): c is { screen: Screen; dcp: Dcp } => c !== null);
    return { movie, candidates, theatres };
  }

  // Legacy fallback: pair every screen with every compatible variant.
  const variants = buildDcpVariants(movie, row);
  const candidates = screens.flatMap((screen) =>
    variants
      .filter((dcp) => isCompatible(screen, dcp))
      .map((dcp) => ({ screen, dcp })),
  );

  return { movie, candidates, theatres };
}

function toRankedScreen(
  r: ReturnType<typeof rankScreens>[number],
  movie: Movie,
  theatres: Map<string, Theatre>,
): RankedScreen | null {
  const theatre = theatres.get(r.screen.theatre_id);
  if (!theatre) return null;
  return {
    rank: r.rank,
    score: r.score,
    reason: r.reason,
    screen: r.screen,
    theatre,
    dcp: r.dcp,
    showtimes: DEMO_MODE ? generateShowtimes(r.screen, movie) : [],
  };
}

export async function getMovieRankings(movieId: string): Promise<RankedScreen[]> {
  const built = await buildMovieCandidates(movieId);
  if (!built) return [];
  const { movie, candidates, theatres } = built;

  // A screen can appear once per compatible variant — keep its best assignment.
  return rankScreensDeduped(movie, candidates)
    .slice(0, 12)
    .map((r) => toRankedScreen(r, movie, theatres))
    .filter((x): x is RankedScreen => x !== null);
}

export interface RankedVariantGroup {
  dcp: Dcp;
  label: string;
  tier: number;
  rankings: RankedScreen[];
}

/** Per-variant ranked sections (best variant first) for the tabbed movie UI. */
export async function getMovieRankedVariants(
  movieId: string,
  city?: string,
): Promise<{ movie: Movie; variants: RankedVariantGroup[] } | null> {
  const built = await buildMovieCandidates(movieId, city);
  if (!built) return null;
  const { movie, candidates, theatres } = built;

  const variants = rankByVariants(movie, candidates)
    .map(({ dcp, label, tier, ranked }) => ({
      dcp,
      label,
      tier,
      rankings: ranked
        .slice(0, 12)
        .map((r) => toRankedScreen(r, movie, theatres))
        .filter((x): x is RankedScreen => x !== null),
    }))
    .filter((g) => g.rankings.length > 0);

  return { movie, variants };
}

// --------------------------- Theatres ---------------------------------------
export async function getTheatres(): Promise<Theatre[]> {
  if (DEMO_MODE) return demo.theatres;
  const supabase = createReadClient();
  const { data, error } = await supabase
    .from("theatres")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new DataFetchError("getTheatres", error.message);
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
  if (error) throw new DataFetchError("getTheatre", error.message);
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
  if (error) throw new DataFetchError("getScreensForTheatre", error.message);
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
    if (error) throw new DataFetchError("getScreen", error.message);
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
    // package the movie page ranks. dcp_variants is the sole DCP source.
    const variant = selectBestDcpVariant(movie, screen);
    if (!variant) continue;
    const dcp = convertVariantToDcp(variant, movie);
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
  if (error) throw new DataFetchError("getMovieKeyframes", error.message);
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
  if (error) throw new DataFetchError("getTheatreInteriorTemplates", error.message);
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
  if (error) throw new DataFetchError("getMovieAvailableFormats", error.message);
  return (data as MovieAvailableFormat[]) ?? [];
}