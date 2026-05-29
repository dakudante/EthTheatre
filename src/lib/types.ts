// Types mirroring the Supabase schema (see supabase/migrations/0001_init.sql)

export interface Theatre {
  id: string;
  name: string;
  location: string;
  city: string;
  lat: number | null;
  lng: number | null;
  images: string[];
  amenities: string[];
  description: string | null;
  website: string | null;
  created_at: string;
}

export interface Screen {
  id: string;
  theatre_id: string;
  name: string;
  screen_format: string;
  projection_system: string;
  sound_system: string;
  screen_spec: string | null;
  number_of_seats: number | null;
  three_d_system: string | null;
  user_rating: number;
  review_count: number;
  created_at: string;
}

export interface Movie {
  id: string;
  tmdb_id: number | null;
  title: string;
  poster: string | null;
  backdrop: string | null;
  synopsis: string | null;
  release_date: string | null;
  duration: number | null;
  genre: string[];
  format: string[];
  is_now_playing: boolean;
  created_at: string;
}

export interface Dcp {
  id: string;
  screen_id: string;
  movie_id: string;
  runtime: number | null;
  resolution: string;
  format: string[];
  aspect_ratio_container: string;
  audio_mix: string;
  verified: boolean;
  source: string | null;
  created_at: string;
}

export interface RecommendedScreen {
  id: string;
  movie_id: string;
  screen_id: string;
  rank: number;
  score: number;
  reason: string;
  created_at: string;
}

export interface Showtime {
  id: string;
  screen_id: string;
  movie_id: string;
  time: string;
  language: string;
  format: string;
  booking_url: string | null;
  created_at: string;
}

export interface TechTerm {
  id: string;
  slug: string;
  title: string;
  category: string;
  short_desc: string;
  full_desc: string;
  specs: Record<string, string> | null;
  icon: string;
  color: string;
  related_terms: string[];
  images: string[];
  is_popular: boolean;
  created_at: string;
}

// Composed view models used by the UI
export interface ScreenWithTheatre extends Screen {
  theatre: Theatre;
}

export interface RankedScreen {
  rank: number;
  score: number;
  reason: string;
  screen: Screen;
  theatre: Theatre;
  dcp: Dcp | null;
  showtimes: Showtime[];
}

export interface MovieWithRankings extends Movie {
  rankings: RankedScreen[];
}
