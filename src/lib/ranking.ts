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

  const t = `${brand ?? ""} ${model ?? ""}`.trim().toLowerCase();
  if (t.includes('rgb') && t.includes('laser'))
    return { type: 'rgb-laser', estimatedLumens: 25000, resolution: '4K', isDciCompliant: true };
  if (t.includes('laser') && t.includes('4k'))
    return { type: 'phosphor-laser', estimatedLumens: 20000, resolution: '4K', isDciCompliant: true };
  if (t.includes('xenon'))
    return { type: 'xenon', estimatedLumens: 15000, resolution: (t.includes('4k') ? '4K' : '2K') as '4K' | '2K', isDciCompliant: true };
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

const SCREEN_KB_BY_SPECIFICITY = Object.entries(SCREEN_BRAND_KNOWLEDGE).sort(
  (a, b) => b[0].length - a[0].length,
);

function getScreenSpecs(brand: string | null) {
  if (!brand) return null;
  const exact = SCREEN_BRAND_KNOWLEDGE[brand] ?? SCREEN_KB_LOWER.get(brand.toLowerCase());
  if (exact) return exact;
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

// ── types ──────────────────────────────────────────────────────────────────
import type { Dcp, Movie, Screen } from "./types";

// ── Input contracts ─────────────────────────────────────────────────────────
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

export const EntityIdSchema = z.union([
  z.string().uuid(),
  z.string().regex(/^\d+$/, "must be a UUID or numeric id"),
]);

export const RecommendationQuerySchema = z.object({
  movieId: EntityIdSchema,
  city: z.string().trim().min(1).max(120).optional(),
  format: z.enum(SCREEN_FORMATS).optional(),
});
export type RecommendationQuery = z.infer<typeof RecommendationQuerySchema>;

export const RankingParamsSchema = z.object({
  movieId: EntityIdSchema,
  screenId: EntityIdSchema,
  dcpId: EntityIdSchema.optional(),
});
export type RankingParams = z.infer<typeof RankingParamsSchema>;

export function parseRankingParams(input: unknown): RankingParams {
  return RankingParamsSchema.parse(input);
}

export interface ScoreBreakdown {
  label: string;
  detail: string;
  value: number;
  weight: number;
  accent: "imax" | "dolby" | "premium" | "epiq" | "neutral";
  projectorSpecBonus?: number;
  screenGainMatch?: number;
  pixelDensityAdequacy?: number;
  brightnessEstimate?: number;
}

export interface ScoredScreen {
  score: number;
  reason: string;
  breakdown: ScoreBreakdown[];
}

// ── V2 Adaptive Weight System ─────────────────────────────────────────────

const DCP_DOMINANT = { dcp: 0.55, aspect: 0.15, hw: 0.25, crowd: 0.05 };
const HW_DOMINANT = { dcp: 0.15, aspect: 0.20, hw: 0.50, crowd: 0.10 };

function stddev(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length);
}

function adaptiveWeights(dcpSpread: number) {
  const alpha = Math.min(1, dcpSpread / 0.15);
  return {
    dcp: alpha * DCP_DOMINANT.dcp + (1 - alpha) * HW_DOMINANT.dcp,
    aspect: alpha * DCP_DOMINANT.aspect + (1 - alpha) * HW_DOMINANT.aspect,
    hw: alpha * DCP_DOMINANT.hw + (1 - alpha) * HW_DOMINANT.hw,
    crowd: alpha * DCP_DOMINANT.crowd + (1 - alpha) * HW_DOMINANT.crowd,
  };
}

// ── DCP sub-weights (must sum to 1.0) ───────────────────────────────────────
const DCP_SUB = {
  resolution: 0.35,
  format: 0.15,
  audio: 0.25,
  verification: 0.10,
  premium: 0.15,
};

// ── Hardware sub-weights (within the hardware portion) ────────────────────
const HW_SUB = {
  projection: 0.20,
  projectorModel: 0.05,
  screenReal: 0.35,
  sound: 0.25,
  material: 0.15,
};

export function resolutionScore(res?: string | null): number {
  const v = (res ?? "").toLowerCase();
  if (v.includes("8k")) return 1;
  if (v.includes("4k")) return 0.9;
  if (v.includes("imax") && v.includes("2k")) return 0.70;
  if (v.includes("2k")) return 0.55;
  return 0.4;
}

export function formatScore(dcpFormats: string[]): number {
  const tokens = dcpFormats.map((f) => f.toLowerCase());
  const has = (tag: string) => tokens.some((f) => f.includes(tag));
  let s = 0.4;
  if (has("hdr") || has("dolby vision")) s += 0.3;
  if (has("hfr")) s += 0.15;
  if (has("3d")) s += 0.1;
  if (has("imax")) s += 0.30;
  return Math.min(1, s);
}

function premiumScore(dcpFormats: string[]): number {
  const tokens = dcpFormats.map((f) => f.toLowerCase());
  const has = (tag: string) => tokens.some((f) => f.includes(tag));
  if (has("imax") || has("dolby vision") || has("hdr")) return 1.0;
  if (has("hfr") || has("3d")) return 0.5;
  return 0.0;
}

export function aspectCompatibilityScore(
  dcpContainer: string,
  screenFormat: string,
  screenSpec: string | null,
  isIMAXDcp: boolean,
  isVariableAspect: boolean,
  movieAspectRatios: string[],
): { score: number; reason: string } {
  const screen = (screenFormat || "").toLowerCase();

  if (isIMAXDcp && !screen.includes("imax")) {
    return { score: 0, reason: "IMAX DCP requires IMAX projection system" };
  }

  // BUG 4 FIX: Scope-last override only applies to IMAX DCPs of variable-aspect
  // movies. Non-IMAX builds ship in a fixed container and must be scored normally.
  if (isVariableAspect && isIMAXDcp) {
    const ratios = movieAspectRatios.map(r => r.toLowerCase());
    const hasWide = ratios.some(r => r.includes('2.39') || r.includes('scope'));
    const hasFlat = ratios.some(r => r.includes('1.85') || r.includes('flat'));
    if (hasWide && hasFlat && screen.includes('scope'))
      return { score: 0.05, reason: 'Scope last — 1.85 content pillarboxes on Scope' };

    if (movieAspectRatios.length >= 2) {
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
  }

  return calculateSingleAspectScore(dcpContainer, screenFormat, screenSpec);
}

// ── Screen format classification ────────────────────────────────────────────
type ScreenCategory = 'imax_70mm' | 'imax' | 'flat' | 'scope' | '70mm' | 'dolby' | 'standard';

function classifyScreenFormat(
  screenFormat: string,
  screenSpec: string | null,
): ScreenCategory {
  const sf = screenFormat.toLowerCase();
  const sp = (screenSpec ?? "").toLowerCase();

  if (sf.includes("imax") && (sf.includes("70mm") || sp.includes("70mm"))) return "imax_70mm";
  if (sf.includes("imax")) return "imax";

  if (sf.includes("epiq")) return "flat";
  if (sf.includes("pxl")) return sf.includes("scope") ? "scope" : "flat";

  if (sf.includes("flat")) return "flat";
  if (sf.includes("scope")) return "scope";

  if ((sf.includes("70mm") || sp.includes("70mm")) && !sf.includes("imax")) return "70mm";

  // FIX #5: Dolby Cinema is dual-masking — treat as its own premium category
  if (sf.includes("dolby")) return "dolby";

  return "standard";
}

type RatioKey = '1.33' | '1.43' | '1.50' | '1.85' | '1.90' | '2.20' | '2.35' | '2.39' | '2.76' | 'unknown';

function resolveRatioKey(dcpContainer: string): RatioKey {
  const dcp = dcpContainer.toLowerCase();
  const markers: [RegExp, RatioKey][] = [
    [/1\.43|imax film/, '1.43'],
    [/1\.50/, '1.50'],
    [/1\.33|academy/, '1.33'],
    [/1\.90|imax digital/, '1.90'],
    [/1\.85|flat/, '1.85'],
    [/2\.35|2\.39|2\.40|scope/, '2.39'],  // FIX #8: added 2.35
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
  return best;
}

const ASPECT_PRIORITY: Record<RatioKey, Record<ScreenCategory, { score: number; reason: string }>> = {
  '2.39': {
    scope: { score: 1.00, reason: 'Scope DCP on Scope screen — native fit, full screen used' },
    '70mm': { score: 0.80, reason: '70mm screen (2.20:1) close to Scope — minimal letterboxing' },
    flat: { score: 0.55, reason: 'Letterboxing on Flat screen (~22% bars top/bottom)' },
    imax: { score: 0.30, reason: 'Letterboxing on IMAX digital (~20% bars in 1.90 frame)' },
    imax_70mm: { score: 0.10, reason: 'Heavy letterboxing — 1.43 IMAX frame too tall for wide content' },
    standard: { score: 0.50, reason: 'Standard screen — letterboxed' },
    dolby: { score: 1.00, reason: 'Dolby Cinema — dual-masking native fit for Scope' },
  },
  '2.76': {
    scope: { score: 1.00, reason: 'Scope screen — best standard fit for ultra-wide content' },
    '70mm': { score: 0.80, reason: '70mm screen close to ultra-wide — moderate letterboxing' },
    flat: { score: 0.55, reason: 'Heavy letterboxing on Flat screen' },
    imax: { score: 0.30, reason: 'Heavy letterboxing on IMAX digital' },
    imax_70mm: { score: 0.10, reason: 'Extreme letterboxing on IMAX 70mm' },
    standard: { score: 0.50, reason: 'Standard screen' },
    dolby: { score: 1.00, reason: 'Dolby Cinema — dual-masking native fit for ultra-wide' },
  },
  '1.85': {
    flat: { score: 1.00, reason: 'Flat DCP on Flat screen — native fit, full screen used' },
    imax: { score: 0.80, reason: 'Near-perfect on IMAX digital (1.90 vs 1.85 — ~2.6% bars)' },
    '70mm': { score: 0.55, reason: 'Pillarboxing on 70mm screen (2.20 too wide — ~15% bars on sides)' },
    scope: { score: 0.30, reason: 'Pillarboxing on Scope screen (2.39 — ~22% image loss on sides)' },
    imax_70mm: { score: 0.10, reason: 'Flat content pillarboxed within tall 1.43 IMAX frame' },
    standard: { score: 0.50, reason: 'Standard screen' },
    dolby: { score: 1.00, reason: 'Dolby Cinema — dual-masking native fit for Flat' },
  },
  '1.90': {
    imax: { score: 1.00, reason: '1.90 content on IMAX digital — native fit' },
    flat: { score: 0.80, reason: 'Near-perfect on Flat screen (1.85 vs 1.90 — ~2.6% bars)' },
    imax_70mm: { score: 0.55, reason: 'Letterboxed within tall 1.43 IMAX frame (~25% bars)' },
    '70mm': { score: 0.30, reason: 'Pillarboxing on 70mm screen (2.20 too wide — ~13.6% bars)' },
    scope: { score: 0.10, reason: 'Significant pillarboxing on Scope (2.39 — ~20% bars on sides)' },
    standard: { score: 0.50, reason: 'Standard screen' },
    dolby: { score: 1.00, reason: 'Dolby Cinema — dual-masking native fit for 1.90' },
  },
  '1.43': {
    imax_70mm: { score: 1.00, reason: 'IMAX 70mm film aperture — full 1.43 frame, native' },
    imax: { score: 0.80, reason: 'IMAX 1.43 on digital — cropped to 1.90, still excellent' },
    flat: { score: 0.55, reason: 'Pillarboxing on Flat screen (1.85 wider than 1.43 content)' },
    '70mm': { score: 0.30, reason: 'Significant pillarboxing on 70mm screen (2.20 much wider)' },
    scope: { score: 0.10, reason: 'Severe pillarboxing on Scope (2.39 vs 1.43 — ~40% bars)' },
    standard: { score: 0.50, reason: 'Standard screen' },
    dolby: { score: 1.00, reason: 'Dolby Cinema — dual-masking native fit for 1.43' },
  },
  '1.33': {
    imax_70mm: { score: 1.00, reason: 'Tall IMAX 70mm frame suits classic 1.33 Academy ratio' },
    imax: { score: 0.80, reason: 'IMAX digital accommodates 1.33 with manageable pillarboxing' },
    flat: { score: 0.55, reason: 'Moderate pillarboxing on Flat (1.85 vs 1.33 — ~28% bars)' },
    '70mm': { score: 0.30, reason: 'Significant pillarboxing on 70mm (2.20 too wide)' },
    scope: { score: 0.10, reason: 'Extreme pillarboxing on Scope (2.39 vs 1.33 — ~44% bars)' },
    standard: { score: 0.50, reason: 'Standard screen' },
    dolby: { score: 1.00, reason: 'Dolby Cinema — dual-masking native fit for 1.33' },
  },
  '1.50': {
    imax_70mm: { score: 1.00, reason: 'Tall IMAX 70mm frame suits 1.50 ratio well' },
    imax: { score: 0.80, reason: 'IMAX digital (1.90) handles 1.50 with moderate pillarboxing' },
    flat: { score: 0.55, reason: 'Moderate pillarboxing on Flat (1.85 vs 1.50 — ~19% bars)' },
    '70mm': { score: 0.30, reason: 'Pillarboxing on 70mm (2.20 too wide — ~32% bars)' },
    scope: { score: 0.10, reason: 'Significant pillarboxing on Scope (2.39 — ~37% bars)' },
    standard: { score: 0.50, reason: 'Standard screen' },
    dolby: { score: 1.00, reason: 'Dolby Cinema — dual-masking native fit for 1.50' },
  },
  '2.20': {
    imax_70mm: { score: 1.00, reason: 'IMAX 70mm can run native 70mm print — perfect' },
    '70mm': { score: 0.95, reason: '70mm content on 70mm screen — native fit' },
    scope: { score: 0.75, reason: 'Good fit on Scope (2.39 vs 2.20 — only ~8% bars)' },
    imax: { score: 0.55, reason: 'Pillarboxing on IMAX digital (1.90 vs 2.20 — ~14% bars)' },
    flat: { score: 0.45, reason: 'Pillarboxing on Flat (1.85 vs 2.20 — ~16% bars)' },
    standard: { score: 0.55, reason: 'Standard screen' },
    dolby: { score: 1.00, reason: 'Dolby Cinema — dual-masking native fit for 2.20' },
  },
  '2.35': {
    scope: { score: 1.00, reason: 'Scope screen — native fit for 2.35 anamorphic content' },
    '70mm': { score: 0.80, reason: '70mm screen close to 2.35 — minimal letterboxing' },
    flat: { score: 0.55, reason: 'Letterboxing on Flat screen (~22% bars)' },
    imax: { score: 0.30, reason: 'Letterboxing on IMAX digital' },
    imax_70mm: { score: 0.10, reason: 'Heavy letterboxing on IMAX 70mm' },
    standard: { score: 0.50, reason: 'Standard screen — letterboxed' },
    dolby: { score: 1.00, reason: 'Dolby Cinema — dual-masking native fit for 2.35' },
  },
  unknown: {
    imax_70mm: { score: 0.60, reason: 'Unknown container match' },
    imax: { score: 0.60, reason: 'Unknown container match' },
    flat: { score: 0.60, reason: 'Unknown container match' },
    scope: { score: 0.60, reason: 'Unknown container match' },
    '70mm': { score: 0.60, reason: 'Unknown container match' },
    standard: { score: 0.60, reason: 'Unknown container match' },
    dolby: { score: 0.60, reason: 'Unknown container match' },
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

export function audioScore(mix?: string | null): number {
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
  const kb = getProjectorSpecs(brand ?? null, model ?? null);
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

// DEAD CODE — kept for export compatibility but not used in the scoring path.
// FIX #15: removed dangerous free-text fallback that parsed the largest number.
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
  if (v.includes("scope")) return { value: 0.55, accent: "neutral" };
  return { value: 0.55, accent: "neutral" };
}

// FIX #15: removed dangerous free-text fallback.
export function screenSizeScore(
  widthFt?: number | null,
  _spec?: string | null,
): number {
  const width = widthFt ?? 0;
  if (!width) return 0.45;
  if (width >= 90) return 1;
  if (width >= 70) return 0.85;
  if (width >= 50) return 0.7;
  if (width >= 35) return 0.55;
  return 0.45;
}

function screenRealEstateScoreDetails(screen: Screen, dcp: Dcp | null) {
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

  const sizeScore = Math.max(0.1, Math.min(1, 0.3 + 0.7 * Math.log(dims.widthFt / 20) / Math.log(90 / 20)));

  let densityScore = 0.7;
  if (projSpecs) {
    const resWidth = projSpecs.resolution === "4K" ? 4096 : 2048;
    const pxPerFt = resWidth / dims.widthFt;
    densityScore = pxPerFt >= 80 ? 1.0 : pxPerFt >= 50 ? 0.9 : pxPerFt >= 30 ? 0.75 : 0.5;
  }

  // FIX #11: brightness bell curve around DCI SDR spec (48 nits)
  let brightnessScore = 0.7;
  if (projSpecs && scrSpecs) {
    const areaSqM = dims.areaSqFt * 0.0929;
    const nits = (projSpecs.estimatedLumens * scrSpecs.gain) / (areaSqM * Math.PI);
    const targetNits = 48;
    const deviation = Math.abs(nits - targetNits) / targetNits;
    brightnessScore = Math.max(0.3, 1.0 - deviation * 0.8);
  }

  const score = sizeScore * 0.50 + densityScore * 0.25 + brightnessScore * 0.25;
  return { score, sizeScore, densityScore, brightnessScore, dims, projSpecs, scrSpecs };
}

export function screenRealEstateScore(screen: Screen, dcp: Dcp | null): number {
  return screenRealEstateScoreDetails(screen, dcp).score;
}

export function screenMaterialScore(screen: Screen, dcp: Dcp | null): number {
  const screenSpecs = getScreenSpecs(screen.screen_brand);
  if (!screenSpecs || !dcp) return 0.5;
  const is3D = dcp.format.some(f => f.toLowerCase().includes("3d"));
  if (is3D) {
    return screenSpecs.material === "silver" ? 1.0 : 0.4;
  } else {
    return screenSpecs.material === "silver" ? 0.7 : 1.0;
  }
}

// ── Compute raw DCP quality for a single DCP ──────────────────────────────
export function rawDcpScore(dcp: Dcp | null): number {
  if (!dcp) return 0.3;
  const res = resolutionScore(dcp.resolution);
  const fmt = formatScore(dcp.format);
  const aud = audioScore(dcp.audio_mix);
  const ver = dcp.verified ? 1.0 : 0.6;
  const prem = premiumScore(dcp.format);
  // FIX #6: weights now sum to 1.0 (0.35 + 0.15 + 0.25 + 0.10 + 0.15 = 1.0)
  return res * DCP_SUB.resolution + fmt * DCP_SUB.format + aud * DCP_SUB.audio + ver * DCP_SUB.verification + prem * DCP_SUB.premium;
}

// ── Compute weight regime from a set of unique DCPs ────────────────────────
function computeWeightRegime(uniqueDcps: (Dcp | null)[]) {
  const scores = uniqueDcps.map(rawDcpScore);
  const spread = stddev(scores);
  return adaptiveWeights(spread);
}

/**
 * V2: Score all candidate screens together.
 * FIX #1: DCP spread is measured over the *unique* DCPs for this movie,
 * not over every screen×variant assignment. This makes the weighting regime
 * stable regardless of which screens are in the candidate pool.
 */
export function scoreScreens(
  movie: Movie,
  candidates: Array<{ screen: Screen; dcp: Dcp | null }>,
): Array<{ screen: Screen; dcp: Dcp | null; score: number; reason: string; breakdown: ScoreBreakdown[] }> {
  // Extract unique DCPs to compute a stable weight regime
  const seenDcpIds = new Set<string>();
  const uniqueDcps: (Dcp | null)[] = [];
  for (const { dcp } of candidates) {
    const key = dcp?.id ?? "__null__";
    if (!seenDcpIds.has(key)) {
      seenDcpIds.add(key);
      uniqueDcps.push(dcp);
    }
  }
  const W = computeWeightRegime(uniqueDcps);

  return candidates.map(({ screen, dcp }) => {
    const breakdown: ScoreBreakdown[] = [];
    const push = (
      b: Omit<ScoreBreakdown, "accent"> & { accent?: ScoreBreakdown["accent"] },
    ) => breakdown.push({ accent: "neutral", ...b });

    const dcpScore = rawDcpScore(dcp);

    const isIMAXDcp = dcp?.format.some(f => f.toLowerCase().includes('imax')) ?? false;
    const aspectResult = aspectCompatibilityScore(
      dcp?.aspect_ratio_container ?? '',
      screen.screen_format,
      screen.screen_spec,
      isIMAXDcp,
      movie.is_variable_aspect,
      movie.aspect_ratio_variants,
    );

    const proj = projectionScore(screen.projection_system, screen.projector_brand, screen.projector_model);
    const snd = soundHardwareScore(screen.sound_system);
    const reDetails = screenRealEstateScoreDetails(screen, dcp);
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

    // FIX #9: crowd = 0.5 neutral when unrated (review_count === 0)
    const crowdScore = (screen.user_rating != null && screen.review_count > 0)
      ? screen.user_rating / 5
      : 0.5;

    const raw = (
      dcpScore * W.dcp +
      aspectResult.score * W.aspect +
      hwScore * W.hw +
      crowdScore * W.crowd
    );
    const score = Math.round(Math.min(100, raw * 100) * 10) / 10;

    // ── Breakdown population ──────────────────────────────────────────────
    if (dcp) {
      const res = resolutionScore(dcp.resolution);
      push({
        label: "DCP resolution",
        detail: dcp.resolution,
        value: res,
        weight: W.dcp * DCP_SUB.resolution,
        accent: res >= 0.9 ? "premium" : "neutral",
      });

      const fmt = formatScore(dcp.format);
      push({
        label: "DCP format",
        detail: dcp.format.length ? dcp.format.join(", ") : "2D",
        value: fmt,
        weight: W.dcp * DCP_SUB.format,
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
        weight: W.dcp * DCP_SUB.audio,
        accent: aud >= 0.9 ? "dolby" : "neutral",
      });

      push({
        label: "Verification",
        detail: dcp.verified
          ? `Verified${dcp.source ? ` · ${dcp.source}` : ""}`
          : "Unverified spec",
        value: dcp.verified ? 1.0 : 0.6,
        weight: W.dcp * DCP_SUB.verification,
      });

      const prem = premiumScore(dcp.format);
      push({
        label: "Premium format",
        detail: prem >= 1.0 ? "IMAX / Dolby Vision / HDR" : prem >= 0.5 ? "HFR / 3D" : "Standard",
        value: prem,
        weight: W.dcp * DCP_SUB.premium,
        accent: prem >= 1.0 ? "premium" : "neutral",
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
        ? `${screen.user_rating!.toFixed(1)} / 5 · ${screen.review_count} reviews`
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
      b.label !== "Audience rating" &&
      b.label !== "Premium format",
  );
  const ranked = [...candidates]
    .sort((a, b) => b.value * b.weight - a.value * a.weight)
    .slice(0, 3);

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
 * FIX #2: Venue-class gating.
 * In addition to IMAX/70mm gates, EPIQ and Dolby Cinema DCPs are now gated
 * to their respective screen types. Atmos-venue builds are gated to screens
 * that actually have Atmos hardware.
 */
export function isCompatible(screen: Screen, dcp: Dcp | null): boolean {
  if (!dcp) return true;

  const dcpFormatsLower = dcp.format.map(f => f.toLowerCase());
  const has = (tag: string) => dcpFormatsLower.some(f => f.includes(tag));

  const dcpIsImax = has('imax');
  if (dcpIsImax && !hasImax(screen.screen_format)) return false;

  const screenCat = classifyScreenFormat(screen.screen_format, screen.screen_spec);

  if (screenCat === 'imax' && !has('imax')) return false;
  if (screenCat === 'imax_70mm' && !(has('imax') && has('70mm'))) return false;
  if (screenCat === '70mm' && !has('70mm')) return false;

  // FIX #2: gate venue-class builds
  if (has('epiq') && !screen.screen_format.toLowerCase().includes('epiq')) return false;
  if (has('dolby cinema') && !screen.screen_format.toLowerCase().includes('dolby')) return false;
  if (has('dolby vision') && !screen.screen_format.toLowerCase().includes('dolby')) return false;
  // NOTE: Atmos DCPs carry a standard 7.1 bed layer — they play on any processor.
  // The height channels just don't render without Atmos speakers. Venue-class
  // routing (atmos-venue builds → Atmos screens) is already handled by
  // selectBestDcpVariant in data.ts, so we don't gate here.

  return true;
}

/** Rank a set of candidate screens for a movie (highest score first). */
export function rankScreens(
  movie: Movie,
  candidates: { screen: Screen; dcp: Dcp | null }[],
) {
  const compatible = candidates.filter(({ screen, dcp }) => isCompatible(screen, dcp));
  const scored = scoreScreens(movie, compatible);

  // FIX #10: transitive comparator — bucketed sort
  return scored
    .sort((a, b) => {
      const bandA = Math.floor(a.score / 5);
      const bandB = Math.floor(b.score / 5);
      if (bandA !== bandB) return bandB - bandA;
      const aVerified = a.dcp?.verified ? 1 : 0;
      const bVerified = b.dcp?.verified ? 1 : 0;
      if (aVerified !== bVerified) return bVerified - aVerified;
      return b.score - a.score;
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
  const best = new Map<string, typeof all[0]>();
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

// ── DCP variant grouping (BMS-style per-presentation sections) ─────────────

/** Canonical label for a DCP variant used as a tab/section heading. */
export function dcpVariantLabel(dcp: Dcp): string {
  const formats = dcp.format.map((f) => f.toLowerCase());
  const isImax = formats.some((f) => f.includes("imax"));
  const is3D = formats.some((f) => f.includes("3d"));  // FIX #7: substring match
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
  const is3D = formats.some((f) => f.includes("3d"));
  const res4K = (dcp.resolution ?? "").toLowerCase().includes("4k");
  const audio = (dcp.audio_mix ?? "").toLowerCase();
  const hasAtmos = audio.includes("atmos");
  const hasDtsX = audio.includes("dts") && audio.includes("x");
  const hasImax12ch = audio.includes("imax") && audio.includes("12");
  const has = (tag: string) => formats.some((f) => f.includes(tag));

  if (isImax && has('70mm') && !is3D) return 0;
  if (isImax && has('70mm') && is3D) return 0.5;
  if (isImax && !is3D && hasImax12ch) return 1;
  if (isImax && !is3D) return 2;
  if (isImax && is3D) return 3;
  if (!is3D && res4K && hasAtmos) return 4;
  if (!is3D && res4K && hasDtsX) return 5;
  if (!is3D && res4K) return 6;
  if (!is3D && hasAtmos) return 7;
  if (!is3D && hasDtsX) return 8;
  if (!is3D) return 9;
  if (is3D && res4K && hasAtmos) return 10;
  if (is3D && res4K) return 11;
  if (is3D) return 12;
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
