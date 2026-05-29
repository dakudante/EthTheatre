// Maps screen / projection formats to the neon accent system.
// Accent keys correspond to CSS helpers + tailwind `text-format-*` colors.

export type AccentKey = "imax" | "dolby" | "premium" | "epiq" | "neutral";

export interface AccentStyle {
  key: AccentKey;
  text: string;
  border: string;
  bg: string;
  ring: string;
  glow: string;
  dot: string;
}

export const ACCENTS: Record<AccentKey, AccentStyle> = {
  imax: {
    key: "imax",
    text: "text-cyan-300",
    border: "border-cyan-400/40",
    bg: "bg-cyan-400/10",
    ring: "ring-format-imax",
    glow: "shadow-[0_0_30px_-8px_rgba(34,211,238,0.6)]",
    dot: "bg-cyan-400",
  },
  dolby: {
    key: "dolby",
    text: "text-violet-300",
    border: "border-violet-400/40",
    bg: "bg-violet-400/10",
    ring: "ring-format-dolby",
    glow: "shadow-[0_0_30px_-8px_rgba(167,139,250,0.6)]",
    dot: "bg-violet-400",
  },
  premium: {
    key: "premium",
    text: "text-amber-300",
    border: "border-amber-400/40",
    bg: "bg-amber-400/10",
    ring: "ring-format-premium",
    glow: "shadow-[0_0_30px_-8px_rgba(251,191,36,0.6)]",
    dot: "bg-amber-400",
  },
  epiq: {
    key: "epiq",
    text: "text-emerald-300",
    border: "border-emerald-400/40",
    bg: "bg-emerald-400/10",
    ring: "ring-format-epiq",
    glow: "shadow-[0_0_30px_-8px_rgba(52,211,153,0.6)]",
    dot: "bg-emerald-400",
  },
  neutral: {
    key: "neutral",
    text: "text-slate-300",
    border: "border-white/15",
    bg: "bg-white/5",
    ring: "",
    glow: "",
    dot: "bg-slate-400",
  },
};

// Resolve an accent from any format-ish string (screen_format, sound_system, etc.)
export function accentFor(value?: string | null): AccentStyle {
  const v = (value ?? "").toLowerCase();
  if (v.includes("imax")) return ACCENTS.imax;
  if (v.includes("dolby")) return ACCENTS.dolby;
  if (v.includes("epiq") || v.includes("pxl")) return ACCENTS.epiq;
  if (
    v.includes("4dx") ||
    v.includes("premium") ||
    v.includes("luxe") ||
    v.includes("recliner") ||
    v.includes("gold")
  )
    return ACCENTS.premium;
  return ACCENTS.neutral;
}

export const TERM_COLORS: Record<string, string> = {
  cyan: "text-cyan-300 border-cyan-400/40 bg-cyan-400/10",
  violet: "text-violet-300 border-violet-400/40 bg-violet-400/10",
  amber: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  emerald: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
  rose: "text-rose-300 border-rose-400/40 bg-rose-400/10",
  sky: "text-sky-300 border-sky-400/40 bg-sky-400/10",
  slate: "text-slate-300 border-white/15 bg-white/5",
};
