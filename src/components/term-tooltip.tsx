"use client";

import Link from "next/link";
import { ArrowUpRight, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Wraps a technical term with an explanatory hover tooltip + a deep link into
 * the Learn hub. Used everywhere a jargon term appears in the UI.
 */
export function TermTooltip({
  label,
  shortDesc,
  slug,
  className,
}: {
  label: string;
  shortDesc: string;
  slug: string;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex cursor-help items-center gap-0.5 underline decoration-dotted decoration-primary/50 underline-offset-4 transition-colors hover:text-primary",
              className,
            )}
          >
            {label}
            <HelpCircle className="size-3 opacity-60" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="leading-snug">{shortDesc}</p>
          <Link
            href={`/learn/${slug}`}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Learn more <ArrowUpRight className="size-3" />
          </Link>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
