import Link from "next/link";
import { Clapperboard } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/10">
      <div className="container flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Link href="/" className="flex items-center gap-2 font-display">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
              <Clapperboard className="size-4" />
            </span>
            <span className="font-bold tracking-tight">
              Screen<span className="text-primary">Rank</span>
            </span>
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Find the best screen for any film — ranked by the actual DCP
            specification first, then the room&apos;s hardware. Decoded into
            plain language.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          <FooterCol
            title="Explore"
            links={[
              { href: "/movies", label: "Now Playing" },
              { href: "/theatres", label: "Theatres" },
              { href: "/learn", label: "Learn the Tech" },
            ]}
          />
          <FooterCol
            title="Tech Hub"
            links={[
              { href: "/learn/dcp", label: "What is a DCP?" },
              { href: "/learn/imax", label: "IMAX explained" },
              { href: "/learn/dolby-atmos", label: "Dolby Atmos" },
            ]}
          />
          <FooterCol
            title="Account"
            links={[{ href: "/admin", label: "Admin Console" }]}
          />
        </div>
      </div>
      <div className="border-t border-white/10 py-6">
        <div className="container flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} ScreenRank. A cinema-tech discovery demo.</p>
          <p>Movie metadata via TMDB. Not endorsed by TMDB.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/70">
        {title}
      </h4>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
