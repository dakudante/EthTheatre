import { z } from "zod";
import projectorKb from "./projector-kb.json";
import screenKb from "./screen-kb.json";

// ── Projector Knowledge Base ───────────────────────────────────────────────
type ProjectorSpec = {
  type: "rgb-laser" | "phosphor-laser" | "xenon" | "unknown";
  estimatedLumens: number;
  resolution: "4K" | "2K";
  isDciCompliant: boolean;
};

const PROJECTOR_KNOWLEDGE_BASE = projectorKb as Record<string, ProjectorSpec>;

// Case-insensitive lookups: live rows store brands in varying casing
// ("BARCO SP4K-55B" vs KB key "Barco SP4K 25C").
const PROJECTOR_KB_LOWER = new Map(
  Object.entries(PROJECTOR_KNOWLEDGE_BASE).map(([k, v]) => [k.toLowerCase(), v]),
);

function medianByLumens(entries: ProjectorSpec[]): ProjectorSpec | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => a.estimatedLumens - b.estimatedLumens);
  return sorted[Math.floor(sorted.length / 2)];
}

function getProjectorSpecs(brand: string | null, model: string | null): ProjectorSpec | null {
  if (!brand && !model) return null;

  const b = (brand ?? "").toLowerCase();
  const m = (model ?? "").toLowerCase();

  if (brand && model) {
    const key = `${brand} ${model}`;
    const exact = PROJECTOR_KNOWLEDGE_BASE[key] ?? PROJECTOR_KB_LOWER.get(key.toLowerCase());
    if (exact) return exact;
  } else if (brand) {
    const matches = Object.entries(PROJECTOR_KNOWLEDGE_BASE)
      .filter(([key]) => key.toLowerCase().startsWith(b))
      .map(([, v]) => v);
    const med = medianByLumens(matches);
    if (med) return med;
  } else if (model) {
    const matches = Object.entries(PROJECTOR_KNOWLEDGE_BASE)
      .filter(([key]) => key.toLowerCase().includes(m))
      .map(([, v]) => v);
    const med = medianByLumens(matches);
    if (med) return med;
  }

  // Fuzzy fallback: match broad projector categories when KB has no exact entry
  const t = `${brand ?? ""} ${model ?? ""}`.trim().toLowerCase();
  if (t.includes('rgb') && t.includes('laser'))
    return { type: 'rgb-laser', estimatedLumens: 25000,
             resolution: '4K', isDciCompliant: true };
  if (t.includes('laser') && t.includes('4k'))
    return { type: 'phosphor-laser', estimatedLumens: 20000,
             resolution: '4K', isDciCompliant: true };
  if (t.includes('xenon'))
    return { type: 'xenon', estimatedLumens: 15000,
             resolution: (t.includes('4k') ? '4K' : '2K') as '4K' | '2K',
             isDciCompliant: true };
  return null;
}

// ── Screen Brand Knowledge Base ────────────────────────────────────────────
type ScreenSpec = {
  gain: number;
  material: "silver" | "matte-white" | "perlux" | "unknown";
};

const SCREEN_BRAND_KNOWLEDGE = screenKb as Record<string, ScreenSpec>;

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
  const match = dimensions.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|')?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|')?/i);
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

// ── V2 Adaptive Weight System ─────────────────────────────────────────────

// When DCPs differ → DCP quality dominates (the file matters most)
const DCP_DOMINANT = { dcp: 0.55, aspect: 0.15, hw: 0.25, crowd: 0.05 };
// When DCPs are identical → hardware dominates (the room matters most)
const HW_DOMINANT  = { dcp: 0.15, aspect: 0.20, hw: 0.50, crowd: 0.10 };

function stddev(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length);
}

function adaptiveWeights(dcpSpread: number) {
  // alpha: 0 = identical DCPs, 1 = highly varied DCPs
  // threshold 0.15: beyond this spread, DCP differences are "significant"
  const alpha = Math.min(1, dcpSpread / 0.15);
  return {
    dcp:    alpha * DCP_DOMINANT.dcp    + (1 - alpha) * HW_DOMINANT.dcp,
    aspect: alpha * DCP_DOMINANT.aspect + (1 - alpha) * HW_DOMINANT.aspect,
    hw:     alpha * DCP_DOMINANT.hw     + (1 - alpha) * HW_DOMINANT.hw,
    crowd:  alpha * DCP_DOMINANT.crowd  + (1 - alpha) * HW_DOMINANT.crowd,
  };
}

// ── Hardware sub-weights (within the hardware portion) ────────────────────
const HW_SUB = {
  projection:  0.25,   // projector type + lumens (broad)
  projectorModel: 0.05, // specific projector model bonus (KB-based)
  screenReal:  0.30,   // size + pixel density + brightness (merged)
  sound:       0.25,   // sound system hardware
  material:    0.15,   // screen gain + material match
};


function resolutionScore(res?: string | null): number {
  const v = (res ?? "").toLowerCase();
  if (v.includes("8k")) return 1;
  if (v.includes("4k")) return 0.9;
  // IMAX 2K is higher quality than standard 2K
  if (v.includes("imax") && v.includes("2k")) return 0.70;
  if (v.includes("2k")) return 0.55;
  return 0.4;
}

function formatScore(dcpFormats: string[]): number {
  const set = new Set(dcpFormats.map((f) => f.toLowerCase()));
  let s = 0.4; // baseline 2D digital
  if (set.has("hdr") || set.has("dolby vision")) s += 0.3;
  if (set.has("hfr")) s += 0.15;
  if (set.has("3d")) s += 0.1;
  if (set.has("imax")) s += 0.30;
  // BUG 8 FIX: Removed IMAX cross-check — with the isCompatible() DCP gate,
  // an IMAX screen without an IMAX DCP is already excluded; this bonus was
  // redundant and inflated IMAX scores over equivalent HDR screens.
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
  isIMAXDcp: boolean,
  isVariableAspect: boolean,
  movieAspectRatios: string[],
): { score: number; reason: string } {
  const screen = (screenFormat || "").toLowerCase();

  // ── IMAX DCP EXCLUSIVITY ──
  // An IMAX-branded DCP must play on IMAX hardware (also gated upstream).
  if (isIMAXDcp && !screen.includes("imax")) {
    return { score: 0, reason: "IMAX DCP requires IMAX projection system" };
  }

  // ── VARIABLE ASPECT RATIO MOVIES ──
  // BUG 7 FIX: Hard override — Scope screen must be LAST for movies that
  // combine wide (2.39) and flat (1.85) ratios, because 1.85 content
  // pillarboxes badly on Scope regardless of the weighted average.
  if (isVariableAspect) {
    const ratios = movieAspectRatios.map(r => r.toLowerCase());
    const hasWide = ratios.some(r =>
      r.includes('2.39') || r.includes('scope'));
    const hasFlat = ratios.some(r =>
      r.includes('1.85') || r.includes('flat'));
    if (hasWide && hasFlat && screen.includes('scope'))
      return { score: 0.05, reason: 'Scope last — 1.85 content pillarboxes on Scope' };
  }

  // Only the IMAX variant actually switches ratios mid-film (weighted 85%
  // primary / 15% secondary). A non-IMAX build of the same title ships in a
  // single fixed container, so it must be scored against its OWN container
  // (the dcpContainer passed in), exactly like a non-variable movie.
  if (isIMAXDcp && isVariableAspect && movieAspectRatios.length >= 2) {
    const primary = movieAspectRatios[0]?.toLowerCase() || "";
    const secondary = movieAspectRatios[1]?.toLowerCase() || "";

    const primaryScore = calculateSingleAspectScore(primary, screenFormat, screenSpec);
    const secondaryScore = calculateSingleAspectScore(secondary, screenFormat, screenSpec);

    const weighted = primaryScore.score * 0.85 + secondaryScore.score * 0.15;

    return {
      score: weighted,
      reason: `Variable aspect: ${primaryScore.reason} (85%) + ${secondaryScore.reason} (15%)`,
    };
  }

  // ── SINGLE ASPECT RATIO ──
  return calculateSingleAspectScore(dcpContainer, screenFormat, screenSpec);
}

// ── BUG 1 FIX: Table-driven aspect priority lookup ─────────────────────────

// Screen format classification: map free-text screen_format strings to a
// canonical screen category used as the column key in ASPECT_PRIORITY.
type ScreenCategory = 'imax_70mm' | 'imax' | 'flat' | 'scope' | '70mm' | 'standard';

function classifyScreenFormat(
  screenFormat: string,
  screenSpec: string | null,
): ScreenCategory {
  const sf = screenFormat.toLowerCase();
  const sp = (screenSpec ?? "").toLowerCase();

  if (sf.includes("imax") && (sf.includes("70mm") || sp.includes("70mm"))) return "imax_70mm";
  if (sf.includes("imax")) return "imax";

  // EPIQ and PXL are 1.89:1 screens — treat as Flat per cine-enthusist logic.
  // When PXL scope variants arrive later, check for scope tag first.
  if (sf.includes("epiq")) return "flat";
  if (sf.includes("pxl")) return sf.includes("scope") ? "scope" : "flat";

  if (sf.includes("flat")) return "flat";
  if (sf.includes("scope")) return "scope";

  // Non-IMAX 70mm film screens
  if ((sf.includes("70mm") || sp.includes("70mm")) && !sf.includes("imax")) return "70mm";

  // Dolby, 4DX, untagged premium → standard (neutral)
  return "standard";
}

// Ratio key extraction: pull the dominant ratio from a DCP container string.
type RatioKey = '1.33' | '1.43' | '1.50' | '1.85' | '1.90' | '2.20' | '2.39' | '2.76' | 'unknown';

function resolveRatioKey(dcpContainer: string): RatioKey {
  const dcp = dcpContainer.toLowerCase();
  const markers: [RegExp, RatioKey][] = [
    [/1\.43|imax film/, '1.43'],
    [/1\.50/, '1.50'],
    [/1\.33|academy/, '1.33'],
    [/1\.90|imax digital/, '1.90'],
    [/1\.85|flat/, '1.85'],
    [/2\.39|2\.40|scope/, '2.39'],
    [/2\.20|70mm/, '2.20'],
    [/2\.76|ultra|cinerama/, '2.76'],
  ];
  let best: RatioKey = 'unknown';
  let bestIdx = Infinity;
  for (const [re, key] of markers) {
    const m = re.exec(dcp);
    if (m && m.index < bestIdx) {
      bestIdx = m.index;
      best = key;
    }
  }
  // REMOVED: the line that converted non-IMAX 1.90 to 1.85
  return best;
}

// The priority table: ASPECT_PRIORITY[ratioKey][screenCategory] → { score, reason }
const ASPECT_PRIORITY: Record<RatioKey, Record<ScreenCategory, { score: number; reason: string }>> = {
  // 2.39:1 / 2.40:1 / 2.35:1 (Scope) → Scope > 70mm > Flat > IMAX > IMAX 70mm
  '2.39': {
    scope:     { score: 1.00, reason: 'Scope DCP on Scope screen — native fit, full screen used' },
    '70mm':    { score: 0.80, reason: '70mm screen (2.20:1) close to Scope — minimal letterboxing' },
    flat:      { score: 0.55, reason: 'Letterboxing on Flat screen (~22% bars top/bottom)' },
    imax:      { score: 0.30, reason: 'Letterboxing on IMAX digital (~20% bars in 1.90 frame)' },
    imax_70mm: { score: 0.10, reason: 'Heavy letterboxing — 1.43 IMAX frame too tall for wide content' },
    standard:  { score: 0.50, reason: 'Standard screen — letterboxed' },
  },
  // 2.76:1 (Ultra Panavision / Cinerama) → Scope > 70mm > Flat > IMAX > IMAX 70mm
  '2.76': {
    scope:     { score: 1.00, reason: 'Scope screen — best standard fit for ultra-wide content' },
    '70mm':    { score: 0.80, reason: '70mm screen close to ultra-wide — moderate letterboxing' },
    flat:      { score: 0.55, reason: 'Heavy letterboxing on Flat screen' },
    imax:      { score: 0.30, reason: 'Heavy letterboxing on IMAX digital' },
    imax_70mm: { score: 0.10, reason: 'Extreme letterboxing on IMAX 70mm' },
    standard:  { score: 0.50, reason: 'Standard screen' },
  },
  // 1.85:1 (Flat) → Flat > IMAX > 70mm > Scope > IMAX 70mm
  '1.85': {
    flat:      { score: 1.00, reason: 'Flat DCP on Flat screen — native fit, full screen used' },
    imax:      { score: 0.80, reason: 'Near-perfect on IMAX digital (1.90 vs 1.85 — ~2.6% bars)' },
    '70mm':    { score: 0.55, reason: 'Pillarboxing on 70mm screen (2.20 too wide — ~15% bars on sides)' },
    scope:     { score: 0.30, reason: 'Pillarboxing on Scope screen (2.39 — ~22% image loss on sides)' },
    imax_70mm: { score: 0.10, reason: 'Flat content pillarboxed within tall 1.43 IMAX frame' },
    standard:  { score: 0.50, reason: 'Standard screen' },
  },
  // 1.90:1 (IMAX digital + non-IMAX) → IMAX > Flat > IMAX 70mm > 70mm > Scope
  '1.90': {
    imax:      { score: 1.00, reason: '1.90 content on IMAX digital — native fit' },
    flat:      { score: 0.80, reason: 'Near-perfect on Flat screen (1.85 vs 1.90 — ~2.6% bars)' },
    imax_70mm: { score: 0.55, reason: 'Letterboxed within tall 1.43 IMAX frame (~25% bars)' },
    '70mm':    { score: 0.30, reason: 'Pillarboxing on 70mm screen (2.20 too wide — ~13.6% bars)' },
    scope:     { score: 0.10, reason: 'Significant pillarboxing on Scope (2.39 — ~20% bars on sides)' },
    standard:  { score: 0.50, reason: 'Standard screen' },
  },
  // 1.43:1 (IMAX film) → IMAX 70mm > IMAX > Flat > 70mm > Scope
  '1.43': {
    imax_70mm: { score: 1.00, reason: 'IMAX 70mm film aperture — full 1.43 frame, native' },
    imax:      { score: 0.80, reason: 'IMAX 1.43 on digital — cropped to 1.90, still excellent' },
    flat:      { score: 0.55, reason: 'Pillarboxing on Flat screen (1.85 wider than 1.43 content)' },
    '70mm':    { score: 0.30, reason: 'Significant pillarboxing on 70mm screen (2.20 much wider)' },
    scope:     { score: 0.10, reason: 'Severe pillarboxing on Scope (2.39 vs 1.43 — ~40% bars)' },
    standard:  { score: 0.50, reason: 'Standard screen' },
  },
  // 1.33:1 (Academy) → IMAX 70mm > IMAX > Flat > 70mm > Scope
  '1.33': {
    imax_70mm: { score: 1.00, reason: 'Tall IMAX 70mm frame suits classic 1.33 Academy ratio' },
    imax:      { score: 0.80, reason: 'IMAX digital accommodates 1.33 with manageable pillarboxing' },
    flat:      { score: 0.55, reason: 'Moderate pillarboxing on Flat (1.85 vs 1.33 — ~28% bars)' },
    '70mm':    { score: 0.30, reason: 'Significant pillarboxing on 70mm (2.20 too wide)' },
    scope:     { score: 0.10, reason: 'Extreme pillarboxing on Scope (2.39 vs 1.33 — ~44% bars)' },
    standard:  { score: 0.50, reason: 'Standard screen' },
  },
  // 1.50:1 → IMAX 70mm > IMAX > Flat > 70mm > Scope
  '1.50': {
    imax_70mm: { score: 1.00, reason: 'Tall IMAX 70mm frame suits 1.50 ratio well' },
    imax:      { score: 0.80, reason: 'IMAX digital (1.90) handles 1.50 with moderate pillarboxing' },
    flat:      { score: 0.55, reason: 'Moderate pillarboxing on Flat (1.85 vs 1.50 — ~19% bars)' },
    '70mm':    { score: 0.30, reason: 'Pillarboxing on 70mm (2.20 too wide — ~32% bars)' },
    scope:     { score: 0.10, reason: 'Significant pillarboxing on Scope (2.39 — ~37% bars)' },
    standard:  { score: 0.50, reason: 'Standard screen' },
  },
  // 2.20:1 (70mm film) — proximity-based defaults
  '2.20': {
    imax_70mm: { score: 1.00, reason: 'IMAX 70mm can run native 70mm print — perfect' },
    '70mm':    { score: 0.95, reason: '70mm content on 70mm screen — native fit' },
    scope:     { score: 0.75, reason: 'Good fit on Scope (2.39 vs 2.20 — only ~8% bars)' },
    imax:      { score: 0.55, reason: 'Pillarboxing on IMAX digital (1.90 vs 2.20 — ~14% bars)' },
    flat:      { score: 0.45, reason: 'Pillarboxing on Flat (1.85 vs 2.20 — ~16% bars)' },
    standard:  { score: 0.55, reason: 'Standard screen' },
  },
  unknown: {
    imax_70mm: { score: 0.60, reason: 'Unknown container match' },
    imax:      { score: 0.60, reason: 'Unknown container match' },
    flat:      { score: 0.60, reason: 'Unknown container match' },
    scope:     { score: 0.60, reason: 'Unknown container match' },
    '70mm':    { score: 0.60, reason: 'Unknown container match' },
    standard:  { score: 0.60, reason: 'Unknown container match' },
  },
};

function calculateSingleAspectScore(
  dcpContainer: string,
  screenFormat: string,
  screenSpec: string | null,
): { score: number; reason: string } {
  const ratioKey = resolveRatioKey(dcpContainer);
  const screenCat = classifyScreenFormat(screenFormat, screenSpec);
  return ASPECT_PRIORITY[ratioKey]?.[screenCat] ?? { score: 0.60, reason: 'Unknown screen category — neutral score' };
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

function projectionScore(proj?: string | null, brand?: string | null, model?: string | null): number {
  const v = (proj ?? "").toLowerCase();
  if (v.includes("rgb") && v.includes("laser")) return 1;
  if (v.includes("4k") && v.includes("laser")) return 0.9;
  if (v.includes("4k")) return 0.78;
  if (v.includes("2k") && v.includes("laser")) return 0.62;
  if (v.includes("2k")) return 0.5;
  if (v.includes("laser")) return 0.7;
  if (v.includes("xenon")) return 0.5;
  // KB fallback: if free-text is unrecognizable (e.g., model name), look up KB
  const kb = getProjectorSpecs(brand, model);
  if (kb) {
    if (kb.type === "rgb-laser") return 1;
    if (kb.type === "phosphor-laser") return 0.85;
    if (kb.type === "xenon") return 0.6;
    return 0.7;
  }
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

export function screenClassScore(format?: string | null): {
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
  // BUG 2 FIX: Scope and Flat equalized — both are plain container shapes,
  // neither inherently "better". Fit is judged by the aspect-match factor.
  if (v.includes("scope")) return { value: 0.55, accent: "neutral" };
  return { value: 0.55, accent: "neutral" };
}

// Score by screen width (feet). Prefers the structured numeric column; falls
// back to the largest number in any free-text spec/dimensions string.
export function screenSizeScore(
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

function screenRealEstateScoreDetails(screen: Screen) {
  let dims = parseScreenDimensions(screen.screen_dimensions);
  if (!dims && screen.screen_spec) {
    dims = parseScreenDimensions(screen.screen_spec);
  }
  if (!dims && screen.screen_width_ft && screen.screen_height_ft) {
    dims = {
      widthFt: screen.screen_width_ft,
      heightFt: screen.screen_height_ft,
      areaSqFt: screen.screen_width_ft * screen.screen_height_ft,
    };
  }
  const projSpecs = getProjectorSpecs(screen.projector_brand, screen.projector_model);
  const scrSpecs = getScreenSpecs(screen.screen_brand);

  if (!dims) {
    return {
      score: 0.45,
      sizeScore: 0.45,
      densityScore: 0.45,
      brightnessScore: 0.45,
      dims: null,
      projSpecs,
      scrSpecs,
    };
  }

  // Size score (continuous, not stepped)
  // 90+ ft = 1.0, 20 ft = 0.3, logarithmic curve
  const sizeScore = Math.max(0.1, Math.min(1, 0.3 + 0.7 * Math.log(dims.widthFt / 20) / Math.log(90 / 20)));

  // Pixel density bonus (0..1)
  let densityScore = 0.7;
  if (projSpecs) {
    const resWidth = projSpecs.resolution === "4K" ? 4096 : 2048;
    const pxPerFt = resWidth / dims.widthFt;
    densityScore = pxPerFt >= 80 ? 1.0 : pxPerFt >= 50 ? 0.9 : pxPerFt >= 30 ? 0.75 : 0.5;
  }

  // Brightness bonus (0..1)
  let brightnessScore = 0.7;
  if (projSpecs && scrSpecs) {
    const areaSqM = dims.areaSqFt * 0.0929;
    const nits = (projSpecs.estimatedLumens * scrSpecs.gain) / (areaSqM * Math.PI);
    brightnessScore = nits >= 100 ? 1.0 : nits >= 60 ? 0.9 : nits >= 40 ? 0.75 : nits >= 25 ? 0.55 : 0.35;
  }

  // Weighted composite — size is dominant, density and brightness are multipliers
  const score = sizeScore * 0.50 + densityScore * 0.25 + brightnessScore * 0.25;
  return { score, sizeScore, densityScore, brightnessScore, dims, projSpecs, scrSpecs };
}

export function screenRealEstateScore(screen: Screen, dcp: Dcp | null): number {
  void dcp;
  return screenRealEstateScoreDetails(screen).score;
}

export function screenMaterialScore(screen: Screen, dcp: Dcp | null): number {
  const screenSpecs = getScreenSpecs(screen.screen_brand);
  if (!screenSpecs || !dcp) return 0.5; // neutral fallback
  const is3D = dcp.format.some(f => f.toLowerCase().includes("3d"));
  if (is3D) {
    return screenSpecs.material === "silver" ? 1.0 : 0.4;
  } else {
    return screenSpecs.material === "silver" ? 0.7 : 1.0;
  }
}

/**
 * V2: Score all candidate screens together so adaptive weighting can
 * measure DCP variance across the set. Returns scored screens in
 * descending order.
 */
export function scoreScreens(
  movie: Movie,
  candidates: Array<{ screen: Screen; dcp: Dcp | null }>,
): Array<ScoredScreen & { screen: Screen; dcp: Dcp | null }> {
  // Phase 1: Compute raw DCP quality for each candidate
  const rawDcp = candidates.map(({ dcp }) => {
    if (!dcp) return 0.3; // unknown DCP = low floor
    const res = resolutionScore(dcp.resolution);
    const fmt = formatScore(dcp.format);
    const aud = audioScore(dcp.audio_mix);
    const ver = dcp.verified ? 1.0 : 0.6;
    return res * 0.40 + fmt * 0.11 + aud * 0.24 + ver * 0.10;
  });

  // Phase 2: Compute DCP spread and adaptive weights
  const spread = stddev(rawDcp);
  const W = adaptiveWeights(spread);

  // Phase 3: Score each screen with adaptive weights
  return candidates.map(({ screen, dcp }, i) => {
    const breakdown: ScoreBreakdown[] = [];
    const push = (
      b: Omit<ScoreBreakdown, "accent"> & { accent?: ScoreBreakdown["accent"] },
    ) => breakdown.push({ accent: "neutral", ...b });

    // DCP composite (already computed)
    const dcpScore = rawDcp[i];

    // Aspect fit
    const isIMAXDcp = dcp?.format.some(f => f.toLowerCase().includes('imax')) ?? false;
    const aspectResult = aspectCompatibilityScore(
      dcp?.aspect_ratio_container ?? '',
      screen.screen_format,
      screen.screen_spec,
      isIMAXDcp,
      movie.is_variable_aspect,
      movie.aspect_ratio_variants,
    );

    // Hardware composite (5 sub-scores with fixed internal weights)
    const proj = projectionScore(screen.projection_system, screen.projector_brand, screen.projector_model);
    const snd = soundHardwareScore(screen.sound_system);
    const reDetails = screenRealEstateScoreDetails(screen);
    const realEstate = reDetails.score;
    const material = screenMaterialScore(screen, dcp);

    const projectorSpecs = getProjectorSpecs(screen.projector_brand, screen.projector_model);
    const projectorModelBonus = projectorSpecs
      ? (projectorSpecs.type === "rgb-laser" ? 1.0
         : projectorSpecs.type === "phosphor-laser" ? 0.85
         : projectorSpecs.type === "xenon" ? 0.6
         : 0.5)
      : 0.5;

    const hwScore = (
      proj * HW_SUB.projection +
      projectorModelBonus * HW_SUB.projectorModel +
      realEstate * HW_SUB.screenReal +
      snd * HW_SUB.sound +
      material * HW_SUB.material
    );

    // Crowd
    const crowdScore = screen.user_rating != null
      ? screen.user_rating / 5
      : 0.5;

    // Final adaptive-weighted score
    const raw = (
      dcpScore * W.dcp +
      aspectResult.score * W.aspect +
      hwScore * W.hw +
      crowdScore * W.crowd
    );
    const score = Math.round(Math.min(100, raw * 100) * 10) / 10;

    // Populate breakdown array
    if (dcp) {
      const res = resolutionScore(dcp.resolution);
      push({
        label: "DCP resolution",
        detail: dcp.resolution,
        value: res,
        weight: W.dcp * 0.40,
        accent: res >= 0.9 ? "premium" : "neutral",
      });

      const fmt = formatScore(dcp.format);
      push({
        label: "DCP format",
        detail: dcp.format.length ? dcp.format.join(", ") : "2D",
        value: fmt,
        weight: W.dcp * 0.11,
        accent: fmt >= 0.7 ? "premium" : "neutral",
      });

      push({
        label: "Aspect match",
        detail: aspectResult.reason,
        value: aspectResult.score,
        weight: W.aspect,
        accent:
          aspectResult.score >= 0.9
            ? "premium"
            : aspectResult.score >= 0.6
              ? "neutral"
              : "imax",
      });

      const aud = audioScore(dcp.audio_mix);
      push({
        label: "DCP audio mix",
        detail: dcp.audio_mix,
        value: aud,
        weight: W.dcp * 0.24,
        accent: aud >= 0.9 ? "dolby" : "neutral",
      });

      push({
        label: "Verification",
        detail: dcp.verified
          ? `Verified${dcp.source ? ` · ${dcp.source}` : ""}`
          : "Unverified spec",
        value: dcp.verified ? 1.0 : 0.6,
        weight: W.dcp * 0.10,
      });
    } else {
      push({
        label: "DCP",
        detail: "No confirmed package",
        value: 0.3,
        weight: W.dcp,
      });

      push({
        label: "Aspect match",
        detail: aspectResult.reason,
        value: aspectResult.score,
        weight: W.aspect,
        accent:
          aspectResult.score >= 0.9
            ? "premium"
            : aspectResult.score >= 0.6
              ? "neutral"
              : "imax",
      });
    }

    push({
      label: "Projection",
      detail: screen.projection_system,
      value: proj,
      weight: W.hw * HW_SUB.projection,
      accent: proj >= 0.9 ? "premium" : "neutral",
    });

    push({
      label: "Sound system",
      detail: screen.sound_system,
      value: snd,
      weight: W.hw * HW_SUB.sound,
      accent: snd >= 0.9 ? "dolby" : "neutral",
    });

    const sizeText = screen.screen_spec ?? screen.screen_dimensions;
    push({
      label: "Screen size",
      detail: sizeText ?? "Not specified",
      value: reDetails.sizeScore,
      weight: W.hw * HW_SUB.screenReal * 0.50,
    });

    push({
      label: "Pixel density",
      detail: (reDetails.projSpecs && reDetails.dims)
        ? `${reDetails.projSpecs.resolution} on ${reDetails.dims.widthFt}ft screen`
        : "Unknown pixel density",
      value: reDetails.densityScore,
      weight: W.hw * HW_SUB.screenReal * 0.25,
      accent: reDetails.densityScore >= 0.9 ? "premium" : "neutral",
    });

    push({
      label: "Brightness estimate",
      detail: (reDetails.projSpecs && reDetails.dims && reDetails.scrSpecs)
        ? `${reDetails.projSpecs.estimatedLumens}lm × ${reDetails.scrSpecs.gain} gain / ${Math.round(reDetails.dims.areaSqFt)}sqft`
        : "Unknown brightness",
      value: reDetails.brightnessScore,
      weight: W.hw * HW_SUB.screenReal * 0.25,
      accent: reDetails.brightnessScore >= 0.9 ? "premium" : "neutral",
    });

    const screenSpecs = getScreenSpecs(screen.screen_brand);
    push({
      label: "Screen material",
      detail: (screenSpecs && dcp)
        ? `${screen.screen_brand} (${screenSpecs.material}, gain ${screenSpecs.gain})`
        : "Unknown screen material",
      value: material,
      weight: W.hw * HW_SUB.material,
      accent: material >= 0.9 ? "premium" : "neutral",
    });

    push({
      label: "Projector model",
      detail: projectorSpecs
        ? `${screen.projector_brand} ${screen.projector_model}`
        : "Unknown projector",
      value: projectorModelBonus,
      weight: W.hw * HW_SUB.projectorModel,
      accent: projectorModelBonus >= 0.9 ? "premium" : "neutral",
    });

    push({
      label: "Audience rating",
      detail: screen.review_count
        ? `${screen.user_rating.toFixed(1)} / 5 · ${screen.review_count} reviews`
        : "No reviews yet",
      value: crowdScore,
      weight: W.crowd,
    });

    const reason = buildReason(breakdown, dcp);

    return { screen, dcp, score, reason, breakdown };
  }).sort((a, b) => b.score - a.score);
}

export function scoreScreen(
  movie: Movie,
  screen: Screen,
  dcp: Dcp | null,
): ScoredScreen {
  const results = scoreScreens(movie, [{ screen, dcp }]);
  return results[0];
}


function buildReason(breakdown: ScoreBreakdown[], dcp: Dcp | null): string {
  const candidates = breakdown.filter(
    (b) =>
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

  const dcpFormatsLower = dcp.format.map(f => f.toLowerCase());
  const has = (tag: string) => dcpFormatsLower.some(f => f.includes(tag));

  // DCP-side gate: IMAX DCP can only play on IMAX screen
  const dcpIsImax = has('imax');
  if (dcpIsImax && !hasImax(screen.screen_format)) return false;

  // Screen-side gates — gated screens are excluded from ranking when no
  // matching-format DCP exists for this movie.
  const screenCat = classifyScreenFormat(screen.screen_format, screen.screen_spec);

  if (screenCat === 'imax' && !has('imax')) return false;
  if (screenCat === 'imax_70mm' && !(has('imax') && has('70mm'))) return false;
  if (screenCat === '70mm' && !has('70mm')) return false;

  return true;
}

/** Rank a set of candidate screens for a movie (highest score first). */
export function rankScreens(
  movie: Movie,
  candidates: { screen: Screen; dcp: Dcp | null }[],
) {
  const compatible = candidates.filter(({ screen, dcp }) => isCompatible(screen, dcp));
  const scored = scoreScreens(movie, compatible);

  return scored
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
  const has = (tag: string) => formats.some((f) => f.includes(tag));

  if (isImax && has('70mm') && !is3D) return 0; // IMAX 70mm 2D — absolute best
  if (isImax && has('70mm') && is3D) return 0.5; // IMAX 70mm 3D
  if (isImax && !is3D && hasImax12ch) return 1; // IMAX 2D 12-channel
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
