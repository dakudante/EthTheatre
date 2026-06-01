import { z } from "zod";
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
  /** 0..1 contribution within its own dimension */
  value: number;
  weight: number;
  accent: "imax" | "dolby" | "premium" | "epiq" | "neutral";
}

export interface ScoredScreen {
  score: number; // 0..100
  reason: string;
  breakdown: ScoreBreakdown[];
}

const WEIGHTS = {
  // DCP — the file fidelity (sums to 0.60)
  dcpResolution: 0.18,
  dcpFormat: 0.16,
  dcpAspect: 0.1,
  dcpAudio: 0.12,
  dcpVerified: 0.04,
  // Hardware — the room (sums to 0.35)
  hwProjection: 0.14,
  hwSound: 0.1,
  hwScreenClass: 0.07,
  hwScreenSize: 0.04,
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

function aspectScore(container?: string | null): number {
  const v = (container ?? "").toLowerCase();
  // Scope (2.39) generally fills more of a premium screen than Flat (1.85).
  if (v.includes("1.43") || v.includes("imax")) return 1; // full IMAX aperture
  if (v.includes("1.90")) return 0.92; // digital IMAX
  if (v.includes("2.39") || v.includes("2.40") || v.includes("scope"))
    return 0.85;
  if (v.includes("2.20") || v.includes("70mm")) return 0.95;
  if (v.includes("1.85") || v.includes("flat")) return 0.65;
  return 0.6;
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

    const asp = aspectScore(dcp.aspect_ratio_container);
    push({
      label: "Aspect ratio",
      detail: dcp.aspect_ratio_container,
      value: asp,
      weight: WEIGHTS.dcpAspect,
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
        WEIGHTS.dcpAspect +
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
  const score = Math.round(total * 1000) / 10; // 0..100, one decimal

  return { score, reason: buildReason(breakdown, dcp), breakdown };
}

function buildReason(breakdown: ScoreBreakdown[], dcp: Dcp | null): string {
  // Surface the two or three strongest weighted contributions.
  const ranked = [...breakdown]
    .filter((b) => b.label !== "Screen size" && b.label !== "Verification")
    .sort((a, b) => b.value * b.weight - a.value * a.weight)
    .slice(0, 3);

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
        case "Sound system":
          return `${b.detail} sound`;
        case "Screen class":
          return `the ${b.detail} screen`;
        case "Aspect ratio":
          return `a ${b.detail} container`;
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
    .sort((a, b) => b.score - a.score)
    .map((c, i) => ({ ...c, rank: i + 1 }));
}
