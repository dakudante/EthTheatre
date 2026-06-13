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
  "Barco SP4K 25C": { type: "rgb-laser", estimatedLumens: 25000, resolution: "4K", isDciCompliant: true },
  "Barco SP4K 20C": { type: "rgb-laser", estimatedLumens: 20000, resolution: "4K", isDciCompliant: true },
  "Barco SP4K 35 series": { type: "rgb-laser", estimatedLumens: 35000, resolution: "4K", isDciCompliant: true },
  "Barco DP4K 23B": { type: "rgb-laser", estimatedLumens: 23000, resolution: "4K", isDciCompliant: true },
};

// Case-insensitive lookups: live rows store brands in varying casing
// ("BARCO SP4K-55B" vs KB key "Barco SP4K 25C").
const PROJECTOR_KB_LOWER = new Map(
  Object.entries(PROJECTOR_KNOWLEDGE_BASE).map(([k, v]) => [k.toLowerCase(), v]),
);

function getProjectorSpecs(brand: string | null, model: string | null) {
  if (!brand || !model) return null;
  const key = `${brand} ${model}`;
  return (
    PROJECTOR_KNOWLEDGE_BASE[key] ?? PROJECTOR_KB_LOWER.get(key.toLowerCase()) ?? null
  );
}

// ── Screen Brand Knowledge Base ────────────────────────────────────────────
const SCREEN_BRAND_KNOWLEDGE: Record<string, {
  gain: number;
  material: "silver" | "matte-white" | "perlux" | "unknown";
}> = {
  "Harkness Hugo": { gain: 1.4, material: "silver" },
  "Harkness Perlux": { gain: 1.0, material: "matte-white" },
  "Harkness Clarus": { gain: 1.2, material: "matte-white" },
  // Generic fallback — live rows often store just the manufacturer.
  "Harkness": { gain: 1.0, material: "matte-white" },
  "STRONG MDI": { gain: 1.8, material: "silver" },
  "MDI": { gain: 1.5, material: "silver" },
};

const SCREEN_KB_LOWER = new Map(
  Object.entries(SCREEN_BRAND_KNOWLEDGE).map(([k, v]) => [k.toLowerCase(), v]),
);

// KB keys longest-first, so a fuzzy match prefers the most specific entry
// ("STRONG MDI" before the generic "MDI").
const SCREEN_KB_BY_SPECIFICITY = Object.entries(SCREEN_BRAND_KNOWLEDGE).sort(
  (a, b) => b[0].length - a[0].length,
);

function getScreenSpecs(brand: string | null) {
  if (!brand) return null;
  const exact = SCREEN_BRAND_KNOWLEDGE[brand] ?? SCREEN_KB_LOWER.get(brand.toLowerCase());
  if (exact) return exact;
  // Fuzzy: free-text brands like "Imported STRONG MDI Silver Screen" should hit
  // "STRONG MDI" (gain 1.8), not the generic "MDI" (1.5). Match the most
  // specific KB key whose words all appear in the brand string.
  const b = brand.toLowerCase();
  for (const [key, val] of SCREEN_KB_BY_SPECIFICITY) {
    const words = key.toLowerCase().split(/\s+/);
    if (words.every((w) => b.includes(w))) return val;
  }
  return null;
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

/**
 * Entity ids: demo data uses slugs/uuids, the live database uses integer ids,
 * so accept a UUID or a plain numeric string.
 */
export const EntityIdSchema = z.union([
  z.string().uuid(),
  z.string().regex(/^\d+$/, "must be a UUID or numeric id"),
]);

/** Query for "best screens for a movie" (optionally filtered by city/format). */
export const RecommendationQuerySchema = z.object({
  movieId: EntityIdSchema,
  city: z.string().trim().min(1).max(120).optional(),
  format: z.enum(SCREEN_FORMATS).optional(),
});
export type RecommendationQuery = z.infer<typeof RecommendationQuerySchema>;

/** Identifies a single movie × screen (× optional DCP) ranking computation. */
export const RankingParamsSchema = z.object({
  movieId: EntityIdSchema,
  screenId: EntityIdSchema,
  dcpId: EntityIdSchema.optional(),
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
 * V2.0 aspect-ratio compatibility: how well a DCP's container matches the
 * screen's native format, with support for variable-aspect titles (e.g. Dune 2
 * switching IMAX 1.90 ↔ Scope 2.39) and for non-IMAX 1.90:1 movies (e.g.
 * Lokah Chapter 1) which are NOT hardware-exclusive. Returns both the score
 * and a human-readable reason for the breakdown UI.
 */
export function aspectCompatibilityScore(
  dcpContainer: string,
  screenFormat: string,
  screenSpec: string | null,
  isIMAXDcp: boolean, // true if the DCP format array includes "IMAX"
  isVariableAspect: boolean,
  movieAspectRatios: string[],
): { score: number; reason: string } {
  const dcp = (dcpContainer || "").toLowerCase();
  const screen = (screenFormat || "").toLowerCase();
  const spec = (screenSpec || "").toLowerCase();

  // ── IMAX DCP EXCLUSIVITY ──
  // An IMAX-branded DCP must play on IMAX hardware (also gated upstream).
  if (isIMAXDcp && !screen.includes("imax")) {
    return { score: 0, reason: "IMAX DCP requires IMAX projection system" };
  }

  // ── VARIABLE ASPECT RATIO MOVIES ──
  // Only the IMAX variant actually switches ratios mid-film (weighted 70%
  // primary / 30% secondary). A non-IMAX build of the same title ships in a
  // single fixed container, so it must be scored against its OWN container
  // (the dcpContainer passed in), exactly like a non-variable movie.
  if (isIMAXDcp && isVariableAspect && movieAspectRatios.length >= 2) {
    const primary = movieAspectRatios[0]?.toLowerCase() || "";
    const secondary = movieAspectRatios[1]?.toLowerCase() || "";

    const primaryScore = calculateSingleAspectScore(primary, screen, spec, isIMAXDcp);
    const secondaryScore = calculateSingleAspectScore(secondary, screen, spec, isIMAXDcp);

    const weighted = primaryScore.score * 0.7 + secondaryScore.score * 0.3;

    return {
      score: weighted,
      reason: `Variable aspect: ${primaryScore.reason} (70%) + ${secondaryScore.reason} (30%)`,
    };
  }

  // ── SINGLE ASPECT RATIO ──
  return calculateSingleAspectScore(dcp, screen, spec, isIMAXDcp);
}

type ContainerKind =
  | "imax143"
  | "i190"
  | "flat"
  | "scope"
  | "seventy"
  | "ultra"
  | "unknown";

// The dominant container is the marker that appears EARLIEST in the string, not
// the one earliest in a fixed if/else list. So a messy community string like
// "Scope 2.39:1 (open matte 1.90:1 IMAX sections)" classifies as Scope (its
// leading descriptor) rather than IMAX 1.90.
function dominantContainer(dcp: string): ContainerKind {
  const markers: [RegExp, ContainerKind][] = [
    [/1\.43|imax film/, "imax143"],
    [/1\.90|imax digital/, "i190"],
    [/1\.85|flat/, "flat"],
    [/2\.39|2\.40|scope/, "scope"],
    [/2\.20|70mm/, "seventy"],
    [/2\.76|ultra|cinerama/, "ultra"],
  ];
  let best: ContainerKind = "unknown";
  let bestIdx = Infinity;
  for (const [re, kind] of markers) {
    const m = re.exec(dcp);
    if (m && m.index < bestIdx) {
      bestIdx = m.index;
      best = kind;
    }
  }
  return best;
}

function calculateSingleAspectScore(
  dcpContainer: string,
  screenFormat: string,
  screenSpec: string | null,
  isIMAXDcp: boolean,
): { score: number; reason: string } {
  const dcp = dcpContainer.toLowerCase();
  const screen = screenFormat.toLowerCase();
  const spec = (screenSpec || "").toLowerCase();

  switch (dominantContainer(dcp)) {
    // ── IMAX 1.43:1 (70mm film aperture) ──
    case "imax143":
      if (screen.includes("imax 70mm") || spec.includes("70mm"))
        return { score: 1.0, reason: "IMAX 70mm film aperture — full frame" };
      if (screen.includes("imax"))
        return { score: 0.6, reason: "IMAX 1.43 DCP cropped to 1.90 digital" };
      return { score: 0.1, reason: "Severe cropping on non-IMAX screen" };

    // ── 1.90:1 (IMAX digital OR a tall non-IMAX ratio) ──
    case "i190":
      if (isIMAXDcp) {
        // IMAX-branded 1.90:1 — IMAX screen preferred.
        if (screen.includes("imax"))
          return { score: 1.0, reason: "IMAX digital on IMAX screen" };
        if (screen.includes("flat"))
          return { score: 0.75, reason: "Minor letterboxing on Flat screen" };
        if (screen.includes("scope"))
          return { score: 0.45, reason: "Significant pillarboxing on Scope screen" };
        return { score: 0.6, reason: "Standard screen" };
      }
      // NON-IMAX 1.90:1 (e.g. Lokah Chapter 1, Manjummel Boys) — just a tall
      // Flat-adjacent ratio, not hardware-exclusive.
      if (screen.includes("imax") && !screen.includes("70mm"))
        return { score: 1.0, reason: "Perfect fit on IMAX digital screen" };
      if (screen.includes("flat"))
        return { score: 0.95, reason: "Near-perfect fit on Flat screen (1.90 vs 1.85)" };
      if (screen.includes("scope"))
        return { score: 0.5, reason: "Pillarboxing on Scope screen" };
      return { score: 0.7, reason: "Standard screen" };

    // ── Flat 1.85:1 ──
    case "flat":
      if (screen.includes("flat"))
        return { score: 1.0, reason: "Flat DCP on Flat screen — perfect fit" };
      if (screen.includes("scope"))
        return { score: 0.5, reason: "Pillarboxing on Scope screen (22% image loss)" };
      if (screen.includes("imax") && !screen.includes("70mm"))
        return { score: 0.75, reason: "Minor letterboxing on IMAX digital" };
      return { score: 0.6, reason: "Standard screen" };

    // ── Scope 2.39:1 ──
    case "scope":
      if (screen.includes("scope"))
        return { score: 1.0, reason: "Scope DCP on Scope screen — perfect fit" };
      if (screen.includes("flat"))
        return { score: 0.5, reason: "Letterboxing on Flat screen (25% image loss)" };
      if (screen.includes("imax") && !screen.includes("70mm"))
        return { score: 0.65, reason: "Moderate letterboxing on IMAX digital" };
      return { score: 0.6, reason: "Standard screen" };

    // ── 70mm / 2.20:1 ──
    case "seventy":
      if (screen.includes("70mm") || spec.includes("70mm"))
        return { score: 1.0, reason: "70mm on 70mm screen" };
      if (screen.includes("scope"))
        return { score: 0.85, reason: "Minor letterboxing on Scope" };
      if (screen.includes("flat"))
        return { score: 0.6, reason: "Moderate letterboxing on Flat" };
      return { score: 0.7, reason: "Standard screen" };

    // ── Ultra-wide 2.76:1 (Cinerama / Ultra Panavision) ──
    case "ultra":
      if (screen.includes("scope"))
        return { score: 0.85, reason: "Best standard fit — slight letterboxing" };
      if (screen.includes("flat"))
        return { score: 0.35, reason: "Severe letterboxing on Flat" };
      if (screen.includes("imax"))
        return { score: 0.4, reason: "Significant letterboxing" };
      return { score: 0.6, reason: "Standard screen" };

    // ── Missing / unrecognised container → neutral ──
    default:
      return { score: 0.6, reason: "Unknown container match" };
  }
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
  // Scope and Flat are both plain containers — neither class is inherently
  // better; fit with the DCP is judged by the aspect-match factor instead.
  if (v.includes("scope") || v.includes("flat"))
    return { value: 0.6, accent: "neutral" };
  return { value: 0.5, accent: "neutral" };
}

// Score by screen width (feet). Prefers the structured numeric column; falls
// back to the largest number in any free-text spec/dimensions string.
function screenSizeScore(
  widthFt?: number | null,
  spec?: string | null,
): number {
  let width = widthFt ?? 0;
  if (!width && spec) {
    const nums = spec.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
    width = Math.max(0, ...nums);
  }
  if (!width) return 0.45;
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

  // ── Aspect-fit multiplier: gate hardware bonuses on picture shape ──
  // Brightness/sharpness of the WRONG frame shape is not "better": a top-tier
  // projector on a pillarboxed screen must not out-bonus a correctly fitted
  // average screen. 1.0 fit → full bonus, 0.5 fit → half, floored at 0.3
  // (a mismatched screen is still a functioning room). Stays 1 when no DCP.
  let aspectFitMultiplier = 1;

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

    const isIMAXDcp = dcp.format.some((f) => f.toLowerCase().includes("imax"));
    const aspectResult = aspectCompatibilityScore(
      dcp.aspect_ratio_container,
      screen.screen_format,
      screen.screen_spec,
      isIMAXDcp,
      movie.is_variable_aspect,
      movie.aspect_ratio_variants,
    );
    push({
      label: "Aspect match",
      detail: aspectResult.reason,
      value: aspectResult.score,
      weight: WEIGHTS.dcpAspectCompatibility,
      accent:
        aspectResult.score >= 0.9
          ? "premium"
          : aspectResult.score >= 0.6
            ? "neutral"
            : "imax",
    });
    aspectFitMultiplier = Math.max(0.3, aspectResult.score);

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

  const sizeText = screen.screen_spec ?? screen.screen_dimensions;
  const size = screenSizeScore(screen.screen_width_ft, sizeText);
  push({
    label: "Screen size",
    detail: sizeText ?? "Not specified",
    value: size,
    weight: WEIGHTS.hwScreenSize,
  });
  // ── Enhanced hardware bonuses (only if data available) ──
  // All four are gated by aspectFitMultiplier: premium hardware showing the
  // wrong frame shape must not out-bonus a correctly fitted average screen.
  if (projectorSpecs) {
    push({
      label: "Projector model",
      detail: `${screen.projector_brand} ${screen.projector_model}`,
      value: projectorSpecBonus * aspectFitMultiplier,
      weight: 0.03,
      accent: projectorSpecBonus >= 0.9 ? "premium" : "neutral",
    });
  }

  if (screenSpecs && dcp) {
    push({
      label: "Screen material",
      detail: `${screen.screen_brand} (${screenSpecs.material}, gain ${screenSpecs.gain})`,
      value: screenGainMatch * aspectFitMultiplier,
      weight: 0.03,
      accent: screenGainMatch >= 0.9 ? "premium" : "neutral",
    });
  }

  if (projectorSpecs && screenDims) {
    push({
      label: "Pixel density",
      detail: `${projectorSpecs.resolution} on ${screenDims.widthFt}ft screen`,
      value: pixelDensityAdequacy * aspectFitMultiplier,
      weight: 0.04,
      accent: pixelDensityAdequacy >= 0.9 ? "premium" : "neutral",
    });
  }

  if (projectorSpecs && screenDims && screenSpecs) {
    push({
      label: "Brightness estimate",
      detail: `${projectorSpecs.estimatedLumens}lm × ${screenSpecs.gain} gain / ${Math.round(screenDims.areaSqFt)}sqft`,
      value: brightnessEstimate * aspectFitMultiplier,
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
          // Detail is already a readable phrase, e.g. "Scope DCP on Scope
          // screen — perfect fit".
          return b.detail.toLowerCase().replace(/ — /g, ", ");
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

/**
 * Like rankScreens, but for candidate lists where a screen may appear once per
 * compatible DCP variant: keeps only each screen's best-scoring assignment,
 * then re-ranks 1..N.
 */
export function rankScreensDeduped(
  movie: Movie,
  candidates: { screen: Screen; dcp: Dcp | null }[],
) {
  const all = rankScreens(movie, candidates);
  const best = new Map<string, (typeof all)[number]>();
  for (const result of all) {
    const existing = best.get(result.screen.id);
    if (!existing || result.score > existing.score) {
      best.set(result.screen.id, result);
    }
  }
  return Array.from(best.values())
    .sort((a, b) => b.score - a.score)
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

// ── DCP variant grouping (BMS-style per-presentation sections) ──────────────

/** Canonical label for a DCP variant used as a tab/section heading. */
export function dcpVariantLabel(dcp: Dcp): string {
  const formats = dcp.format.map((f) => f.toLowerCase());
  const isImax = formats.some((f) => f.includes("imax"));
  const is3D = formats.some((f) => f === "3d");
  const isDolbyVision = formats.some(
    (f) => f.includes("dolby vision") || f.includes("hdr"),
  );
  const res = (dcp.resolution ?? "").toUpperCase().includes("4K") ? "4K" : "2K";
  const audio = dcp.audio_mix ?? "";
  if (isImax && is3D) return `IMAX 3D · ${res} · ${audio}`;
  if (isImax) return `IMAX 2D · ${res} · ${audio}`;
  if (is3D) return `3D · ${res} · ${audio}`;
  if (isDolbyVision) return `Dolby Vision 2D · ${res} · ${audio}`;
  return `Standard 2D · ${res} · ${audio}`;
}

/** Priority tier for sorting variant tabs (lower = shown first / best). */
export function dcpVariantTier(dcp: Dcp): number {
  const formats = dcp.format.map((f) => f.toLowerCase());
  const isImax = formats.some((f) => f.includes("imax"));
  const is3D = formats.some((f) => f === "3d");
  const res4K = (dcp.resolution ?? "").toLowerCase().includes("4k");
  const audio = (dcp.audio_mix ?? "").toLowerCase();
  const hasAtmos = audio.includes("atmos");
  const hasDtsX = audio.includes("dts") && audio.includes("x");
  const hasImax12ch = audio.includes("imax") && audio.includes("12");

  if (isImax && !is3D && hasImax12ch) return 1; // IMAX 2D 12-channel (best)
  if (isImax && !is3D) return 2; // IMAX 2D
  if (isImax && is3D) return 3; // IMAX 3D
  if (!is3D && res4K && hasAtmos) return 4; // 4K Laser Atmos
  if (!is3D && res4K && hasDtsX) return 5; // 4K DTS-X
  if (!is3D && res4K) return 6; // 4K 7.1 / 5.1
  if (!is3D && hasAtmos) return 7; // 2K Atmos
  if (!is3D && hasDtsX) return 8; // 2K DTS-X
  if (!is3D) return 9; // 2K standard
  if (is3D && res4K && hasAtmos) return 10; // 4K 3D Atmos
  if (is3D && res4K) return 11; // 4K 3D
  if (is3D) return 12; // 2K 3D
  return 99;
}

/** Group and rank screens by DCP variant, sorted best-variant-first. */
export function rankByVariants(
  movie: Movie,
  candidates: { screen: Screen; dcp: Dcp | null }[],
): {
  dcp: Dcp;
  label: string;
  tier: number;
  ranked: ReturnType<typeof rankScreens>;
}[] {
  const groups = new Map<
    string,
    { dcp: Dcp; screens: { screen: Screen; dcp: Dcp }[] }
  >();
  for (const c of candidates) {
    if (!c.dcp) continue;
    const key = c.dcp.id;
    if (!groups.has(key)) groups.set(key, { dcp: c.dcp, screens: [] });
    groups.get(key)!.screens.push({ screen: c.screen, dcp: c.dcp });
  }
  return Array.from(groups.values())
    .map(({ dcp, screens }) => ({
      dcp,
      label: dcpVariantLabel(dcp),
      tier: dcpVariantTier(dcp),
      ranked: rankScreens(movie, screens),
    }))
    .sort((a, b) => a.tier - b.tier);
}
