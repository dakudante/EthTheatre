import { cn } from "@/lib/utils";

// Circular score gauge (0..100). Hue shifts amber→emerald as the score climbs.
export function ScoreRing({
  score,
  size = 64,
  className,
}: {
  score: number;
  size?: number;
  className?: string;
}) {
  const stroke = size < 56 ? 4 : 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = c - (pct / 100) * c;
  const hue = 38 + (pct / 100) * 110; // amber(38) → green(148)

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="fill-none stroke-white/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="fill-none transition-[stroke-dashoffset] duration-700"
          style={{ stroke: `hsl(${hue} 90% 60%)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-bold leading-none"
          style={{
            fontSize: size * 0.3,
            color: `hsl(${hue} 90% 70%)`,
          }}
        >
          {Math.round(pct)}
        </span>
        {size >= 56 && (
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
            score
          </span>
        )}
      </div>
    </div>
  );
}
