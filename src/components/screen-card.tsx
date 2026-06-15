import Link from "next/link";
import { ArmchairIcon, Star, Projector, Speaker, Ruler } from "lucide-react";
import type { Screen } from "@/lib/types";
import { FormatBadge } from "@/components/format-badge";
import { SpecValue } from "@/components/spec-value";

export function ScreenCard({ screen }: { screen: Screen }) {
  return (
    <Link
      href={`/screens/${screen.id}`}
      className="group block rounded-2xl glass glass-hover p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold leading-tight transition-colors group-hover:text-primary">
          {screen.name}
        </h3>
        <FormatBadge value={screen.screen_format} />
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Row icon={Projector} label="Projection">
          <SpecValue value={screen.projection_system} />
        </Row>
        <Row icon={Speaker} label="Sound">
          <SpecValue value={screen.sound_system} />
        </Row>
        {/* New hardware fields — only render when populated */}
        {screen.projector_brand && (
          <Row icon={Projector} label="Projector">
            <SpecValue
              value={`${screen.projector_brand}${
                screen.projector_model ? ` ${screen.projector_model}` : ""
              }`}
            />
          </Row>
        )}
        {/* Screen Type + Screen Size, separated */}
        {screen.screen_brand && (
          <Row icon={Ruler} label="Screen Type">
            <SpecValue value={screen.screen_brand} />
          </Row>
        )}
        {screen.screen_dimensions && (
          <Row icon={Ruler} label="Screen Size">
            <SpecValue value={screen.screen_dimensions} />
          </Row>
        )}
        {screen.screen_spec && (
          <Row icon={Ruler} label="Screen">
            <SpecValue value={screen.screen_spec} />
          </Row>
        )}
      </dl>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 text-amber-300">
          <Star className="size-3.5 fill-amber-400 text-amber-400" />
          {screen.user_rating.toFixed(1)}
        </span>
        {screen.number_of_seats && (
          <span className="inline-flex items-center gap-1">
            <ArmchairIcon className="size-3.5" /> {screen.number_of_seats} seats
          </span>
        )}
        {screen.three_d_system && (
          <span className="rounded-full border border-white/10 px-2 py-0.5">
            {screen.three_d_system}
          </span>
        )}
      </div>
    </Link>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate font-medium">{children}</dd>
    </div>
  );
}
