#!/usr/bin/env python3
"""
FTP uploader for the lebon-grace Next.js standalone build.

SAFETY: For a DEDICATED FTP account jailed to the subdomain folder
(domains/new.lebon-grace.com/public_html), the jail root "/" IS that folder.
We upload only into the jail root and never reference the live site.

Usage:
    FTP_PASS='...' python scripts/ftp_deploy.py
Env overrides:
    FTP_HOST  (default ftp.new.lebon-grace.com)
    FTP_USER  (default u298223980.deploynew)
    FTP_PASS  (required)
    FTP_PORT  (default 21)
    LOCAL_DIR (default ../deploy relative to this script -> repo/deploy)
    TARGET_DIR (default "" = jail root = the subdomain public_html)
"""
import ftplib
import os
import socket
import sys

HOST = os.environ.get("FTP_HOST", "ftp.new.lebon-grace.com")
USER = os.environ.get("FTP_USER", "u298223980.deploynew")
PASS = os.environ.get("FTP_PASS", "")
PORT = int(os.environ.get("FTP_PORT", "21"))
TARGET_DIR = os.environ.get("TARGET_DIR", "")  # "" = jail root

HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL_DIR = os.environ.get("LOCAL_DIR", os.path.join(HERE, "..", "deploy"))
LOCAL_DIR = os.path.abspath(LOCAL_DIR)

if not PASS:
    sys.exit("ERROR: set FTP_PASS env var (export FTP_PASS='...')")
if not os.path.isdir(LOCAL_DIR):
    sys.exit(f"ERROR: local deploy dir not found: {LOCAL_DIR}")


def ftp_connect():
    socket.setdefaulttimeout(60)
    ft = ftplib.FTP()
    ft.connect(HOST, PORT, timeout=60)
    ft.login(USER, PASS)
    ft.set_pasv(True)
    return ft


def ensure_dir(ft, abs_path):
    """Create directory abs_path (relative to jail root) recursively."""
    abs_path = abs_path.strip("/")
    if not abs_path:
        return
    cur = ""
    ft.cwd("/")
    for part in abs_path.split("/"):
        cur = f"{cur}/{part}"
        try:
            ft.cwd(cur)
        except ftplib.error_perm:
            ft.mkd(cur)
            ft.cwd(cur)


def upload_tree(ft, local_root, remote_root):
    count = 0
    for dirpath, dirnames, filenames in os.walk(local_root):
        rel = os.path.relpath(dirpath, local_root)
        remote_dir = remote_root if rel == "." else f"{remote_root}/{rel}".strip("/")
        ensure_dir(ft, remote_dir)
        ft.cwd("/" + remote_dir)
        for fn in filenames:
            local_file = os.path.join(dirpath, fn)
            with open(local_file, "rb") as f:
                ft.storbinary(f"STOR {fn}", f)
            count += 1
            if count % 50 == 0:
                print(f"  [{count}] + {remote_dir}/{fn}")
    return count


def main():
    print(f"Connecting FTP -> {HOST}:{PORT} as {USER}")
    ft = ftp_connect()
    print("Connected. Jail root = subdomain public_html (safe; no live-site access).")
    ft.cwd("/")
    print(f"Uploading {LOCAL_DIR} -> /{TARGET_DIR}")
    n = upload_tree(ft, LOCAL_DIR, TARGET_DIR)
    # Final listing to confirm
    ft.cwd("/")
    print("Remote root listing:", ft.nlst())
    ft.quit()
    print(f"DONE. {n} files uploaded.")
    print("Next: hPanel -> new.lebon-grace.com -> Node.js App, entry server.js, Node 20, Start.")


if __name__ == "__main__":
    main()
