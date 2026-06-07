import type {
  Dcp,
  Movie,
  MovieAvailableFormat,
  MovieKeyframe,
  Screen,
  TechTerm,
  Theatre,
  TheatreInteriorTemplate,
} from "./types";

/**
 * Bundled demo dataset — powers the app in "demo mode" (no Supabase env).
 * The same shapes are returned by the Supabase queries, so the UI is agnostic
 * to the source. Showtimes are generated relative to "now" in the data layer.
 */

export const theatres: Theatre[] = [
  {
    id: "th-aurora",
    name: "Aurora Cinemas — Marina",
    location: "Marina Bay Promenade, Lower Parel",
    city: "Mumbai",
    lat: 19.0, lng: 72.83,
    images: [],
    amenities: ["Recliners", "Valet parking", "Gourmet concessions", "Dolby Atmos lobby"],
    description:
      "Aurora's flagship — an IMAX with Laser auditorium and a Dolby Cinema under one roof, tuned by a resident projection engineer.",
    website: "https://example.com/aurora",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "th-galaxy",
    name: "Galaxy IMAX & Premiere",
    location: "Outer Ring Road, Bellandur",
    city: "Bengaluru",
    lat: 12.93, lng: 77.68,
    images: [],
    amenities: ["IMAX 70mm film", "EPIQ auditorium", "Lie-flat loungers", "Filter coffee bar"],
    description:
      "Home to one of the few remaining IMAX 70mm film projectors in the country, alongside a laser-lit EPIQ hall.",
    website: "https://example.com/galaxy",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "th-roxy",
    name: "The Roxy Dolby House",
    location: "Connaught Place, Block A",
    city: "New Delhi",
    lat: 28.63, lng: 77.22,
    images: [],
    amenities: ["Dolby Cinema", "PXL hall", "4DX motion seats", "Art-deco bar"],
    description:
      "A restored art-deco single-screen reborn as a three-format premium house: Dolby Cinema, PXL and 4DX.",
    website: "https://example.com/roxy",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "th-northgate",
    name: "Northgate Multiplex",
    location: "Northgate Mall, Aundh",
    city: "Pune",
    lat: 18.56, lng: 73.81,
    images: [],
    amenities: ["Affordable matinees", "Scope hall", "Family seating"],
    description:
      "A dependable neighbourhood multiplex with a well-calibrated laser Scope screen and Atmos sound.",
    website: "https://example.com/northgate",
    created_at: "2024-01-01T00:00:00Z",
  },
];

export const screens: Screen[] = [
  // Aurora
  {
    id: "scr-a1", theatre_id: "th-aurora",
    name: "Screen 1 — IMAX with Laser",
    screen_format: "IMAX", projection_system: "4K RGB Laser",
    sound_system: "IMAX 12 Channel",
    screen_spec: "88 x 47 feet curved silver screen",
    number_of_seats: 312, three_d_system: "IMAX 3D",
    user_rating: 4.8, review_count: 1240, created_at: "2024-01-01T00:00:00Z", projector_brand: null,
projector_model: null,
screen_brand: null,
screen_dimensions: null,
  },
  {
    id: "scr-a2", theatre_id: "th-aurora",
    name: "Screen 4 — Dolby Cinema",
    screen_format: "Dolby", projection_system: "4K Dual Laser",
    sound_system: "Dolby Atmos",
    screen_spec: "62 x 28 feet", number_of_seats: 180, three_d_system: "Dolby 3D",
    user_rating: 4.6, review_count: 870, created_at: "2024-01-01T00:00:00Z", projector_brand: null,
projector_model: null,
screen_brand: null,
screen_dimensions: null,
  },
  {
    id: "scr-a3", theatre_id: "th-aurora",
    name: "Screen 6 — Scope",
    screen_format: "Scope", projection_system: "2K Laser",
    sound_system: "Dolby Surround 7.1",
    screen_spec: "54 x 23 feet", number_of_seats: 220, three_d_system: null,
    user_rating: 4.1, review_count: 410, created_at: "2024-01-01T00:00:00Z", projector_brand: null,
projector_model: null,
screen_brand: null,
screen_dimensions: null,
  },
  // Galaxy
  {
    id: "scr-b1", theatre_id: "th-galaxy",
    name: "GT — IMAX 70mm",
    screen_format: "IMAX 70mm", projection_system: "IMAX 70mm Film + 4K Laser",
    sound_system: "IMAX 12 Channel",
    screen_spec: "96 x 70 feet", number_of_seats: 540, three_d_system: "IMAX 3D",
    user_rating: 4.9, review_count: 2010, created_at: "2024-01-01T00:00:00Z", projector_brand: null,
projector_model: null,
screen_brand: null,
screen_dimensions: null,
  },
  {
    id: "scr-b2", theatre_id: "th-galaxy",
    name: "EPIQ",
    screen_format: "EPIQ", projection_system: "4K RGB Laser",
    sound_system: "Dolby Atmos",
    screen_spec: "70 x 30 feet", number_of_seats: 240, three_d_system: "RealD",
    user_rating: 4.7, review_count: 690, created_at: "2024-01-01T00:00:00Z", projector_brand: null,
projector_model: null,
screen_brand: null,
screen_dimensions: null,
  },
  {
    id: "scr-b3", theatre_id: "th-galaxy",
    name: "Audi 3 — Flat",
    screen_format: "Flat", projection_system: "2K Xenon",
    sound_system: "Dolby Surround 5.1",
    screen_spec: "40 x 21 feet", number_of_seats: 160, three_d_system: null,
    user_rating: 3.8, review_count: 230, created_at: "2024-01-01T00:00:00Z", projector_brand: null,
projector_model: null,
screen_brand: null,
screen_dimensions: null,
  },
  // Roxy
  {
    id: "scr-c1", theatre_id: "th-roxy",
    name: "Dolby Cinema",
    screen_format: "Dolby", projection_system: "4K Dual Laser",
    sound_system: "Dolby Atmos",
    screen_spec: "64 x 27 feet", number_of_seats: 200, three_d_system: "Dolby 3D",
    user_rating: 4.7, review_count: 980, created_at: "2024-01-01T00:00:00Z", projector_brand: null,
projector_model: null,
screen_brand: null,
screen_dimensions: null,
  },
  {
    id: "scr-c2", theatre_id: "th-roxy",
    name: "PXL",
    screen_format: "PXL", projection_system: "4K RGB Laser",
    sound_system: "Dolby Atmos",
    screen_spec: "72 x 31 feet Imported STRONG MDI Silver Screen",
    number_of_seats: 260, three_d_system: "RealD",
    user_rating: 4.6, review_count: 540, created_at: "2024-01-01T00:00:00Z", projector_brand: null,
projector_model: null,
screen_brand: "MDI",
screen_dimensions: "72 x 31 ft",
  },
  {
    id: "scr-c3", theatre_id: "th-roxy",
    name: "4DX",
    screen_format: "4DX", projection_system: "4K Laser",
    sound_system: "Dolby Surround 7.1",
    screen_spec: "45 x 20 feet", number_of_seats: 140, three_d_system: "RealD",
    user_rating: 4.3, review_count: 600, created_at: "2024-01-01T00:00:00Z",  projector_brand: null,
projector_model: null,
screen_brand: null,
screen_dimensions: null,
  },
  // Northgate
  {
    id: "scr-d1", theatre_id: "th-northgate",
    name: "Screen 2 — Scope",
    screen_format: "Scope", projection_system: "4K Laser",
    sound_system: "Dolby Atmos",
    screen_spec: "58 x 24 feet", number_of_seats: 230, three_d_system: null,
    user_rating: 4.2, review_count: 350, created_at: "2024-01-01T00:00:00Z", projector_brand: null,
projector_model: null,
screen_brand: null,
screen_dimensions: null,
  },
  {
    id: "scr-d2", theatre_id: "th-northgate",
    name: "Screen 5 — Flat",
    screen_format: "Flat", projection_system: "2K Laser",
    sound_system: "Dolby Surround 5.1",
    screen_spec: "38 x 20 feet", number_of_seats: 150, three_d_system: null,
    user_rating: 3.9, review_count: 180, created_at: "2024-01-01T00:00:00Z", projector_brand: null,
projector_model: null,
screen_brand: null,
screen_dimensions: null,
  },
];

export const movies: Movie[] = [
  {
    id: "mv-dune2", tmdb_id: 693134, title: "Dune: Part Two",
    poster: null, backdrop: null,
    synopsis:
      "Paul Atreides unites with the Fremen to wage war against House Harkonnen, torn between love and the fate of the universe.",
    release_date: "2024-03-01", duration: 166,
    genre: ["Science Fiction", "Adventure"],
    format: ["IMAX", "4K", "HDR"], is_now_playing: true,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "mv-oppen", tmdb_id: 872585, title: "Oppenheimer",
    poster: null, backdrop: null,
    synopsis:
      "The story of J. Robert Oppenheimer and his role in the development of the atomic bomb.",
    release_date: "2023-07-21", duration: 180,
    genre: ["Drama", "History"],
    format: ["IMAX 70mm", "70mm"], is_now_playing: true,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "mv-inter", tmdb_id: 157336, title: "Interstellar (Re-release)",
    poster: null, backdrop: null,
    synopsis:
      "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    release_date: "2014-11-07", duration: 169,
    genre: ["Science Fiction", "Drama"],
    format: ["IMAX 70mm", "HFR"], is_now_playing: true,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "mv-furiosa", tmdb_id: 786892, title: "Furiosa: A Mad Max Saga",
    poster: null, backdrop: null,
    synopsis:
      "The origin story of renegade warrior Furiosa before her encounter with Mad Max.",
    release_date: "2024-05-24", duration: 148,
    genre: ["Action", "Adventure"],
    format: ["4K", "HDR", "Atmos"], is_now_playing: true,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "mv-godzilla", tmdb_id: 823464, title: "Godzilla x Kong: The New Empire",
    poster: null, backdrop: null,
    synopsis:
      "Two ancient titans, Godzilla and Kong, clash in a spectacular battle as humans unravel their origins.",
    release_date: "2024-03-29", duration: 115,
    genre: ["Action", "Science Fiction"],
    format: ["IMAX", "4DX", "3D"], is_now_playing: true,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "mv-wildrobot", tmdb_id: 1184918, title: "The Wild Robot",
    poster: null, backdrop: null,
    synopsis:
      "A shipwrecked robot learns to adapt to the wilderness and bonds with the animals of the island.",
    release_date: "2024-09-27", duration: 102,
    genre: ["Animation", "Family"],
    format: ["4K", "HDR"], is_now_playing: true,
    created_at: "2024-01-01T00:00:00Z",
  },
];

// DCP records — the screen-specific package each title plays in.
function dcp(
  id: string, screen_id: string, movie_id: string,
  resolution: string, format: string[], aspect: string, audio: string,
  verified: boolean, runtime: number, source = "Theatre confirmation",
): Dcp {
  return {
    id, screen_id, movie_id, runtime, resolution, format,
    aspect_ratio_container: aspect, audio_mix: audio, verified, source,
    created_at: "2024-01-01T00:00:00Z",
  };
}

export const dcps: Dcp[] = [
  // Dune: Part Two
  dcp("d1", "scr-a1", "mv-dune2", "4K 4096x2160", ["IMAX", "HDR"], "IMAX(1.90:1)", "IMAX 12 Channel", true, 166),
  dcp("d2", "scr-b1", "mv-dune2", "4K 4096x2160", ["IMAX", "HDR"], "IMAX(1.43:1)", "IMAX 12 Channel", true, 166),
  dcp("d3", "scr-a2", "mv-dune2", "4K 4096x2160", ["HDR", "Dolby Vision"], "Scope(2.39:1)", "Dolby Atmos", true, 166),
  dcp("d4", "scr-c2", "mv-dune2", "4K 4096x2160", ["HDR"], "Scope(2.39:1)", "Dolby Atmos", true, 166),
  dcp("d5", "scr-d1", "mv-dune2", "2K 2048x858", [], "Scope(2.39:1)", "Dolby Atmos", false, 166, "User report"),
  // Oppenheimer
  dcp("d6", "scr-b1", "mv-oppen", "4K 4096x2160", ["IMAX", "70mm"], "IMAX(1.43:1)", "IMAX 12 Channel", true, 180, "Studio spec sheet"),
  dcp("d7", "scr-a1", "mv-oppen", "4K 4096x2160", ["IMAX"], "IMAX(1.90:1)", "IMAX 12 Channel", true, 180),
  dcp("d8", "scr-c1", "mv-oppen", "4K 4096x2160", ["HDR"], "Flat(1.85:1)", "Dolby Atmos", true, 180),
  dcp("d9", "scr-b3", "mv-oppen", "2K 2048x1080", [], "Flat(1.85:1)", "Dolby 5.1", false, 180),
  // Interstellar
  dcp("d10", "scr-b1", "mv-inter", "4K 4096x2160", ["IMAX 70mm", "70mm"], "IMAX(1.43:1)", "IMAX 12 Channel", true, 169, "Studio spec sheet"),
  dcp("d11", "scr-a1", "mv-inter", "4K 4096x2160", ["IMAX"], "IMAX(1.90:1)", "IMAX 12 Channel", true, 169),
  dcp("d12", "scr-b2", "mv-inter", "4K 4096x2160", ["HDR"], "Scope(2.39:1)", "Dolby Atmos", true, 169),
  // Furiosa
  dcp("d13", "scr-a2", "mv-furiosa", "4K 4096x2160", ["HDR", "Dolby Vision"], "Scope(2.39:1)", "Dolby Atmos", true, 148),
  dcp("d14", "scr-c2", "mv-furiosa", "4K 4096x2160", ["HDR"], "Scope(2.39:1)", "Dolby Atmos", true, 148),
  dcp("d15", "scr-b2", "mv-furiosa", "4K 4096x2160", ["HDR"], "Scope(2.39:1)", "Dolby Atmos", true, 148),
  dcp("d16", "scr-d1", "mv-furiosa", "2K 2048x858", [], "Scope(2.39:1)", "Dolby Atmos", false, 148),
  // Godzilla x Kong
  dcp("d17", "scr-a1", "mv-godzilla", "4K 4096x2160", ["IMAX", "3D"], "IMAX(1.90:1)", "IMAX 12 Channel", true, 115),
  dcp("d18", "scr-c3", "mv-godzilla", "4K 4096x2160", ["3D", "4DX"], "Scope(2.39:1)", "Dolby 7.1", true, 115),
  dcp("d19", "scr-b2", "mv-godzilla", "4K 4096x2160", ["HDR", "3D"], "Scope(2.39:1)", "Dolby Atmos", true, 115),
  dcp("d20", "scr-d2", "mv-godzilla", "2K 2048x1080", [], "Flat(1.85:1)", "Dolby 5.1", false, 115),
  // The Wild Robot
  dcp("d21", "scr-c1", "mv-wildrobot", "4K 4096x2160", ["HDR", "Dolby Vision"], "Scope(2.39:1)", "Dolby Atmos", true, 102),
  dcp("d22", "scr-b2", "mv-wildrobot", "4K 4096x2160", ["HDR"], "Scope(2.39:1)", "Dolby Atmos", true, 102),
  dcp("d23", "scr-d1", "mv-wildrobot", "4K 4096x2160", ["HDR"], "Scope(2.39:1)", "Dolby Atmos", true, 102),
  dcp("d24", "scr-d2", "mv-wildrobot", "2K 2048x1080", [], "Flat(1.85:1)", "Dolby 5.1", false, 102),
];

export const techTerms: TechTerm[] = [
  {
    id: "t1", slug: "dcp", title: "DCP — Digital Cinema Package",
    category: "Post-Production",
    short_desc: "The 'master file' a cinema actually plays — like a Blu-ray, but for projectors.",
    full_desc:
      "A DCP is the standardised set of files a movie is delivered in. It carries the encrypted picture (JPEG 2000), the audio, and the subtitles. Two cinemas with identical hardware can still look different because they received different DCPs — a 4K HDR Scope package versus a 2K Flat one. That is why ScreenRank ranks the package first.",
    specs: { Picture: "JPEG 2000, up to 4K", Audio: "Up to 16 channels", Security: "AES-128 encrypted, KDM-keyed" },
    icon: "Package", color: "amber",
    related_terms: ["resolution", "aspect-ratio", "hdr"],
    images: [], is_popular: true, created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "t2", slug: "resolution", title: "Resolution (2K vs 4K)",
    category: "Projection",
    short_desc: "How many pixels make up the picture. 4K has four times the detail of 2K.",
    full_desc:
      "Digital cinema resolution is measured by width. 2K is 2048 pixels wide; 4K is 4096. More pixels means finer detail, especially on a large screen where you sit close. A 4K DCP on a 4K projector is the gold standard — but a 4K file on a 2K projector still only shows 2K.",
    specs: { "2K": "2048 × 1080", "4K": "4096 × 2160", "8K": "8192 × 4320 (rare)" },
    icon: "ScanLine", color: "cyan",
    related_terms: ["dcp", "laser-projection"],
    images: [], is_popular: true, created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "t3", slug: "aspect-ratio", title: "Aspect Ratio (Flat vs Scope)",
    category: "Format",
    short_desc: "The shape of the picture. Scope is wider and more cinematic than Flat.",
    full_desc:
      "Aspect ratio is the width-to-height shape of the image. Flat (1.85:1) is mildly wide; Scope (2.39:1) is the wide, letterboxed look. IMAX can go taller still at 1.90:1 or the giant 1.43:1 film ratio, filling more of your vision. Matching the DCP's container to a screen built for it means no wasted black bars.",
    specs: { Flat: "1.85:1", Scope: "2.39:1", "IMAX Digital": "1.90:1", "IMAX Film": "1.43:1" },
    icon: "RectangleHorizontal", color: "violet",
    related_terms: ["dcp", "imax"],
    images: [], is_popular: true, created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "t4", slug: "dolby-atmos", title: "Dolby Atmos",
    category: "Audio",
    short_desc: "Object-based sound that moves around — and above — you in 3D space.",
    full_desc:
      "Traditional surround sends audio to fixed channels (left, right, rear). Atmos treats each sound as an 'object' placed precisely in the room, including overhead speakers. A helicopter can travel from behind you, over your head, and off into the screen. It needs both an Atmos DCP and an Atmos-equipped auditorium.",
    specs: { Speakers: "Up to 64 independent", Layout: "Surround + overhead array", "Best with": "Atmos DCP" },
    icon: "Speaker", color: "violet",
    related_terms: ["dts-x", "imax-sound"],
    images: [], is_popular: true, created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "t5", slug: "laser-projection", title: "Laser Projection",
    category: "Projection",
    short_desc: "Lasers instead of a lamp — brighter, deeper blacks, colours that don't fade.",
    full_desc:
      "Older projectors use a Xenon bulb that dims over time and struggles with deep blacks. Laser light engines are brighter, more consistent, and hit a far wider colour range. RGB laser (separate red, green, blue lasers) is the top tier, delivering the richest colour and the brightest 3D.",
    specs: { "Xenon": "Lamp-based, dims with age", "Laser Phosphor": "Single laser, blue-based", "RGB Laser": "Three lasers, widest colour" },
    icon: "Zap", color: "cyan",
    related_terms: ["resolution", "hdr"],
    images: [], is_popular: false, created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "t6", slug: "imax", title: "IMAX",
    category: "Format",
    short_desc: "The largest screens and tallest images — engineered as a complete system.",
    full_desc:
      "IMAX isn't just a big screen — it's a calibrated system of screen, dual projectors, and a 12-channel sound design. Digital IMAX with Laser uses dual 4K laser projectors at a 1.90:1 ratio. True IMAX 70mm film is the rare, premium tier with the giant 1.43:1 image that fills your peripheral vision.",
    specs: { "Digital IMAX": "Dual 4K laser, 1.90:1", "IMAX 70mm": "15/70 film, 1.43:1", Sound: "12-channel" },
    icon: "Maximize", color: "cyan",
    related_terms: ["aspect-ratio", "imax-sound", "laser-projection"],
    images: [], is_popular: true, created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "t7", slug: "hdr", title: "HDR (High Dynamic Range)",
    category: "Projection",
    short_desc: "A wider gap between the darkest and brightest parts of the picture.",
    full_desc:
      "HDR expands contrast — brighter highlights and deeper shadows at the same time — and a wider range of colours. On a capable laser screen with an HDR DCP, a sunset or an explosion has far more punch and detail than standard dynamic range.",
    specs: { "Standard": "~48 nits target", "HDR (Dolby Vision)": "Higher peak luminance", "Needs": "HDR DCP + laser" },
    icon: "Sun", color: "amber",
    related_terms: ["laser-projection", "dcp"],
    images: [], is_popular: false, created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "t8", slug: "dts-x", title: "DTS:X",
    category: "Audio",
    short_desc: "Object-based immersive sound — DTS's answer to Atmos.",
    full_desc:
      "Like Atmos, DTS:X places sounds as objects in 3D space rather than fixed channels, including height. It's speaker-layout agnostic, so it adapts to the room's configuration. You'll find it as an alternative immersive format in many premium auditoriums.",
    specs: { Type: "Object-based", Height: "Yes", "Best with": "DTS:X DCP" },
    icon: "Waves", color: "emerald",
    related_terms: ["dolby-atmos", "imax-sound"],
    images: [], is_popular: false, created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "t9", slug: "imax-sound", title: "IMAX 12-Channel Sound",
    category: "Audio",
    short_desc: "IMAX's purpose-built sound system with overhead and side channels.",
    full_desc:
      "IMAX's latest sound design uses 12 discrete channels, including overhead and side-surround speakers, all powered to fill the giant auditorium with uncompressed audio. It's tuned per-room by IMAX, so the experience is consistent across locations.",
    specs: { Channels: "12 discrete", Overhead: "Yes", Calibration: "Per-auditorium by IMAX" },
    icon: "AudioLines", color: "cyan",
    related_terms: ["imax", "dolby-atmos"],
    images: [], is_popular: false, created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "t10", slug: "silver-screen", title: "Silver Screen (3D)",
    category: "Screen",
    short_desc: "A reflective screen that preserves polarised light for brighter 3D.",
    full_desc:
      "Polarised 3D systems (like RealD) need the screen to keep light polarised as it bounces back. A 'silver' screen is coated to do exactly that, giving brighter, crisper 3D than a standard white matte screen — at the cost of slightly uneven brightness at the edges in 2D.",
    specs: { Gain: "High (1.8–2.4)", "Best for": "Polarised 3D", Material: "Aluminised coating" },
    icon: "Projector", color: "slate",
    related_terms: ["imax", "laser-projection"],
    images: [], is_popular: false, created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "t11", slug: "epiq", title: "EPIQ",
    category: "Format",
    short_desc: "A premium large-format brand pairing a giant screen with laser + Atmos.",
    full_desc:
      "EPIQ is a premium large-format (PLF) concept: an oversized wall-to-wall screen, 4K RGB laser projection and Dolby Atmos sound, positioned as a rival to IMAX. Specs vary by operator but the recipe is always 'biggest screen in the building, best light engine, immersive sound'.",
    specs: { Projection: "4K RGB laser", Sound: "Dolby Atmos", Screen: "Wall-to-wall PLF" },
    icon: "Sparkles", color: "emerald",
    related_terms: ["imax", "laser-projection", "dolby-atmos"],
    images: [], is_popular: false, created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "t12", slug: "hfr", title: "HFR (High Frame Rate)",
    category: "Format",
    short_desc: "More frames per second for ultra-smooth, judder-free motion.",
    full_desc:
      "Cinema has traditionally run at 24 frames per second. HFR doubles or more that rate (48, 60, even 120 fps), eliminating the strobing and judder you see in fast pans. It's divisive — some love the clarity, others find it looks 'too real' — but on the right screen it's strikingly smooth.",
    specs: { Standard: "24 fps", HFR: "48–120 fps", "Needs": "HFR DCP + capable projector" },
    icon: "Gauge", color: "rose",
    related_terms: ["dcp", "resolution"],
    images: [], is_popular: false, created_at: "2024-01-01T00:00:00Z",
  },
];

// Format Visualizer demo data (populated later; empty keeps demo mode working).
export const keyframes: MovieKeyframe[] = [];
export const interiorTemplates: TheatreInteriorTemplate[] = [];
export const availableFormats: MovieAvailableFormat[] = [];
