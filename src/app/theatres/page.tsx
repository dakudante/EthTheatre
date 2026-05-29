import type { Metadata } from "next";
import { getScreensForTheatre, getTheatres } from "@/lib/data";
import { TheatreCard } from "@/components/theatre-card";
import { SectionHeader } from "@/components/section-header";

export const metadata: Metadata = {
  title: "Theatres",
  description: "Browse tracked cinemas and their screen formats.",
};

export default async function TheatresPage() {
  const theatres = await getTheatres();
  const withScreens = await Promise.all(
    theatres.map(async (t) => ({
      theatre: t,
      screens: await getScreensForTheatre(t.id),
    })),
  );

  return (
    <div className="container py-10">
      <SectionHeader
        eyebrow="Venues"
        title="Theatres"
        description="Every cinema we track, with the formats each one offers."
      />
      <div className="grid gap-5 md:grid-cols-2">
        {withScreens.map(({ theatre, screens }) => (
          <TheatreCard key={theatre.id} theatre={theatre} screens={screens} />
        ))}
      </div>
    </div>
  );
}
