import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  Clapperboard,
  Database,
  Film,
  MonitorPlay,
  ShieldCheck,
} from "lucide-react";
import {
  DEMO_MODE,
  getAllMovies,
  getTechTerms,
  getTheatres,
  getScreensForTheatre,
} from "@/lib/data";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { FormatBadge } from "@/components/format-badge";

export const metadata: Metadata = { title: "Admin Console" };

export default async function AdminPage() {
  const [movies, theatres, terms] = await Promise.all([
    getAllMovies(),
    getTheatres(),
    getTechTerms(),
  ]);
  const screenCounts = await Promise.all(
    theatres.map((t) => getScreensForTheatre(t.id).then((s) => s.length)),
  );
  const totalScreens = screenCounts.reduce((a, b) => a + b, 0);

  const stats = [
    { icon: Film, label: "Movies", value: movies.length },
    { icon: Building2, label: "Theatres", value: theatres.length },
    { icon: MonitorPlay, label: "Screens", value: totalScreens },
    { icon: Database, label: "Tech terms", value: terms.length },
  ];

  return (
    <div className="container py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="size-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Admin console
            </h1>
            <p className="text-sm text-muted-foreground">
              Catalogue overview and content management.
            </p>
          </div>
        </div>
        <SignOutButton disabled={DEMO_MODE} />
      </div>

      {DEMO_MODE && (
        <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-200/90">
          <p className="font-medium">Demo mode</p>
          <p className="mt-1 text-amber-200/70">
            You&apos;re viewing bundled sample data. Connect a Supabase project
            in <code>.env.local</code>, run the migration in{" "}
            <code>supabase/migrations</code>, and authentication plus content
            editing become available here.
          </p>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl glass p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-white/5 text-primary">
              <s.icon className="size-5" />
            </span>
            <p className="mt-4 font-display text-3xl font-bold">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Movies overview */}
      <h2 className="mb-4 mt-10 font-display text-xl font-bold tracking-tight">
        Catalogue
      </h2>
      <div className="overflow-hidden rounded-2xl glass">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Title</th>
              <th className="px-5 py-3 font-medium">Formats</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {movies.map((m) => (
              <tr key={m.id} className="transition-colors hover:bg-white/[0.03]">
                <td className="px-5 py-3">
                  <Link
                    href={`/movies/${m.id}`}
                    className="font-medium transition-colors hover:text-primary"
                  >
                    {m.title}
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {m.format.map((f) => (
                      <FormatBadge key={f} value={f} />
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3">
                  {m.is_now_playing ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                      Now playing
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Archived</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clapperboard className="size-3.5" />
        Showtimes are generated for demonstration. Connect Supabase to manage
        real schedules.
      </p>
    </div>
  );
}
