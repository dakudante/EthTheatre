import Image from "next/image";
import { cn } from "@/lib/utils";

// Deterministic hue pair from a string, so a title always renders the same art.
function hueFromString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

function GeneratedPoster({
  title,
  className,
  subtitle,
}: {
  title: string;
  className?: string;
  subtitle?: string;
}) {
  const hue = hueFromString(title);
  const hue2 = (hue + 48) % 360;
  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col justify-end overflow-hidden p-4",
        className,
      )}
      style={{
        background: `radial-gradient(120% 120% at 30% 0%, hsl(${hue} 70% 22%), hsl(${hue2} 65% 8%) 70%)`,
      }}
    >
      {/* faux light streaks */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen"
        style={{
          background: `linear-gradient(115deg, transparent 40%, hsl(${hue2} 90% 60% / 0.35) 50%, transparent 60%)`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="relative">
        <p className="font-display text-lg font-bold leading-tight text-white drop-shadow">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-1 text-xs text-white/60">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

export function Poster({
  src,
  title,
  subtitle,
  className,
  rounded = "rounded-xl",
  sizes = "(max-width: 768px) 45vw, 240px",
  priority = false,
}: {
  src?: string | null;
  title: string;
  subtitle?: string;
  className?: string;
  rounded?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const isRemote = !!src && /^https?:\/\//.test(src);
  return (
    <div
      className={cn(
        "relative aspect-[2/3] w-full overflow-hidden bg-secondary",
        rounded,
        className,
      )}
    >
      {isRemote ? (
        <Image
          src={src as string}
          alt={title}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <GeneratedPoster title={title} subtitle={subtitle} />
      )}
    </div>
  );
}

export function Backdrop({
  src,
  title,
  className,
}: {
  src?: string | null;
  title: string;
  className?: string;
}) {
  const isRemote = !!src && /^https?:\/\//.test(src);
  const hue = hueFromString(title);
  const hue2 = (hue + 40) % 360;
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {isRemote ? (
        <Image
          src={src as string}
          alt={title}
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
      ) : (
        <div
          className="h-full w-full"
          style={{
            background: `radial-gradient(80% 120% at 70% 10%, hsl(${hue} 60% 24%), hsl(${hue2} 60% 6%) 70%)`,
          }}
        />
      )}
    </div>
  );
}
