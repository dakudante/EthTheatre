import Link from "next/link";
import * as Icons from "lucide-react";
import type { TechTerm } from "@/lib/types";
import { TERM_COLORS } from "@/lib/format-config";
import { cn } from "@/lib/utils";

// Resolve a Lucide icon by name, falling back to a sensible default.
function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = (Icons as unknown as Record<string, Icons.LucideIcon>)[name];
  const Resolved = Cmp ?? Icons.BookOpen;
  return <Resolved className={className} />;
}

export function TechTermCard({ term }: { term: TechTerm }) {
  const color = TERM_COLORS[term.color] ?? TERM_COLORS.slate;
  return (
    <Link
      href={`/learn/${term.slug}`}
      className="group relative block overflow-hidden rounded-2xl glass glass-hover p-5"
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl border",
            color,
          )}
        >
          <Icon name={term.icon} className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold leading-tight transition-colors group-hover:text-primary">
              {term.title}
            </h3>
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
            {term.short_desc}
          </p>
          <span className="mt-3 inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {term.category}
          </span>
        </div>
      </div>
    </Link>
  );
}
