#!/usr/bin/env bash
#
# Ship whatever is on origin/main to shop.lebon-grace.com.
#
# Run from the workstation. Everything it does happens on cx53; the only thing
# that crosses the wire is the ssh command itself. The source comes from GitHub,
# not from your working tree, so what gets built is exactly the commit that was
# pushed — you cannot accidentally deploy an uncommitted edit, and the built
# image can always be traced back to a SHA.
#
#   ./scripts/deploy-cx53.sh
#
# WHAT IT DEPLOYS TO. The public shop is a Coolify SERVICE, not the Coolify
# APPLICATION of the same name. The application serves nothing; three deploys
# were sent to it before anyone noticed. The service uuid below is the one that
# is actually behind the tunnel from the AWS Caddy box.
#
# WHY THIS IS NOT "coolify deploy". Coolify builds from its own git integration,
# and the compose for this service pins `image: lebon-grace:cx53` — a local tag
# with no registry behind it. The image has to exist on the host before compose
# is told to come up. That is the whole reason this script exists.
#
# The container is NOT restarted through Docker Desktop or the daemon: this host
# runs well over a hundred containers for unrelated projects, and bouncing the
# daemon to ship one app takes all of them down.
set -euo pipefail

# verify:deploy is an npm script, so this has to run from the repo root however
# it was invoked.
cd "$(dirname "$0")/.."

HOST=${LG_SSH_HOST:-root@116.203.242.215}
KEY=${LG_SSH_KEY:-$HOME/.ssh/hetzner_ed25519}
SVC=lixqbqbkz39l0bnz9xv2227t
REPO=https://github.com/Smarts-Businesses-Solutions/lebon-grace.git

echo "==> deploying origin/main to $HOST"

OUT=$(ssh -o BatchMode=yes -i "$KEY" "$HOST" "SVC=$SVC REPO=$REPO bash -s" <<'REMOTE'
set -euo pipefail

SRC=/root/build/lg-src
NAME=lebon-grace-$SVC
DEP=$(date -u +%Y%m%d%H%M%S)

# --- source ----------------------------------------------------------------
# reset --hard, not pull: a merge conflict on a build box is not a thing anyone
# should have to resolve over ssh, and nothing here is ever edited by hand.
if [ -d "$SRC/.git" ]; then
  cd "$SRC"
  git fetch --quiet origin main
  git reset --hard --quiet origin/main
else
  rm -rf "$SRC"
  git clone --quiet --depth 20 "$REPO" "$SRC"
  cd "$SRC"
fi
SHA=$(git rev-parse HEAD)
echo "  source  $(git log --oneline -1)"

# --- build -----------------------------------------------------------------
# BUILD_ENV is one blob rather than an ARG per variable: NEXT_PUBLIC_* values are
# inlined by Next at BUILD time, so they have to be present now, not at run time.
# /tmp/buildenv.txt holds the real values and never leaves this host. A
# placeholder UMAMI_ORIGIN produces "Invalid rewrite" and fails the build, which
# is the usual reason a build works locally and not here.
[ -s /tmp/buildenv.txt ] || { echo "  /tmp/buildenv.txt is missing or empty" >&2; exit 1; }

docker build --build-arg BUILD_ENV="$(cat /tmp/buildenv.txt)" \
             --build-arg DEPLOYMENT_ID="$DEP" \
             --build-arg GIT_COMMIT_SHA="$SHA" \
             -t lebon-grace:pending . 2>&1 | tail -3

# --- swap ------------------------------------------------------------------
OLD=$(docker inspect "$NAME" --format '{{.Id}}' | cut -c1-12)

# Tag the CURRENT image before overwriting the tag, so there is something to go
# back to. Doing this after the retag would preserve the new image twice.
#
# Tagged from the RUNNING CONTAINER'S image id, not from `lebon-grace:cx53`.
# A tag is a label anything can remove: Coolify's periodic docker cleanup
# pruned every lebon-grace tag on this host while the container carried on
# serving from the now-untagged image, and this line then aborted the deploy
# with "No such image: lebon-grace:cx53". The image a container is running
# cannot be pruned while it runs, so `.Image` is the one reference that is
# always there, and it is also precisely the thing you would want to roll back
# to.
CURRENT_IMAGE=$(docker inspect "$NAME" --format '{{.Image}}')
ROLLBACK="lebon-grace:rollback-$(date +%Y%m%dT%H%M%SZ)"
docker tag "$CURRENT_IMAGE" "$ROLLBACK"
echo "  rollback  $ROLLBACK  (from $(echo "$CURRENT_IMAGE" | cut -c8-19))"

docker tag lebon-grace:pending lebon-grace:cx53
cd "/data/coolify/services/$SVC"
docker compose -p "$SVC" up -d 2>&1 | sed 's/^/  /'

# `up -d` exits 0 whether or not it replaced anything.
NEW=$(docker inspect "$NAME" --format '{{.Id}}' | cut -c1-12)
[ "$OLD" != "$NEW" ] || { echo "  FAIL: container was not replaced" >&2; exit 1; }
echo "  container  $OLD -> $NEW"
echo "  deployment $DEP"
REMOTE
)
echo "$OUT"

DEP=$(printf '%s' "$OUT" | sed -n 's/^  deployment \([0-9]*\)$/\1/p' | tail -1)
[ -n "$DEP" ] || { echo "could not read the deployment id back from the host" >&2; exit 1; }

echo
echo "==> confirming the served build, which is the only first-hand evidence"
# A replaced container can still start from a stale image, so --expect rather
# than a bare check: Next stamps every asset URL with ?dpl=<DEPLOYMENT_ID>, and
# nothing short of that exact string coming back proves this build is the one
# answering. Checked from OUTSIDE the host, through the same path a customer
# takes, so the tunnel and the Caddy box are in the test too.
npm run verify:deploy -- --expect "$DEP"
