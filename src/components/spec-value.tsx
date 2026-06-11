import { glossaryFor } from "@/lib/spec-glossary";
import { TermTooltip } from "@/components/term-tooltip";

// Renders a spec string, auto-wrapping it in a Learn-hub tooltip when the
// value corresponds to a known cinema-tech term.
export function SpecValue({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const hit = glossaryFor(value);
  if (!hit) return <span className={className}>{value}</span>;
  return (
    <TermTooltip
      className={className}
      label={value}
      slug={hit.slug}
      shortDesc={hit.shortDesc}
    />
  );
}

export function SpecTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="size-3" />}
        {label}
      </p>
      <div className="mt-0.5 text-sm font-medium">
        <SpecValue value={value} />
      </div>
    </div>
  );
}
