import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Proof that the database we are about to write to is disposable (TR-03).
 *
 * The lifecycle test creates orders, moves them through every status and
 * deletes them. Run against the live shop it would put fake orders in the
 * workshop queue and, if it died halfway, leave them there.
 *
 * The obvious guard is to reject production's URL. That guard is **fail-open**:
 * it permits every URL that is not on the list, so a typo, a new host, a copied
 * env var or a future production domain sails straight through to the live
 * shop. The list has to be exhaustive to work, and there is no way to know when
 * it stops being exhaustive.
 *
 * This is the **fail-closed** inverse. The test refuses to run unless it can
 * read a row in which the database states, in its own words, that it is safe to
 * destroy. `staging_marker` is created by ops/staging/setup.sh and exists
 * nowhere else — production has never had it and never will. The check cannot
 * be satisfied by omission or accident, only by someone having deliberately
 * built a throwaway database.
 *
 * The production-host rejection is kept as well, as a second belt. It is not
 * the guard; it is a louder error message for the most likely mistake.
 */

/** Hosts that must never be written to by a test, whatever else is true. */
const FORBIDDEN = ["sb-lebon-grace.axiomsynapse.com", "shop.lebon-grace.com", "lebon-grace.com"];

export interface StagingHandle {
  db: SupabaseClient;
  url: string;
}

export class NotStagingError extends Error {}

/**
 * Returns a client for staging, or throws.
 *
 * Every failure mode gets its own message, because "could not connect" and
 * "connected to the wrong database" call for completely different reactions and
 * a shared error would blur them.
 */
export async function requireStaging(): Promise<StagingHandle> {
  const url = process.env.STAGING_SUPABASE_URL || "";
  const key = process.env.STAGING_SUPABASE_SERVICE_KEY || "";

  if (!url || !key) {
    throw new NotStagingError(
      "STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_KEY are not set.\n" +
        "This test writes and deletes rows, so it will not guess at a database.\n" +
        "Start staging with ops/staging/setup.sh and export both from " +
        "ops/staging/.env.staging (see ops/staging/README.md)."
    );
  }

  // Belt: the most likely mistake, named explicitly.
  const host = (() => { try { return new URL(url).host; } catch { return url; } })();
  if (FORBIDDEN.some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new NotStagingError(
      `REFUSING: ${host} is a production host. This test destroys data.`
    );
  }

  /*
   * Two shapes of staging, and the difference is one URL prefix.
   *
   * The long-lived stack on cx53 runs kong in front of PostgREST exactly as
   * production does, so supabase-js's `${url}/rest/v1/...` lands correctly and
   * nothing special is needed.
   *
   * CI runs PostgREST as a service container with NO kong. Kong contributes
   * API-key auth, ACLs and CORS — none of which this suite exercises — and its
   * declarative config has to be a mounted FILE, which a service container
   * cannot have because it starts before the repo is checked out. So CI talks
   * to PostgREST directly and this shim removes the prefix kong would have
   * stripped.
   *
   * Stated explicitly via an env var rather than sniffed from the URL: a guess
   * that is usually right is exactly the kind of thing that fails silently
   * against a host somebody adds later.
   */
  const direct = process.env.STAGING_REST_DIRECT === "1";
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: direct
      ? {
          fetch: (input: RequestInfo | URL, init?: RequestInit) => {
            const href = typeof input === "string" ? input : input.toString();
            return fetch(href.replace("/rest/v1/", "/"), init);
          },
        }
      : undefined,
  });

  // Braces: the actual guard.
  const { data, error } = await db.from("staging_marker").select("safe_to_destroy").eq("id", 1);

  if (error) {
    throw new NotStagingError(
      `REFUSING: could not read staging_marker from ${host} — ${error.message}\n` +
        "A database without that table is not one this test may touch. If this IS " +
        "your staging database, re-run ops/staging/setup.sh to create the marker."
    );
  }
  if (!data?.length || data[0].safe_to_destroy !== true) {
    throw new NotStagingError(
      `REFUSING: ${host} has a staging_marker table but does not declare itself safe to destroy.`
    );
  }

  return { db, url };
}
