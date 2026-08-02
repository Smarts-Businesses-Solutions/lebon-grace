#!/usr/bin/env python3
"""
Generate the "Square Elephant" MDF cutout assets for Lebon Grace.

Produces, for each finish (raw / white) and size (4.8 / 9.6 cm):
  - a HERO (clean product, transparent bg) used as the main listing image
  - a DIM overlay (product + 1cm ruler per side) used as the variant swatch

A faint, tiled, anti-cropping "LEBON GRACE" watermark is baked BEHIND the
product on every asset (the user's requested transparent watermark style).

Output dir: public/images/mdf/
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont

IMG_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "images", "mdf")
os.makedirs(IMG_DIR, exist_ok=True)

# ---- palette ---------------------------------------------------------------
RAW_BODY = (201, 169, 110)      # tan MDF fill
RAW_EDGE = (120, 92, 54)        # darker outline
WHITE_BODY = (247, 246, 243)    # bright white finish
WHITE_EDGE = (205, 202, 196)
WMARK = (150, 150, 150)         # neutral grey, low alpha -> faint

PX_PER_CM = 110
PAD_CM = 1.4                    # white margin around product inside canvas


def load_font(size, bold=False):
    try:
        return ImageFont.truetype(
            r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf", size)
    except Exception:
        return ImageFont.load_default()


def tile_watermark(canvas, W, H, text="LEBON GRACE", alpha=70):
    """Bake a faint, rotated, tiled text watermark across the whole canvas.

    Drawn into the same ImageDraw so it sits BEHIND the product (product is
    pasted/composited AFTER this call). Anti-cropping: tiles repeat so no
    single crop removes the brand.
    """
    fnt = load_font(22, bold=True)
    # Render one watermark tile to an offscreen layer, then tile+rotate.
    pad = 10
    td0 = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    tb = td0.textbbox((0, 0), text, font=fnt)
    tw, th = tb[2] - tb[0] + pad * 2, tb[3] - tb[1] + pad * 2
    tile = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile)
    td.text((pad, pad), text, fill=WMARK + (alpha,), font=fnt)
    tile = tile.rotate(-30, expand=True, resample=Image.BICUBIC)
    # Tile across canvas
    for y in range(0, H + tile.height, tile.height):
        for x in range(0, W + tile.width, tile.width):
            canvas.paste(tile, (x, y), tile)
    # Re-bind draw to the (now watermarked) canvas for subsequent product draw
    return ImageDraw.Draw(canvas)


def draw_ruler(draw, x0, y0, x1, y1, ticks, color):
    draw.line([x0, y0, x1, y1], fill=color, width=2)
    n = ticks
    for i in range(n + 1):
        t = i / n
        if x0 == x1:  # vertical
            cx = x0 + (8 if i % 5 == 0 else 4) * (1 if y1 > y0 else -1)
            draw.line([x0, y0 + (y1 - y0) * t, cx, y0 + (y1 - y0) * t], fill=color, width=2)
        else:          # horizontal
            cy = y0 + (8 if i % 5 == 0 else 4) * (1 if x1 > x0 else -1)
            draw.line([x0 + (x1 - x0) * t, y0, x0 + (x1 - x0) * t, cy], fill=color, width=2)


def square_elephant_path(W, H, fill, edge):
    """Return an RGBA image of the blocky 'square elephant' silhouette.

    Blocky side-profile, facing left, standing square: flat-top head,
    rectangular body, 4 blocky legs (with gaps), downward trunk attached to
    the head, triangular ear, small tail. Continuous outline (no detached
    pieces) for a clean laser cut.
    """
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u, v = W, H
    # Normalised continuous outline (x*w, y*h), clockwise from top of head.
    pts = [
        (0.30, 0.16),   # top of head (left)
        (0.62, 0.16),   # top of head (right / back)
        (0.80, 0.22),   # back slopes down to rump
        (0.86, 0.50),   # rump
        (0.90, 0.58),   # tail tip (small)
        (0.84, 0.60),   # back of rear leg
        (0.84, 0.80),   # rear leg outer bottom
        (0.78, 0.80),   # rear leg foot
        (0.78, 0.66),   # rear leg inner top
        (0.66, 0.66),   # belly gap (between rear legs)
        (0.66, 0.80),   # 2nd rear leg outer
        (0.60, 0.80),
        (0.60, 0.66),
        (0.48, 0.66),   # belly gap (front/rear)
        (0.48, 0.80),   # 2nd front leg
        (0.42, 0.80),
        (0.42, 0.66),
        (0.30, 0.66),   # belly gap (front legs)
        (0.30, 0.80),   # front leg outer
        (0.24, 0.80),
        (0.24, 0.66),   # front leg inner -> chest
        (0.22, 0.50),   # chest down to trunk base
        (0.18, 0.58),   # trunk out
        (0.13, 0.74),   # trunk tip (curls down)
        (0.19, 0.74),   # trunk inner up
        (0.22, 0.52),   # back up toward jaw
        (0.26, 0.34),   # up the face
        (0.30, 0.16),   # close at head top
    ]
    poly = [(int(x * u), int(y * v)) for x, y in pts]
    d.polygon(poly, fill=fill + (255,), outline=edge + (255,), width=3)
    # Ear (triangle behind head, attached)
    ear = [(int(0.40 * u), int(0.20 * v)), (int(0.52 * u), int(0.14 * v)),
           (int(0.50 * u), int(0.30 * v))]
    d.polygon(ear, fill=fill + (255,), outline=edge + (255,), width=2)
    # Eye
    ex, ey = int(0.34 * u), int(0.30 * v)
    d.ellipse([ex - 4, ey - 4, ex + 4, ey + 4], fill=edge + (255,))
    return img


def build_asset(finish, size_cm, with_ruler):
    body = RAW_BODY if finish == "raw" else WHITE_BODY
    edge = RAW_EDGE if finish == "raw" else WHITE_EDGE
    prod_cm = size_cm
    prod_px = int(prod_cm * PX_PER_CM)
    pad_px = int(PAD_CM * PX_PER_CM)
    canvas_px = prod_px + 2 * pad_px
    ruler_c = (90, 90, 90)

    # Canvas with faint watermark behind
    canvas = Image.new("RGBA", (canvas_px, canvas_px), (255, 255, 255, 0))
    d = tile_watermark(canvas, canvas_px, canvas_px)
    if with_ruler:
        m = pad_px
        s = prod_px
        # 1 cm = 10 ticks
        draw_ruler(d, m, m - 14, m + s, m - 14, 10, ruler_c)            # top
        draw_ruler(d, m, m + s + 14, m + s, m + s + 14, 10, ruler_c)    # bottom
        draw_ruler(d, m - 14, m, m - 14, m + s, 10, ruler_c)            # left
        draw_ruler(d, m + s + 14, m, m + s + 14, m + s, 10, ruler_c)    # right
        # size label
        fnt = load_font(18, bold=True)
        label = f"{size_cm} cm"
        tb = d.textbbox((0, 0), label, font=fnt)
        d.text(((canvas_px - (tb[2] - tb[0])) // 2, m + s + 22), label,
               fill=ruler_c, font=fnt)

    # Product (sits on top of watermark)
    prod = square_elephant_path(prod_px, prod_px, body, edge)
    canvas.alpha_composite(prod, (pad_px, pad_px))

    return canvas


def main():
    sizes = [4.8, 9.6]
    finishes = [("raw", "Raw MDF"), ("white", "White Finish")]
    slug = "mdf-square-elephant-cutout"
    for finish, _ in finishes:
        for size in sizes:
            # hero (no ruler)
            hero = build_asset(finish, size, with_ruler=False)
            hero_path = os.path.join(IMG_DIR, f"{slug}-{finish}.png")
            hero.save(hero_path, "PNG", optimize=True)
            # dim overlay (ruler)
            dim = build_asset(finish, size, with_ruler=True)
            dim_path = os.path.join(IMG_DIR, f"{slug}-{finish}-dim-{size}.png")
            dim.save(dim_path, "PNG", optimize=True)
            print(f"[GEN] {os.path.basename(hero_path)} | {os.path.basename(dim_path)}")
    print("[DONE] square elephant assets written to", IMG_DIR)


if __name__ == "__main__":
    main()
