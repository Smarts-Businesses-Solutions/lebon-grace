#!/bin/bash
# Watch for dimension images and auto-backup before any processing
MDF_DIR="/c/Users/user/Desktop/aprojects/lebon-grace/public/images/mdf"
BAK_DIR="$MDF_DIR/originals"
TOTAL=50

while true; do
  count=$(ls "$MDF_DIR"/*-dim.png 2>/dev/null | wc -l)
  if [ "$count" -ge "$TOTAL" ]; then
    echo "All $count dimension images arrived! Backing up..."
    cp "$MDF_DIR"/*-dim.png "$BAK_DIR"/ 2>/dev/null
    echo "Backed up $count dimension images to originals/"
    break
  elif [ "$count" -gt 0 ]; then
    echo "$(date +%H:%M:%S) $count/$TOTAL dimension images so far..."
    # Auto-backup any new ones
    for f in "$MDF_DIR"/*-dim.png; do
      base=$(basename "$f")
      if [ ! -f "$BAK_DIR/$base" ]; then
        cp "$f" "$BAK_DIR/$base"
        echo "  Backed up: $base"
      fi
    done
  fi
  sleep 5
done
