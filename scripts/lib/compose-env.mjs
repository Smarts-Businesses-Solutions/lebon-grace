/**
 * Writing a value into a Docker Compose `.env` safely.
 *
 * A `.env` next to a compose file is not a plain key=value file. Compose reads
 * it for interpolation, so `$` in a VALUE is a variable reference, not a
 * character. `FOO=abc$def` sets FOO to `abc` followed by whatever `$def`
 * expands to — usually nothing, because it is rarely a real variable.
 *
 * This bit lebon-grace on 2026-08-12. ADMIN_USERS holds credentials shaped
 * `email:<salt>$<hash>`; the file had all 383 characters and the container
 * received 254, one operator's hash silently deleted between the two.
 *
 * `$$` is Compose's documented spelling of a literal `$`.
 * https://docs.docker.com/reference/compose-file/interpolation/
 */
export function escapeComposeEnvValue(value) {
  // "$$$$" is not a typo. In String.replace, `$$` in the replacement means one
  // literal `$`, so four produce the two characters Compose wants.
  return value.replace(/\$/g, "$$$$");
}
