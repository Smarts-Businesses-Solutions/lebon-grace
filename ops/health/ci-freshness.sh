#!/usr/bin/env bash
# Is the CI gate still RUNNING? — third sibling to lebon-grace-uptime.sh and
# deploy-verify.sh, and it asks a question neither of them can.
#
# ── Why this exists ──────────────────────────────────────────────────────────
#
# `.forgejo/workflows/ci.yml` was committed, described in four documents as this
# project's quality gate, and had never executed once. The repository did not
# exist in Forgejo, so nothing was listening. Nothing reported that, because a
# pipeline that never runs produces no failures — and no failures is exactly
# what a healthy pipeline produces too.
#
# That is the failure this file watches for. It deliberately does NOT check
# whether the last run passed: a red run is loud, visible in the UI, and someone
# is looking at it. A gate that has quietly stopped being connected to anything
# is silent, and silence is indistinguishable from success.
#
# ── What it asserts ──────────────────────────────────────────────────────────
#
#   0. Forgejo answers, the repo exists, and it has run the workflow at least
#      once. PRECONDITION — without it, every "nothing is stuck" below is
#      vacuously true on a repo that does no work at all (L-2).
#   1. A runner is online. With no runner, jobs are accepted and queue forever;
#      the UI shows them pending and nothing ever fails.
#   1b. The repo has Forgejo's git hooks. A repo CREATED AS A MIRROR never gets
#      them — mirrors are updated internally, so they have no use for a
#      post-receive — and converting it to a normal repo does not add them.
#      The result is silent and total: `git push` updates the refs, reports
#      success, and fires NO workflow event. CI simply never runs, and every
#      other check here still passes because the runs that DO exist are green.
#      Found 2026-08-12 on this repo and on mirrortales, both ex-mirrors.
#   2. Forgejo (PRIMARY) and GitHub (FALLBACK) have not diverged. Reported
#      differently depending on direction: Forgejo behind GitHub means code
#      nothing has tested; GitHub behind Forgejo means a stale off-site copy.
#   3. Nothing is stuck. A job waiting or running past MAX_STUCK_MIN is not
#      going to finish, and it will never turn red by itself.
#
# It does NOT assert "there is a run for the current HEAD". ci.yml has a
# paths-ignore for docs/** and **.md, so a documentation commit correctly
# produces no run at all, and asserting otherwise would cry wolf every time
# somebody edited a markdown file.
#
# ── Configuration ────────────────────────────────────────────────────────────
#   /etc/lebon-grace-uptime.env          (shared with the other two checks)
#     SENTRY_DSN=...                     reuses the app's existing alerting
#     ALERT_WEBHOOK_URL=...              optional JSON POST
#     FORGEJO_API=http://10.210.27.3:3000/api/v1
#     FORGEJO_TOKEN_FILE=/root/.fj-token
#     FORGEJO_REPO=kairos/lebon-grace
#     GITHUB_REPO=Smarts-Businesses-Solutions/lebon-grace
#     MAX_DIVERGENCE_MIN=45              tolerates the gap between the two
#                                        halves of one `git push`
#     MAX_STUCK_MIN=60                   a full green run takes ~20m
#
# NOTE: deliberately NOT `set -o pipefail` — see the long note in
# deploy-verify.sh. grep in a pipeline plus pipefail is a false-negative factory.
set -u

CONF=${CONF:-/etc/lebon-grace-uptime.env}
[ -f "$CONF" ] && . "$CONF"

FORGEJO_API=${FORGEJO_API:-http://10.210.27.3:3000/api/v1}
FORGEJO_TOKEN_FILE=${FORGEJO_TOKEN_FILE:-/root/.fj-token}
FORGEJO_REPO=${FORGEJO_REPO:-kairos/lebon-grace}
GITHUB_REPO=${GITHUB_REPO:-Smarts-Businesses-Solutions/lebon-grace}
FORGEJO_CTR=${FORGEJO_CTR:-forgejo-apdhrb0srx5y8uhe0yzsexyg}
# Renamed from MAX_MIRROR_LAG_MIN when the mirror became a two-way push. The
# old name is still honoured so an existing /etc conf keeps its tuning.
MAX_DIVERGENCE_MIN=${MAX_DIVERGENCE_MIN:-${MAX_MIRROR_LAG_MIN:-45}}
MAX_STUCK_MIN=${MAX_STUCK_MIN:-60}

CURL="curl -sS --max-time 20"
problems=()
note() { problems+=("$1"); }

sha40() { grep -oE '"(sha|id)" *: *"[0-9a-f]{40}"' | head -1 | grep -oE '[0-9a-f]{40}'; }

# Sentinel emitted by db() when a query could not be RUN, as opposed to
# returning no rows.
#
# It travels on STDOUT deliberately. db() is always called as `$(db ...)`, which
# is a SUBSHELL, so a variable set inside it never reaches the caller — the
# first version of this fix used a global flag and was therefore dead code the
# moment it was written. Caught by testing it, not by reading it.
DBFAIL="__DBFAIL__"

# Query Forgejo's sqlite, retrying a locked database.
#
# THIS FUNCTION USED TO LIE. It swallowed every failure into an empty string,
# and every caller read empty as "the thing does not exist" — so a transient
# `database is locked` made this script announce "no Forgejo runner is
# registered at all", about a runner that was up and had been for two days.
# That happened for real on 2026-08-10 while a deploy and a CI job were running
# together, and a monitor that cries wolf is one people learn to ignore (L-5).
#
# It is also, precisely, the trap this whole engagement kept finding: an
# absence assertion with no proof the check could have succeeded (L-2) — here,
# inside the monitor written to enforce L-2.
#
# So: retry (locks are transient by nature), and if it still cannot be read,
# say THAT rather than inventing a cause.
db() {
  local out i
  for i in 1 2 3; do
    if out=$(docker exec -i -u git "$FORGEJO_CTR" sqlite3 /data/forgejo/forgejo.db "$1" 2>/dev/null); then
      printf '%s' "$out"; return 0
    fi
    sleep 2
  done
  printf '%s' "$DBFAIL"; return 1
}

TOKEN=""
[ -r "$FORGEJO_TOKEN_FILE" ] && TOKEN=$(cat "$FORGEJO_TOKEN_FILE")

# ── 0. precondition: Forgejo answers and this repo has ever run the gate ─────
# Everything below is an absence assertion. Absence proves nothing unless the
# thing could have been present, which is the trap that voided two findings on
# 2026-08-09: grepping for a string that was not in the file, and reading "0
# hits" out of logs that contained no request lines at all.
ver=$($CURL -o /dev/null -w '%{http_code}' "${FORGEJO_API}/version")
if [ "$ver" != "200" ]; then
  note "Forgejo API unreachable (http ${ver}) — the CI gate cannot be running"
  # No point testing anything else against a forge that is not answering.
  MAX_STUCK_MIN=-1
fi

repo_id=$(db "SELECT id FROM repository WHERE owner_name||'/'||name = '${FORGEJO_REPO}';")
if [ "$repo_id" = "$DBFAIL" ]; then
  # Honest: we do not know. Distinct from "the repo is missing", which is what
  # this used to claim, and distinct from "everything is fine", which is the
  # other way to get it wrong.
  note "could not read Forgejo's database after 3 attempts — CI state UNVERIFIED this run (NOT a claim that CI is broken)"
  repo_id=""
elif [ -z "$repo_id" ]; then
  note "repo ${FORGEJO_REPO} does not exist in Forgejo — this is exactly how ci.yml went 5 months without executing"
else
  runs=$(db "SELECT count(*) FROM action_run WHERE repo_id=${repo_id};")
  if [ "$runs" = "$DBFAIL" ]; then
    note "could not count workflow runs — CI history UNVERIFIED this run"
    runs=""
  else
    [ "${runs:-0}" -gt 0 ] || \
      note "repo ${FORGEJO_REPO} exists but has NEVER run the workflow — a gate that has never executed is decoration"
  fi

  # ── 1. a runner is online ─────────────────────────────────────────────────
  # Jobs queue silently forever when no runner advertises the label they ask
  # for. ci.yml asks for `docker`; nothing fails if nothing is listening.
  idle=$(db "SELECT CAST(strftime('%s','now') - MAX(last_online) AS INT) FROM action_runner;")
  if [ "$idle" = "$DBFAIL" ]; then
    note "could not read the runner table — runner state UNVERIFIED this run"
  elif [ -z "$idle" ]; then
    # Genuinely no rows, and the query DID run — so this really is an empty
    # action_runner table rather than a failed read.
    note "no Forgejo runner is registered at all — every job would queue forever"
  elif [ "$idle" -gt 600 ] 2>/dev/null; then
    note "no runner has checked in for ${idle}s — jobs will queue instead of failing"
  fi

  # ── 3. nothing is stuck ───────────────────────────────────────────────────
  # status: 1 success, 2 failure, 3 cancelled, 4 skipped, 5 waiting, 6 running,
  # 7 blocked. A job that has been waiting or running past a full pipeline's
  # duration is not going to finish on its own, and will never turn red.
  if [ "$MAX_STUCK_MIN" -ge 0 ]; then
    stuck=$(db "SELECT count(*) FROM action_run WHERE repo_id=${repo_id} AND status IN (5,6,7) AND created < strftime('%s','now') - ${MAX_STUCK_MIN}*60;")
    # A failed read must not read as "nothing is stuck" — that is the same
    # empty-means-fine mistake, in the other direction.
    if [ "$stuck" = "$DBFAIL" ]; then
      note "could not check for stuck runs — UNVERIFIED this run"
    else
      [ "${stuck:-0}" -eq 0 ] || \
        note "${stuck} CI run(s) stuck waiting/running for over ${MAX_STUCK_MIN}m — they will never go red by themselves"
    fi
  fi
fi

# ── 2. Forgejo and GitHub have not diverged ──────────────────────────────────
#
# The topology changed: **Forgejo is primary, GitHub is the fallback.** The repo
# is no longer a pull mirror — `git push` sends to both URLs on one remote, and
# CI runs on whatever reaches Forgejo.
#
# That gives two DIFFERENT failure modes, and the old check could only describe
# one of them, in language about a mirror that no longer exists:
#
#   A. Forgejo is BEHIND GitHub. Something reached the fallback and not the
#      primary — the push to Forgejo failed (its URL needs an SSH tunnel, and a
#      failure there is easy to miss behind the GitHub line that succeeded), or
#      the repo was read-only. NOTHING HAS TESTED THAT CODE. This is the
#      dangerous one, and it happened on 2026-08-12: three pushes reported clean
#      while their Forgejo half had failed.
#
#   B. GitHub is BEHIND Forgejo. CI is fine; the off-site copy is stale. Not an
#      immediate risk, but if cx53 is lost so is the newest work.
#
# Which one it is cannot be decided by comparing SHAs — that only says "these
# differ". It is decided by ASKING FORGEJO WHETHER IT HAS GITHUB'S COMMIT. If it
# does, Forgejo is ahead (case B). If it does not, GitHub holds work Forgejo has
# never seen (case A).
#
# Age still gates both, so the seconds between the two halves of one `git push`
# do not read as divergence.
gh_json=$($CURL -H 'Accept: application/vnd.github+json' "https://api.github.com/repos/${GITHUB_REPO}/commits/main")
gh_sha=$(printf '%s' "$gh_json" | sha40)
gh_date=$(printf '%s' "$gh_json" | grep -oE '"date" *: *"[0-9T:Z.-]+"' | head -1 | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]+')

if [ -z "$gh_sha" ]; then
  # Unauthenticated GitHub API is 60/hr per IP; at two calls an hour this should
  # never rate-limit, but say so plainly rather than silently skipping the check.
  note "could not read GitHub's main HEAD — primary/fallback divergence UNVERIFIED this run"
elif [ -z "${TOKEN}" ]; then
  note "no Forgejo token at ${FORGEJO_TOKEN_FILE} — primary/fallback divergence UNVERIFIED this run"
else
  fj_sha=$($CURL -H "Authorization: token ${TOKEN}" "${FORGEJO_API}/repos/${FORGEJO_REPO}/branches/main" | sha40)
  if [ -z "$fj_sha" ]; then
    note "could not read Forgejo's main HEAD for ${FORGEJO_REPO} — the PRIMARY is unreachable"
  elif [ "$fj_sha" != "$gh_sha" ]; then
    age=$(( ( $(date -u +%s) - $(date -u -d "${gh_date}Z" +%s 2>/dev/null || echo 0) ) / 60 ))
    if [ "$age" -gt "$MAX_DIVERGENCE_MIN" ] 2>/dev/null; then
      # Does the primary know GitHub's commit? 200 = yes (Forgejo is ahead).
      code=$($CURL -o /dev/null -w '%{http_code}' -H "Authorization: token ${TOKEN}"              "${FORGEJO_API}/repos/${FORGEJO_REPO}/git/commits/${gh_sha}")
      if [ "$code" = "200" ]; then
        note "GitHub fallback is BEHIND: Forgejo has ${fj_sha:0:7}, GitHub still ${gh_sha:0:7} (${age}m) — CI is fine, the off-site copy is stale"
      else
        note "CI IS BLIND: GitHub main ${gh_sha:0:7} is ${age}m old and Forgejo does NOT have it — that code has never been tested. Check the push to the primary succeeded (it needs the tunnel on 3900)"
      fi
    fi
  fi
fi

# ── report ───────────────────────────────────────────────────────────────────
if [ ${#problems[@]} -eq 0 ]; then
  echo "ci-freshness: OK ${FORGEJO_REPO} (${runs:-?} runs, primary and fallback agree)"
  exit 0
fi

msg="lebon-grace CI GATE IS NOT WATCHING: $(printf '%s; ' "${problems[@]}")"
echo "ci-freshness: FAIL — ${msg}"

# Same alert path as the other two checks — reuse the routing that exists rather
# than invent a channel.
if [ -n "${SENTRY_DSN:-}" ]; then
  key=$(printf '%s' "$SENTRY_DSN" | sed -E 's#^https?://([^@]+)@.*#\1#')
  host=$(printf '%s' "$SENTRY_DSN" | sed -E 's#^https?://[^@]+@([^/]+)/.*#\1#')
  proj=$(printf '%s' "$SENTRY_DSN" | sed -E 's#.*/([0-9]+)$#\1#')
  eid=$(tr -d '-' < /proc/sys/kernel/random/uuid 2>/dev/null)
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  if [ -n "$key" ] && [ -n "$host" ] && [ -n "$proj" ] && [ -n "$eid" ]; then
    payload=$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g')
    printf '{"event_id":"%s","sent_at":"%s"}\n{"type":"event"}\n{"event_id":"%s","timestamp":"%s","platform":"other","level":"error","logger":"ci-freshness","server_name":"cx53","message":{"formatted":"%s"}}\n' \
      "$eid" "$ts" "$eid" "$ts" "$payload" \
    | curl -fsS --max-time 15 -o /dev/null \
        -X POST "https://${host}/api/${proj}/envelope/" \
        -H "Content-Type: application/x-sentry-envelope" \
        -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_client=ci-freshness/1.0, sentry_key=${key}" \
        --data-binary @- || echo "ci-freshness: sentry notify failed" >&2
  fi
fi

if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
  curl -fsS --max-time 15 -o /dev/null -X POST "$ALERT_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"level\":\"error\",\"text\":$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g; s/^/"/; s/$/"/')}" \
    || echo "ci-freshness: webhook notify failed" >&2
fi

exit 1
