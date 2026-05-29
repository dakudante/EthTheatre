// Lightweight client-safe glossary used to attach hover tooltips to spec
// values wherever they appear. Maps a free-text spec to a Learn-hub term.

export interface GlossaryHit {
  slug: string;
  label: string;
  shortDesc: string;
}

const RULES: { test: RegExp; slug: string; shortDesc: string }[] = [
  {
    test: /atmos/i,
    slug: "dolby-atmos",
    shortDesc:
      "Object-based sound that moves around — and above — you in 3D space.",
  },
  {
    test: /dts.?x/i,
    slug: "dts-x",
    shortDesc: "Object-based immersive sound — DTS's answer to Atmos.",
  },
  {
    test: /imax.*(12|channel)|12.?channel/i,
    slug: "imax-sound",
    shortDesc:
      "IMAX's 12-channel system with overhead and side-surround speakers.",
  },
  {
    test: /imax 70mm|70mm/i,
    slug: "imax",
    shortDesc:
      "The largest screens and tallest images — engineered as a complete system.",
  },
  {
    test: /imax/i,
    slug: "imax",
    shortDesc:
      "The largest screens and tallest images — engineered as a complete system.",
  },
  {
    test: /epiq|pxl/i,
    slug: "epiq",
    shortDesc:
      "A premium large-format brand pairing a giant screen with laser + Atmos.",
  },
  {
    test: /hdr|dolby vision/i,
    slug: "hdr",
    shortDesc: "A wider gap between the darkest and brightest parts of the picture.",
  },
  {
    test: /hfr/i,
    slug: "hfr",
    shortDesc: "More frames per second for ultra-smooth, judder-free motion.",
  },
  {
    test: /laser/i,
    slug: "laser-projection",
    shortDesc:
      "Lasers instead of a lamp — brighter, deeper blacks, colours that don't fade.",
  },
  {
    test: /silver|mdi/i,
    slug: "silver-screen",
    shortDesc:
      "A reflective screen that preserves polarised light for brighter 3D.",
  },
  {
    test: /scope|flat|1\.85|2\.39|1\.43|1\.90|aspect/i,
    slug: "aspect-ratio",
    shortDesc: "The shape of the picture. Scope is wider than Flat.",
  },
  {
    test: /4k|2k|8k|resolution|\d{4}x\d{3,4}/i,
    slug: "resolution",
    shortDesc: "How many pixels make up the picture. 4K is 4× the detail of 2K.",
  },
];

export function glossaryFor(value: string): GlossaryHit | null {
  for (const r of RULES) {
    if (r.test.test(value)) {
      return { slug: r.slug, label: value, shortDesc: r.shortDesc };
    }
  }
  return null;
}
