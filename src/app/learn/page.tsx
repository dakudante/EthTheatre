import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { getTechTerms } from "@/lib/data";
import { TechTermCard } from "@/components/tech-term-card";
import { SectionHeader } from "@/components/section-header";

export const metadata: Metadata = {
  title: "Learn the Tech",
  description:
    "Cinema technology decoded — DCP, IMAX, Dolby Atmos, laser projection and more, in plain language.",
};

const CATEGORY_ORDER = [
  "Post-Production",
  "Projection",
  "Audio",
  "Format",
  "Screen",
];

export default async function LearnPage() {
  const terms = await getTechTerms();

  const byCategory = new Map<string, typeof terms>();
  for (const t of terms) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? 999 : i;
  };
  const categories = Array.from(byCategory.keys()).sort(
    (a, b) => rank(a) - rank(b),
  );

  return (
    <div className="container py-10">
      <div className="mb-10 max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground">
          <BookOpen className="size-3.5 text-primary" />
          The ScreenRank glossary
        </span>
        <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight">
          Learn the tech
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          Cinema marketing is full of jargon. Here&apos;s what actually matters,
          explained simply — so you know exactly what you&apos;re paying for.
        </p>
      </div>

      {categories.map((cat) => (
        <section key={cat} className="mb-12">
          <SectionHeader title={cat} />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {byCategory.get(cat)!.map((t) => (
              <TechTermCard key={t.id} term={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
