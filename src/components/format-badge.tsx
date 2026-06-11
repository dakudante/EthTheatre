import { cn } from "@/lib/utils";

/**
 * Brand-colored format badges (V2.0). First matching rule wins, so more
 * specific brands (IMAX 70mm, Dolby Atmos) sit above their general families.
 */
const BRAND_BADGES: { test: RegExp; classes: string }[] = [
  { test: /imax[\s-]*70\s*mm|70\s*mm[\s-]*imax/i, classes: "bg-cyan-600 text-white" },
  { test: /imax/i, classes: "bg-cyan-500 text-white" },
  { test: /atmos/i, classes: "bg-violet-400 text-white" },
  { test: /dolby/i, classes: "bg-violet-500 text-white" }, // Dolby Cinema / Vision
  { test: /epiq/i, classes: "bg-emerald-500 text-white" },
  { test: /pxl/i, classes: "bg-orange-500 text-white" },
  { test: /luxe/i, classes: "bg-amber-500 text-white" },
  { test: /4dx/i, classes: "bg-teal-500 text-white" },
  { test: /screenx/i, classes: "bg-indigo-500 text-white" },
  { test: /premium|gold|recliner/i, classes: "bg-amber-400 text-black" },
  { test: /scope/i, classes: "bg-slate-600 text-white" },
  { test: /flat|signature|standard/i, classes: "bg-slate-500 text-white" },
];

function badgeClasses(value: string): string {
  for (const rule of BRAND_BADGES) {
    if (rule.test.test(value)) return rule.classes;
  }
  return "bg-slate-600 text-white"; // generic formats (4K, HDR, 3D, HFR…)
}

// A pill that auto-colours itself based on the format string it carries.
export function FormatBadge({
  value,
  className,
  glow = false,
}: {
  value: string;
  className?: string;
  glow?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        badgeClasses(value),
        glow && "shadow-[0_0_24px_-6px_currentColor]",
        className,
      )}
    >
      {value}
    </span>
  );
}
