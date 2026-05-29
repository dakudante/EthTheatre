import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-primary/15 text-primary">
        <Clapperboard className="size-8" />
      </span>
      <h1 className="mt-6 font-display text-5xl font-extrabold tracking-tight">
        404
      </h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        That reel isn&apos;t in our catalogue. The page may have moved or never
        existed.
      </p>
      <div className="mt-7 flex gap-3">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/movies">Browse movies</Link>
        </Button>
      </div>
    </div>
  );
}
