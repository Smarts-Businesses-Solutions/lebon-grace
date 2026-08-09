#!/usr/bin/env bash
# Install (or refresh) the scheduled health checks on cx53. Idempotent.
#
#   scp ops/health/deploy-verify.sh root@116.203.242.215:/usr/local/bin/lebon-grace-deploy-verify.sh
#   bash ops/health/install.sh          # run ON the box
#
# Two timers, two different questions:
#
#   lebon-grace-uptime.timer          every 2 min   is the shop UP?
#   lebon-grace-deploy-verify.timer   every 15 min  is it serving what we shipped?
#
# The second exists because the first would have passed on every fault found on
# 2026-08-09 — all of them returned 200 with the right title and a valid dpl=.
#
# Cost: nothing. systemd on a box that is already paid for, alerting into the
# GlitchTip the app already reports to. No third-party tier to outgrow, which
# is the constraint this estate works under.
set -euo pipefail

SCRIPT=/usr/local/bin/lebon-grace-deploy-verify.sh
[ -f "$SCRIPT" ] || { echo "ERROR: $SCRIPT not present — scp it across first" >&2; exit 1; }
chmod +x "$SCRIPT"

cat > /etc/systemd/system/lebon-grace-deploy-verify.service <<'UNIT'
[Unit]
Description=Deployment correctness check for shop.lebon-grace.com
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/lebon-grace-deploy-verify.sh
UNIT

# 15 minutes, not 2. It makes ~6 requests per run, and the failures it catches
# (a stale image, a soft 404 regression, withdrawn stock reappearing) are not
# the kind that need sub-minute detection. RandomizedDelay keeps it from
# landing on the same second as the uptime check every time.
cat > /etc/systemd/system/lebon-grace-deploy-verify.timer <<'UNIT'
[Unit]
Description=Run the shop.lebon-grace.com deployment correctness check every 15 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min
RandomizedDelaySec=60
AccuracySec=30s
Unit=lebon-grace-deploy-verify.service

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now lebon-grace-deploy-verify.timer

echo "installed. next runs:"
systemctl list-timers --all | grep -E 'lebon-grace' || true
echo
echo "one-shot check now:  systemctl start lebon-grace-deploy-verify.service && journalctl -u lebon-grace-deploy-verify -n 20 --no-pager"
