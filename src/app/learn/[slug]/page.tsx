import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import * as Icons from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { getTechTerm, getTechTerms } from "@/lib/data";
import { TechTermCard } from "@/components/tech-term-card";
import { TERM_COLORS } from "@/lib/format-config";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const term = await getTechTerm(params.slug);
  if (!term) return { title: "Term not found" };
  return { title: term.title, description: term.short_desc };
}

export default async function TermPage({
  params,
}: {
  params: { slug: string };
}) {
  const term = await getTechTerm(params.slug);
  if (!term) notFound();

  const allTerms = await getTechTerms();
  const related = allTerms.filter((t) => term.related_terms.includes(t.slug));

  const color = TERM_COLORS[term.color] ?? TERM_COLORS.slate;
  const IconCmp =
    (Icons as unknown as Record<string, Icons.LucideIcon>)[term.icon] ??
    Icons.BookOpen;

  return (
    <div className="container py-10">
      <Link
        href="/learn"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to glossary
      </Link>

      <article className="mt-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "grid size-14 shrink-0 place-items-center rounded-2xl border",
              color,
            )}
          >
            <IconCmp className="size-7" />
          </span>
          <div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {term.category}
            </span>
            <h1 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {term.title}
            </h1>
          </div>
        </div>

        <p className="mt-6 text-xl font-medium leading-relaxed text-foreground/90">
          {term.short_desc}
        </p>

        <div className="mt-5 space-y-4 leading-relaxed text-muted-foreground">
          {term.full_desc.split("\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {term.specs && Object.keys(term.specs).length > 0 && (
          <div className="mt-8 overflow-hidden rounded-2xl glass">
            <div className="border-b border-white/10 px-5 py-3">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                At a glance
              </h2>
            </div>
            <dl className="divide-y divide-white/5">
              {Object.entries(term.specs).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                >
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </article>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 font-display text-xl font-bold tracking-tight">
            Related terms
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {related.map((t) => (
              <TechTermCard key={t.id} term={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
