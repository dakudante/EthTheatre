import { accentFor } from "@/lib/format-config";
import { cn } from "@/lib/utils";

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
  const accent = accentFor(value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        accent.text,
        accent.border,
        accent.bg,
        glow && accent.glow,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", accent.dot)} />
      {value}
    </span>
  );
}
