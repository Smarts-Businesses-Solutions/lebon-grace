#!/usr/bin/env bash
# scripts/coolify-register-git-app.sh
#
# Re-register lebon-grace in Coolify as a GIT-BACKED APPLICATION instead of the
# SERVICE it is today.
#
# WHY THIS EXISTS
# ---------------
# The running container carries `coolify.type=service`. A Coolify *service* is
# recreated from a compose file that pins a pre-built local image tag
# (`lebon-grace:cx53`). Coolify never checks out the repository and never runs a
# build, so "Deploy" recreates the container from the image already on the host.
# That is why commits sat undeployed while every deploy reported success: the
# deploy genuinely succeeded, it just had nothing to do with the source.
#
# There is no in-place "convert service to application" in Coolify. The change is
# create-new + cut-over + retire-old, which is what this script sets up.
#
# SAFETY MODEL
# ------------
# * Dry-run by default. Nothing is created unless you pass --apply.
# * Blue-green: the new application is created with NO domain, so it cannot take
#   traffic. shop.lebon-grace.com keeps resolving to the service until you move
#   the domain deliberately, in the UI, after the new app is verified.
# * This script never reads, copies or prints a secret. Secret env vars are
#   listed by NAME for you to paste into the Coolify UI. That is deliberate --
#   see docs/ops/COOLIFY-GIT-DEPLOY-MIGRATION.md, "Why the secrets are not
#   copied": they are being rotated anyway, so the new app should receive the
#   NEW values, not a copy of the compromised ones.
#
# USAGE
#   # 1. Put a Coolify SaaS API token (read+write) in .env.local:
#   #      COOLIFY_API_TOKEN=...
#   #    Create it at: Coolify UI -> Keys & Tokens -> API tokens
#   bash scripts/coolify-register-git-app.sh            # dry run, shows the plan
#   bash scripts/coolify-register-git-app.sh --apply    # create the application
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --- Facts about the current deployment, measured not remembered -------------
# Verified 2026-08-09 from the running container's labels:
#   coolify.type=service, coolify.serviceId=67837
SERVICE_UUID="lixqbqbkz39l0bnz9xv2227t"
APP_NAME="lebon-grace"
GIT_REPOSITORY="git@github.com:Smarts-Businesses-Solutions/lebon-grace.git"
GIT_BRANCH="main"
PORT="3000"
COOLIFY_BASE="${COOLIFY_BASE_URL:-https://app.coolify.io/api/v1}"

APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true

# --- Token, read from .env.local so it never appears in a command line -------
TOKEN="$(grep -m1 '^COOLIFY_API_TOKEN=' "$REPO_ROOT/.env.local" 2>/dev/null | cut -d= -f2- | tr -d '"'"'"' \r' || true)"
if [[ -z "$TOKEN" ]]; then
  cat >&2 <<'MSG'
ERROR: COOLIFY_API_TOKEN not found in .env.local

  This is the one thing that cannot be discovered from the host. lebon-grace
  is controlled by the Coolify SaaS instance at app.coolify.io, and no token
  for it is recorded. The Coolify tokens that do exist in supabase.local
  authenticate against different Coolify instances and will not work here.

  Create one:  Coolify UI -> Keys & Tokens -> API tokens -> Create (read+write)
  Then add to .env.local (already gitignored):
      COOLIFY_API_TOKEN=<the token>
MSG
  exit 1
fi

api() { # api METHOD PATH [BODY]
  local method="$1" path="$2" body="${3:-}" raw code out
  if [[ -n "$body" ]]; then
    raw=$(curl -sS -X "$method" "$COOLIFY_BASE$path" \
      -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" \
      -H "Content-Type: application/json" --data-binary "$body" \
      -w $'\n__CODE__:%{http_code}')
  else
    raw=$(curl -sS -X "$method" "$COOLIFY_BASE$path" \
      -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" \
      -w $'\n__CODE__:%{http_code}')
  fi
  code=$(printf '%s' "$raw" | tail -1 | sed 's/^__CODE__://')
  out=$(printf '%s' "$raw" | sed '$d')
  if [[ "$code" =~ ^2 ]]; then printf '%s' "$out"; return 0; fi
  echo "Coolify API $method $path -> HTTP $code" >&2
  echo "  $out" >&2
  return 1
}

command -v jq >/dev/null || { echo "ERROR: jq required" >&2; exit 1; }

echo "==> Coolify: $COOLIFY_BASE"
echo "==> Mode: $([[ "$APPLY" == true ]] && echo APPLY || echo 'DRY RUN (pass --apply to execute)')"
echo

# --- 1. Locate the project + server that already host the service ------------
# Taking these from the existing service rather than hardcoding means the new
# application lands on the same box and project without a second source of truth.
echo "==> Resolving project + server from the existing service"
svc=$(api GET "/services/$SERVICE_UUID") || {
  echo "Could not read service $SERVICE_UUID. Is the token scoped to this team?" >&2; exit 1; }
server_uuid=$(printf '%s' "$svc" | jq -r '.destination.server.uuid // .server.uuid // empty')
project_uuid=$(printf '%s' "$svc" | jq -r '.environment.project.uuid // empty')
env_name=$(printf '%s' "$svc" | jq -r '.environment.name // "production"')
echo "    server_uuid : ${server_uuid:-<UNRESOLVED>}"
echo "    project_uuid: ${project_uuid:-<UNRESOLVED>}"
echo "    environment : $env_name"
if [[ -z "$server_uuid" || -z "$project_uuid" ]]; then
  echo >&2
  echo "ERROR: could not resolve server/project from the service payload." >&2
  echo "  Re-run with the shape printed below and adjust the jq paths:" >&2
  printf '%s' "$svc" | jq 'del(.docker_compose, .docker_compose_raw)' >&2
  exit 1
fi

# --- 2. Deploy key for the private repository --------------------------------
echo
echo "==> Deploy key"
keys=$(api GET "/security/keys")
key_uuid=$(printf '%s' "$keys" | jq -r '[.[] | select(.name|test("lebon";"i"))][0].uuid // empty')
if [[ -z "$key_uuid" ]]; then
  echo "    No lebon-grace deploy key found in Coolify."
  echo "    Existing keys: $(printf '%s' "$keys" | jq -r '[.[].name] | join(", ")')"
  echo
  echo "    Add one first: Coolify UI -> Keys & Tokens -> Private Keys, then add"
  echo "    its PUBLIC half to the GitHub repo under Settings -> Deploy keys."
  echo "    (Read-only is sufficient; Coolify only needs to clone.)"
  [[ "$APPLY" == true ]] && exit 1
else
  echo "    using key: $(printf '%s' "$keys" | jq -r --arg u "$key_uuid" '.[]|select(.uuid==$u)|.name')"
fi

# --- 3. Create the application ------------------------------------------------
# instant_deploy:false and no domain -> created cold, takes no traffic.
body=$(jq -n \
  --arg project_uuid "$project_uuid" --arg server_uuid "$server_uuid" \
  --arg environment_name "$env_name" --arg git_repository "$GIT_REPOSITORY" \
  --arg git_branch "$GIT_BRANCH" --arg private_key_uuid "${key_uuid:-}" \
  --arg name "$APP_NAME-git" --arg ports "$PORT" \
  '{
     project_uuid: $project_uuid,
     server_uuid: $server_uuid,
     environment_name: $environment_name,
     git_repository: $git_repository,
     git_branch: $git_branch,
     private_key_uuid: $private_key_uuid,
     build_pack: "dockerfile",
     dockerfile_location: "/Dockerfile",
     name: $name,
     description: "lebon-grace built from git. Replaces the service that pinned a hand-built lebon-grace:cx53 tag and therefore never built from source.",
     ports_exposes: $ports,
     instant_deploy: false,
     is_auto_deploy_enabled: false
   }')

echo
echo "==> POST /applications/private-deploy-key"
printf '%s\n' "$body" | jq .
if [[ "$APPLY" != true ]]; then
  echo
  echo "DRY RUN -- nothing created. Re-run with --apply to create the application."
  exit 0
fi

resp=$(api POST "/applications/private-deploy-key" "$body")
app_uuid=$(printf '%s' "$resp" | jq -r '.uuid // empty')
[[ -n "$app_uuid" ]] || { echo "No uuid returned:" >&2; printf '%s' "$resp" >&2; exit 1; }
echo "    created application uuid: $app_uuid"

# --- 4. Non-secret env vars only ---------------------------------------------
# Every value below is already public: it ships in the browser bundle, appears on
# the rendered page, or is an internal hostname. Nothing here is a credential,
# which is why it is safe to set from a script. The secrets are listed after.
echo
echo "==> Setting non-secret env vars"
nonsecret=$(jq -n '[
  {key:"NEXT_PUBLIC_APP_URL",           value:"https://shop.lebon-grace.com", is_build_time:true},
  {key:"APP_URL",                       value:"https://shop.lebon-grace.com", is_build_time:false},
  {key:"UMAMI_ORIGIN",                  value:"http://umami:3000",            is_build_time:true},
  {key:"NODE_ENV",                      value:"production",                   is_build_time:false}
] | map(. + {is_preview:false, is_literal:false, is_multiline:false, is_shown_once:false})')
api PATCH "/applications/$app_uuid/envs/bulk" "$(jq -n --argjson d "$nonsecret" '{data:$d}')" >/dev/null
echo "    done"

cat <<EOF

===================================================================
  APPLICATION CREATED -- NOT YET SERVING TRAFFIC
===================================================================
  uuid: $app_uuid

  REMAINING STEPS (deliberately manual -- they involve secrets and
  a live payment path):

  1. Add the secret env vars in the Coolify UI. Use the ROTATED values,
     not the current ones. Names the app actually reads:

       Build-time (tick "Build Variable" -- inlined into the bundle):
         NEXT_PUBLIC_SUPABASE_URL
         NEXT_PUBLIC_SENTRY_DSN
         NEXT_PUBLIC_UMAMI_WEBSITE_ID

       Runtime, REQUIRED -- the shop is broken without these:
         SUPABASE_SERVICE_ROLE_KEY   STRIPE_SECRET_KEY
         STRIPE_WEBHOOK_SECRET       RESEND_API_KEY
         ADMIN_PASSWORD              ADMIN_SESSION_SECRET

       Runtime, optional -- each has a guard or a fallback, verified in
       source, so omitting one degrades a feature rather than breaking:
         SENTRY_AUTH_TOKEN       CJDS_API_KEY
         CONTACT_EMAIL           CONTACT_PHONE_DISPLAY
         CONTACT_WHATSAPP        MAIL_FROM_ADDRESS
         RESEND_FROM_ADDRESS     WHATSAPP_ACCESS_TOKEN
         WHATSAPP_PHONE_NUMBER_ID

     Deliberately NOT carried over:
       * SUPABASE_URL -- appears only in test setup, never in app code.
       * NEXT_PUBLIC_SUPABASE_ANON_KEY -- the app reaches Postgres with
         the service-role key server-side and never uses the anon key.
       * the other ~34 credentials the service injects. See the doc.

  2. Deploy:  curl -X POST -H "Authorization: Bearer \$TOKEN" \\
                "$COOLIFY_BASE/deploy?uuid=$app_uuid"

  3. Verify BEFORE moving the domain. Give it a throwaway FQDN, then:
        npm run verify:deploy
     It must report a dpl= that is newer than the current live one.

  4. Only then move shop.lebon-grace.com to the new application and
     stop the old service. Keep the service stopped, not deleted, until
     a real order has been placed end-to-end.
===================================================================
EOF
