import { z } from "zod";

// ── Projector Knowledge Base ───────────────────────────────────────────────
const PROJECTOR_KNOWLEDGE_BASE: Record<string, {
  type: "rgb-laser" | "phosphor-laser" | "xenon" | "unknown";
  estimatedLumens: number;
  resolution: "4K" | "2K";
  isDciCompliant: boolean;
}> = {
  "BARCO SP4K-55B": { type: "rgb-laser", estimatedLumens: 55000, resolution: "4K", isDciCompliant: true },
  "BARCO DP4K-19B": { type: "rgb-laser", estimatedLumens: 19000, resolution: "4K", isDciCompliant: true },
  "BARCO DP2K-20C": { type: "xenon", estimatedLumens: 18500, resolution: "2K", isDciCompliant: true },
  "NEC NP-NC900C-A": { type: "xenon", estimatedLumens: 9000, resolution: "2K", isDciCompliant: true },
  "Christie 4K RGB Laser": { type: "rgb-laser", estimatedLumens: 20000, resolution: "4K", isDciCompliant: true },
  "Christie CP4440-RGB": { type: "rgb-laser", estimatedLumens: 40000, resolution: "4K", isDciCompliant: true },
  "Christie 4K Xenon": { type: "xenon", estimatedLumens: 20000, resolution: "4K", isDciCompliant: true },
};

function getProjectorSpecs(brand: string | null, model: string | null) {
  if (!brand || !model) return null;
  const key = `${brand} ${model}`;
  return PROJECTOR_KNOWLEDGE_BASE[key] ?? null;
}

// ── Screen Brand Knowledge Base ────────────────────────────────────────────
const SCREEN_BRAND_KNOWLEDGE: Record<string, {
  gain: number;
  material: "silver" | "matte-white" | "perlux" | "unknown";
}> = {
  "Harkness Hugo": { gain: 1.4, material: "silver" },
  "Harkness Perlux": { gain: 1.0, material: "matte-white" },
  "Harkness Clarus": { gain: 1.2, material: "matte-white" },
  "STRONG MDI": { gain: 1.8, material: "silver" },
  "MDI": { gain: 1.5, material: "silver" },
};

function getScreenSpecs(brand: string | null) {
  if (!brand) return null;
  return SCREEN_BRAND_KNOWLEDGE[brand] ?? null;
}

// ── Screen Dimensions Parser ───────────────────────────────────────────────
function parseScreenDimensions(dimensions: string | null): { widthFt: number; heightFt: number; areaSqFt: number } | null {
  if (!dimensions) return null;
  const match = dimensions.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const widthFt = parseFloat(match[1]);
  const heightFt = parseFloat(match[2]);
  return { widthFt, heightFt, areaSqFt: widthFt * heightFt };
}

// ---- types ----
import type { Dcp, Movie, Screen } from "./types";

// ── Input contracts ─────────────────────────────────────────────────────────
// Canonical Zod schemas for everything that enters the ranking engine from an
// untrusted boundary (HTTP query/route params). The engine's pure functions
// still operate on already-typed domain objects; these schemas validate the
// *identifiers and filters* a caller supplies before we touch the data layer.

/** Screen/DCP format filters a client may request. */
export const SCREEN_FORMATS = [
  "2D",
  "3D",
  "IMAX",
  "EPIQ",
  "PXL",
  "4DX",
  "Scope",
  "Flat",
] as const;
export type ScreenFormatFilter = (typeof SCREEN_FORMATS)[number];

/** Query for "best screens for a movie" (optionally filtered by city/format). */
export const RecommendationQuerySchema = z.object({
  movieId: z.string().uuid(),
  city: z.string().trim().min(1).max(120).optional(),
  format: z.enum(SCREEN_FORMATS).optional(),
});
export type RecommendationQuery = z.infer<typeof RecommendationQuerySchema>;

/** Identifies a single movie × screen (× optional DCP) ranking computation. */
export const RankingParamsSchema = z.object({
  movieId: z.string().uuid(),
  screenId: z.string().uuid(),
  dcpId: z.string().uuid().optional(),
});
export type RankingParams = z.infer<typeof RankingParamsSchema>;

/**
 * Validate ranking identifiers, returning a typed result. Throws a ZodError on
 * invalid input — callers at trusted boundaries can use `.safeParse` directly
 * when they prefer to handle the error shape themselves.
 */
export function parseRankingParams(input: unknown): RankingParams {
  return RankingParamsSchema.parse(input);
}

/**
 * ScreenRank ranking engine.
 *
 * Philosophy: the *DCP* (what the projector is actually fed) is the dominant
 * signal — a flawless screen playing a 2K Flat file beats a mediocre screen
 * playing a 4K HDR Scope file only rarely. So DCP technical fidelity is
 * weighted first (~60%), raw screen hardware second (~35%), and crowd signal
 * is a small tiebreak (~5%).
 *
 * Every sub-score is 0..1 and carries a weight; the weighted sum is scaled to
 * 0..100. We also emit the factors that moved the needle so the UI can explain
 * *why* a screen ranked where it did.
 */

export interface ScoreBreakdown {
  label: string;
  detail: string;
  value: number;
  weight: number;
  accent: "imax" | "dolby" | "premium" | "epiq" | "neutral";
  // NEW optional fields for enhanced scoring
  projectorSpecBonus?: number;
  screenGainMatch?: number;
  pixelDensityAdequacy?: number;
  brightnessEstimate?: number;
}

export interface ScoredScreen {
  score: number; // 0..100
  reason: string;
  breakdown: ScoreBreakdown[];
}

const WEIGHTS = {
  // DCP — the file fidelity + how well it matches the room (sums to 0.65)
  dcpResolution: 0.18,
  dcpFormat: 0.16,
  dcpAspectCompatibility: 0.15, // DCP container ↔ screen format match
  dcpAudio: 0.12,
  dcpVerified: 0.04,
  // Hardware — the room (sums to 0.30)
  hwProjection: 0.11,
  hwSound: 0.1,
  hwScreenClass: 0.07,
  hwScreenSize: 0.02,
  // Crowd (0.05)
  crowd: 0.05,
};

function resolutionScore(res?: string | null): number {
  const v = (res ?? "").toLowerCase();
  if (v.includes("8k")) return 1;
  if (v.includes("4k")) return 0.9;
  if (v.includes("2k")) return 0.55;
  return 0.4;
}

function formatScore(dcpFormats: string[], movieFormats: string[]): number {
  const set = new Set(dcpFormats.map((f) => f.toLowerCase()));
  let s = 0.4; // baseline 2D digital
  if (set.has("hdr") || set.has("dolby vision")) s += 0.3;
  if (set.has("hfr")) s += 0.15;
  if (set.has("3d")) s += 0.1;
  // Reward when the screen can actually present a marquee format of the film.
  const wants = new Set(movieFormats.map((f) => f.toLowerCase()));
  if (wants.has("imax") && set.has("imax")) s += 0.15;
  return Math.min(1, s);
}

/**
 * How well a DCP's aspect-ratio container matches the screen's native format.
 * A Flat DCP belongs on a Flat screen and a Scope DCP on a Scope screen;
 * mismatches mean wasted black bars (letterbox/pillarbox), so they're penalised.
 */
function aspectCompatibilityScore(
  dcpContainer?: string | null,
  screenFormat?: string | null,
): number {
  const dcp = (dcpContainer ?? "").toLowerCase();
  const screen = (screenFormat ?? "").toLowerCase();

  // Unknown / standard screen → neutral.
  if (!screen || screen.includes("standard")) return 0.6;

  // IMAX containers (detected by the "imax" token, not a bare ratio, so a
  // "Flat(1.90:1)" digital container isn't mistaken for IMAX).
  if (dcp.includes("imax")) {
    if (dcp.includes("1.43") && screen.includes("70mm")) return 1;
    if (dcp.includes("1.90") && screen.includes("imax") && !screen.includes("70mm"))
      return 1;
    if (screen.includes("imax")) return 0.9; // general IMAX match
    return 0.4; // IMAX DCP on non-IMAX screen (normally gated out upstream)
  }

  const dcpFlat = dcp.includes("flat") || dcp.includes("1.85");
  const dcpScope =
    dcp.includes("scope") ||
    dcp.includes("2.39") ||
    dcp.includes("2.40") ||
    dcp.includes("2.76");
  const screenFlat = screen.includes("flat");
  const screenScope = screen.includes("scope");

  if (dcpFlat && screenFlat) return 1;
  if (dcpScope && screenScope) return 1;
  if ((dcpFlat && screenScope) || (dcpScope && screenFlat)) return 0.5; // mismatch
  return 0.6; // neutral (PLF / other screen classes)
}

function audioScore(mix?: string | null): number {
  const v = (mix ?? "").toLowerCase();
  if (v.includes("atmos")) return 1;
  if (v.includes("dts") && v.includes("x")) return 0.95;
  if (v.includes("imax") && v.includes("12")) return 0.98;
  if (v.includes("auro")) return 0.9;
  if (v.includes("7.1")) return 0.75;
  if (v.includes("imax")) return 0.7;
  if (v.includes("5.1")) return 0.55;
  return 0.45;
}

function projectionScore(proj?: string | null): number {
  const v = (proj ?? "").toLowerCase();
  if (v.includes("rgb") && v.includes("laser")) return 1; // 4K RGB laser
  if (v.includes("4k") && v.includes("laser")) return 0.9;
  if (v.includes("4k")) return 0.78;
  if (v.includes("2k") && v.includes("laser")) return 0.62;
  if (v.includes("2k")) return 0.5;
  if (v.includes("laser")) return 0.7;
  if (v.includes("xenon")) return 0.5;
  return 0.45;
}

function soundHardwareScore(sound?: string | null): number {
  const v = (sound ?? "").toLowerCase();
  if (v.includes("atmos")) return 1;
  if (v.includes("imax") && v.includes("12")) return 0.97;
  if (v.includes("dts") && v.includes("x")) return 0.92;
  if (v.includes("imax")) return 0.8;
  if (v.includes("7.1")) return 0.72;
  if (v.includes("5.1")) return 0.5;
  return 0.45;
}

function screenClassScore(format?: string | null): {
  value: number;
  accent: ScoreBreakdown["accent"];
} {
  const v = (format ?? "").toLowerCase();
  if (v.includes("imax") && v.includes("70mm"))
    return { value: 1, accent: "imax" };
  if (v.includes("imax")) return { value: 0.92, accent: "imax" };
  if (v.includes("dolby")) return { value: 0.88, accent: "dolby" };
  if (v.includes("epiq") || v.includes("pxl"))
    return { value: 0.82, accent: "epiq" };
  if (v.includes("4dx") || v.includes("luxe") || v.includes("premium"))
    return { value: 0.7, accent: "premium" };
  if (v.includes("scope")) return { value: 0.6, accent: "neutral" };
  return { value: 0.5, accent: "neutral" };
}

// Pull the largest dimension (feet) out of a free-text screen spec.
function screenSizeScore(spec?: string | null): number {
  if (!spec) return 0.45;
  const nums = spec.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  const width = Math.max(0, ...nums);
  if (width >= 90) return 1;
  if (width >= 70) return 0.85;
  if (width >= 50) return 0.7;
  if (width >= 35) return 0.55;
  return 0.45;
}

export function scoreScreen(
  movie: Movie,
  screen: Screen,
  dcp: Dcp | null,
): ScoredScreen {
  const breakdown: ScoreBreakdown[] = [];
  const push = (
    b: Omit<ScoreBreakdown, "accent"> & { accent?: ScoreBreakdown["accent"] },
  ) => breakdown.push({ accent: "neutral", ...b });
  // ── Enhanced hardware lookups (only used if data is available) ──
  const projectorSpecs = getProjectorSpecs(screen.projector_brand, screen.projector_model);
  const screenSpecs = getScreenSpecs(screen.screen_brand);
  const screenDims = parseScreenDimensions(screen.screen_dimensions);

  // Projector spec bonus (0..1) — trust factor when model is known
  let projectorSpecBonus = 0;
  if (projectorSpecs) {
    if (projectorSpecs.type === "rgb-laser") projectorSpecBonus = 1.0;
    else if (projectorSpecs.type === "phosphor-laser") projectorSpecBonus = 0.85;
    else if (projectorSpecs.type === "xenon") projectorSpecBonus = 0.6;
    else projectorSpecBonus = 0.5;
  }

  // Screen gain match (0..1) — does screen material suit the content?
  let screenGainMatch = 0.6; // neutral default
  if (screenSpecs && dcp) {
    const is3D = dcp.format.some(f => f.toLowerCase().includes("3d"));
    if (is3D && screenSpecs.material === "silver") screenGainMatch = 1.0;
    else if (is3D && screenSpecs.material === "matte-white") screenGainMatch = 0.4;
    else if (!is3D && screenSpecs.material === "silver") screenGainMatch = 0.7; // slight penalty for 2D on silver
    else if (!is3D && screenSpecs.material === "matte-white") screenGainMatch = 1.0;
  }

  // Pixel density adequacy (0..1) — resolution vs screen size
  let pixelDensityAdequacy = 0.7; // neutral
  if (projectorSpecs && screenDims) {
    const resWidth = projectorSpecs.resolution === "4K" ? 4096 : 2048;
    const pixelsPerFoot = resWidth / screenDims.widthFt;
    // 2K on 90ft = 22.7 px/ft (bad), 4K on 40ft = 102 px/ft (excellent)
    if (pixelsPerFoot >= 80) pixelDensityAdequacy = 1.0;
    else if (pixelsPerFoot >= 50) pixelDensityAdequacy = 0.9;
    else if (pixelsPerFoot >= 30) pixelDensityAdequacy = 0.75;
    else if (pixelsPerFoot >= 20) pixelDensityAdequacy = 0.5;
    else pixelDensityAdequacy = 0.3;
  }

  // Brightness estimate (0..1) — lumens * gain / area
  let brightnessEstimate = 0.7; // neutral
  if (projectorSpecs && screenDims && screenSpecs) {
    const nitsEstimate = (projectorSpecs.estimatedLumens * screenSpecs.gain) / (screenDims.areaSqFt * 0.3048 * 0.3048 * Math.PI);
    if (nitsEstimate >= 100) brightnessEstimate = 1.0;
    else if (nitsEstimate >= 60) brightnessEstimate = 0.9;
    else if (nitsEstimate >= 40) brightnessEstimate = 0.75;
    else if (nitsEstimate >= 25) brightnessEstimate = 0.55;
    else brightnessEstimate = 0.35;
  }
  // ---- DCP dimension ----
  if (dcp) {
    const res = resolutionScore(dcp.resolution);
    push({
      label: "DCP resolution",
      detail: dcp.resolution,
      value: res,
      weight: WEIGHTS.dcpResolution,
      accent: res >= 0.9 ? "premium" : "neutral",
    });

    const fmt = formatScore(dcp.format, movie.format);
    push({
      label: "DCP format",
      detail: dcp.format.length ? dcp.format.join(", ") : "2D",
      value: fmt,
      weight: WEIGHTS.dcpFormat,
      accent: fmt >= 0.7 ? "premium" : "neutral",
    });

    const asp = aspectCompatibilityScore(
      dcp.aspect_ratio_container,
      screen.screen_format,
    );
    push({
      label: "Aspect match",
      detail: dcp.aspect_ratio_container,
      value: asp,
      weight: WEIGHTS.dcpAspectCompatibility,
      accent: asp >= 1 ? "premium" : "neutral",
    });

    const aud = audioScore(dcp.audio_mix);
    push({
      label: "DCP audio mix",
      detail: dcp.audio_mix,
      value: aud,
      weight: WEIGHTS.dcpAudio,
      accent: aud >= 0.9 ? "dolby" : "neutral",
    });

    push({
      label: "Verification",
      detail: dcp.verified
        ? `Verified${dcp.source ? ` · ${dcp.source}` : ""}`
        : "Unverified spec",
      value: dcp.verified ? 1 : 0.3,
      weight: WEIGHTS.dcpVerified,
    });
  } else {
    // No DCP on record — neutralize the DCP weight band so screens without a
    // confirmed package aren't unduly punished, but can't top a verified one.
    push({
      label: "DCP",
      detail: "No confirmed package",
      value: 0.45,
      weight:
        WEIGHTS.dcpResolution +
        WEIGHTS.dcpFormat +
        WEIGHTS.dcpAspectCompatibility +
        WEIGHTS.dcpAudio +
        WEIGHTS.dcpVerified,
    });
  }

  // ---- Hardware dimension ----
  const proj = projectionScore(screen.projection_system);
  push({
    label: "Projection",
    detail: screen.projection_system,
    value: proj,
    weight: WEIGHTS.hwProjection,
    accent: proj >= 0.9 ? "premium" : "neutral",
  });

  const snd = soundHardwareScore(screen.sound_system);
  push({
    label: "Sound system",
    detail: screen.sound_system,
    value: snd,
    weight: WEIGHTS.hwSound,
    accent: snd >= 0.9 ? "dolby" : "neutral",
  });

  const cls = screenClassScore(screen.screen_format);
  push({
    label: "Screen class",
    detail: screen.screen_format,
    value: cls.value,
    weight: WEIGHTS.hwScreenClass,
    accent: cls.accent,
  });

  const size = screenSizeScore(screen.screen_spec);
  push({
    label: "Screen size",
    detail: screen.screen_spec ?? "Not specified",
    value: size,
    weight: WEIGHTS.hwScreenSize,
  });
  // ── Enhanced hardware bonuses (only if data available) ──
  if (projectorSpecs) {
    push({
      label: "Projector model",
      detail: `${screen.projector_brand} ${screen.projector_model}`,
      value: projectorSpecBonus,
      weight: 0.03,
      accent: projectorSpecBonus >= 0.9 ? "premium" : "neutral",
    });
  }

  if (screenSpecs && dcp) {
    push({
      label: "Screen material",
      detail: `${screen.screen_brand} (${screenSpecs.material}, gain ${screenSpecs.gain})`,
      value: screenGainMatch,
      weight: 0.03,
      accent: screenGainMatch >= 0.9 ? "premium" : "neutral",
    });
  }

  if (projectorSpecs && screenDims) {
    push({
      label: "Pixel density",
      detail: `${projectorSpecs.resolution} on ${screenDims.widthFt}ft screen`,
      value: pixelDensityAdequacy,
      weight: 0.04,
      accent: pixelDensityAdequacy >= 0.9 ? "premium" : "neutral",
    });
  }

  if (projectorSpecs && screenDims && screenSpecs) {
    push({
      label: "Brightness estimate",
      detail: `${projectorSpecs.estimatedLumens}lm × ${screenSpecs.gain} gain / ${Math.round(screenDims.areaSqFt)}sqft`,
      value: brightnessEstimate,
      weight: 0.03,
      accent: brightnessEstimate >= 0.9 ? "premium" : "neutral",
    });
  }
  // ---- Crowd ----
  push({
    label: "Audience rating",
    detail: screen.review_count
      ? `${screen.user_rating.toFixed(1)} / 5 · ${screen.review_count} reviews`
      : "No reviews yet",
    value: screen.review_count ? screen.user_rating / 5 : 0.5,
    weight: WEIGHTS.crowd,
  });

  const total = breakdown.reduce((sum, b) => sum + b.value * b.weight, 0);
  // Enhanced hardware bonuses can push the weighted total past 1.0, so clamp to
  // keep the score on a clean 0..100 scale.
  const score = Math.min(100, Math.round(total * 1000) / 10); // 0..100, one decimal

  return { score, reason: buildReason(breakdown, dcp), breakdown };
}

function buildReason(breakdown: ScoreBreakdown[], dcp: Dcp | null): string {
  const candidates = breakdown.filter(
    (b) =>
      b.label !== "Screen size" &&
      b.label !== "Verification" &&
      b.label !== "Audience rating",
  );
  const ranked = [...candidates]
    .sort((a, b) => b.value * b.weight - a.value * a.weight)
    .slice(0, 3);

  // A known top-tier projector carries a small weight, so it never makes the
  // weighted top-3 — but it's a strong trust signal, so surface it explicitly.
  const projector = candidates.find(
    (b) => b.label === "Projector model" && b.value >= 0.9,
  );
  if (projector && !ranked.some((b) => b.label === "Projector model")) {
    ranked.push(projector);
  }

  const parts = ranked
    .filter((b) => b.value >= 0.7)
    .map((b) => {
      switch (b.label) {
        case "DCP resolution":
          return `a ${b.detail} package`;
        case "DCP format":
          return `${b.detail} presentation`;
        case "DCP audio mix":
          return `${b.detail} audio`;
        case "Projection":
          return `${b.detail} projection`;
        case "Projector model":
          return `${b.detail}`;
        case "Sound system":
          return `${b.detail} sound`;
        case "Screen class":
          return `the ${b.detail} screen`;
        case "Aspect match":
          return `a matched ${b.detail} container`;
        case "Pixel density":
          return `sharp ${b.detail}`;
        case "Brightness estimate":
          return `bright ${b.detail}`;
        case "Screen material":
          return `optimal ${b.detail}`;
        default:
          return b.detail;
      }
    });

  if (parts.length === 0) {
    return "A solid all-round presentation for this title.";
  }

  const lead = dcp?.verified ? "Verified " : "";
  const joined =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${lead}${joined} make this the standout choice.`.replace(
    /^([a-z])/,
    (m) => m.toUpperCase(),
  );
}

const hasImax = (value?: string | null) =>
  (value ?? "").toLowerCase().includes("imax");

/**
 * Whether a DCP can physically be presented on a given screen.
 *
 * An IMAX DCP (its `format` array contains "IMAX") can ONLY play on an IMAX
 * screen, so non-IMAX screens are incompatible and must be excluded before
 * scoring. The reverse is fine: an IMAX screen can present a standard DCP — it
 * simply doesn't earn the IMAX format bonus.
 */
export function isCompatible(screen: Screen, dcp: Dcp | null): boolean {
  if (!dcp) return true; // no package info — allow with a neutral score
  const dcpIsImax = dcp.format.some((f) => hasImax(f));
  if (dcpIsImax && !hasImax(screen.screen_format)) return false;
  return true;
}

/** Rank a set of candidate screens for a movie (highest score first). */
export function rankScreens(
  movie: Movie,
  candidates: { screen: Screen; dcp: Dcp | null }[],
) {
  return candidates
    .filter(({ screen, dcp }) => isCompatible(screen, dcp))
    .map(({ screen, dcp }) => ({ screen, dcp, ...scoreScreen(movie, screen, dcp) }))
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      // Clear winner on score.
      if (Math.abs(scoreDiff) > 5) return scoreDiff;
      // DCP-first tiebreak: a verified package beats an unverified/synthetic one
      // when scores are within 5 points.
      const aVerified = a.dcp?.verified ? 1 : 0;
      const bVerified = b.dcp?.verified ? 1 : 0;
      if (aVerified !== bVerified) return bVerified - aVerified;
      return scoreDiff;
    })
    .map((c, i) => ({ ...c, rank: i + 1 }));
}
