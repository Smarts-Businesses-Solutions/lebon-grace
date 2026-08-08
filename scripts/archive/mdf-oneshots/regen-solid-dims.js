/**
 * Regenerate IVEI-style dimension images for the 8 solid-filled shapes.
 * Run after the main product images are updated.
 */
const { execSync } = require("child_process");

const products = [
  { slug: "mdf-heart-cutout", w_mm: 80, h_mm: 80 },
  { slug: "mdf-circle-cutout", w_mm: 100, h_mm: 100 },
  { slug: "mdf-diamond-cutout", w_mm: 70, h_mm: 100 },
  { slug: "mdf-hexagon-cutout", w_mm: 80, h_mm: 80 },
  { slug: "mdf-oval-cutout", w_mm: 120, h_mm: 80 },
  { slug: "mdf-triangle-cutout", w_mm: 80, h_mm: 80 },
  { slug: "mdf-cross-cutout", w_mm: 100, h_mm: 100 },
  { slug: "mdf-square-cutout", w_mm: 100, h_mm: 100 },
];

// This will be run via Python PIL script
const fs = require("fs");
const path = require("path");
const imgDir = path.join(__dirname, "..", "public", "images", "mdf");

let success = 0;
let fail = 0;

for (const p of products) {
  const srcPath = path.join(imgDir, `${p.slug}.png`);
  if (!fs.existsSync(srcPath)) {
    console.log(`  ⏭ ${p.slug} — source not found yet`);
    fail++;
    continue;
  }
  
  try {
    // Call Python to generate IVEI-style dimension image
    const cmd = `python -c "
from PIL import Image, ImageDraw, ImageFont
import os, math

slug = '${p.slug}'
w_mm, h_mm = ${p.w_mm}, ${p.h_mm}
w_in, h_in = round(w_mm / 25.4, 1), round(h_mm / 25.4, 1)

src = os.path.join('${imgDir.replace(/\\/g, "\\\\")}', f'{slug}.png')
dst = os.path.join('${imgDir.replace(/\\/g, "\\\\")}', f'{slug}-dim.png')

product_img = Image.open(src).convert('RGBA')

CW, CH = 800, 900
BG_WHITE = (255, 255, 255)
FRAME_GOLD = (232, 180, 60)
ARROW_TEAL = (0, 150, 136)
TEXT_DARK = (50, 50, 50)
TEXT_GRAY = (120, 120, 120)
THICKNESS_BG = (0, 150, 136)

canvas = Image.new('RGB', (CW, CH), BG_WHITE)
draw = ImageDraw.Draw(canvas)
draw.rectangle([8, 8, CW-9, CH-9], outline=FRAME_GOLD, width=4)
draw.rectangle([12, 12, CW-13, CH-13], outline=FRAME_GOLD, width=1)

try:
    font_bold = ImageFont.truetype('arialbd.ttf', 22)
    font_med = ImageFont.truetype('arial.ttf', 18)
    font_sm = ImageFont.truetype('arial.ttf', 14)
    font_title = ImageFont.truetype('arialbd.ttf', 20)
except:
    try:
        font_bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
        font_med = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
        font_sm = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
        font_title = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
    except:
        font_bold = font_med = font_sm = font_title = ImageFont.load_default()

name = slug.replace('mdf-', '').replace('-', ' ').title().replace('Cutout', 'Cutout')
bbox = draw.textbbox((0, 0), name, font=font_title)
draw.text(((CW - (bbox[2]-bbox[0])) // 2, 25), name, fill=TEXT_DARK, font=font_title)

max_img_w, max_img_h = 450, 350
pw, ph = product_img.size
scale = min(max_img_w / pw, max_img_h / ph)
new_pw, new_ph = int(pw * scale), int(ph * scale)
product_resized = product_img.resize((new_pw, new_ph), Image.LANCZOS)
img_x = (CW - new_pw) // 2
img_y = 60 + (max_img_h - new_ph) // 2
canvas.paste(product_resized, (img_x, img_y), product_resized if product_resized.mode == 'RGBA' else None)

def draw_arrow(draw, start, end, color, width=2):
    draw.line([start, end], fill=color, width=width)
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = math.sqrt(dx*dx + dy*dy)
    if length == 0: return
    udx, udy = dx/length, dy/length
    s = 8
    for px, py, sign in [(start[0], start[1], 1), (end[0], end[1], -1)]:
        draw.polygon([(px, py), (px + sign*s*udx + s*udy*0.5, py + sign*s*udy - s*udx*0.5), (px + sign*s*udx - s*udy*0.5, py + sign*s*udy + s*udx*0.5)], fill=color)

arrow_y = img_y + new_ph + 25
draw_arrow(draw, (img_x + 10, arrow_y), (img_x + new_pw - 10, arrow_y), ARROW_TEAL, 2)
w_label = f'{w_in} inch / {int(w_mm)} mm'
bbox = draw.textbbox((0, 0), w_label, font=font_med)
draw.text(((CW - (bbox[2]-bbox[0])) // 2, arrow_y + 5), w_label, fill=ARROW_TEAL, font=font_med)

arrow_x = img_x + new_pw + 25
draw_arrow(draw, (arrow_x, img_y + 10), (arrow_x, img_y + new_ph - 10), ARROW_TEAL, 2)
h_label = f'{h_in} inch / {int(h_mm)} mm'
draw.text((arrow_x + 8, (img_y + 10 + img_y + new_ph - 10) // 2 - 8), h_label, fill=ARROW_TEAL, font=font_sm)

thick_y = arrow_y + 40
thick_text = 'Thickness : 3mm'
bbox = draw.textbbox((0, 0), thick_text, font=font_bold)
tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
pill_x = (CW - tw - 30) // 2
draw.rounded_rectangle([pill_x, thick_y, pill_x + tw + 30, thick_y + th + 16], radius=8, fill=THICKNESS_BG)
draw.text((pill_x + 15, thick_y + 6), thick_text, fill=(255,255,255), font=font_bold)

icon_y = thick_y + 55
features = [('\\U0001f381', 'Best gift for\\ncraft lovers'), ('\\u270f\\ufe0f', 'Blank surface\\nfor DIY'), ('\\u2728', 'High quality\\nMDF'), ('\\U0001f3a8', 'Easy to\\npaint')]
icon_spacing = CW // 4
for i, (emoji, text) in enumerate(features):
    cx = icon_spacing * i + icon_spacing // 2
    cr = 28
    draw.ellipse([cx-cr, icon_y, cx+cr, icon_y+cr*2], outline=ARROW_TEAL, width=2)
    bbox = draw.textbbox((0, 0), emoji, font=font_med)
    draw.text((cx - (bbox[2]-bbox[0])//2, icon_y + cr - 10), emoji, fill=TEXT_DARK, font=font_med)
    for j, line in enumerate(text.split('\\\\n')):
        bbox = draw.textbbox((0, 0), line, font=font_sm)
        draw.text((cx - (bbox[2]-bbox[0])//2, icon_y + cr*2 + 8 + j*16), line, fill=TEXT_GRAY, font=font_sm)

canvas.convert('RGB').save(dst, 'PNG', optimize=True)
print('OK')
"`;
    execSync(cmd, { stdio: "pipe" });
    console.log(`  ✅ ${p.slug}`);
    success++;
  } catch (e) {
    console.log(`  ❌ ${p.slug}: ${e.message}`);
    fail++;
  }
}

console.log(`\nDone: ${success} created, ${fail} failed`);
