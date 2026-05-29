import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only client for reading PUBLIC catalogue data (movies, theatres,
 * screens). It prefers the service-role key, which bypasses RLS, so the
 * read-only public app renders even before public-read RLS policies exist.
 *
 * SECURITY:
 *  - This module is `server-only`; importing it from a Client Component is a
 *    build error, so the service-role key can never reach the browser.
 *  - Use it for READS of public catalogue tables only. Privileged auth flows
 *    keep using the anon client in ./server.ts and ./client.ts.
 *  - The cleaner long-term posture is public-read RLS policies + the anon key;
 *    if you add those, swap createReadClient() back to the anon server client.
 */
export function createReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
