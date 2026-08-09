/**
 * Generate high-quality SVG product illustrations for all 50 MDF products.
 * Each SVG clearly represents the actual product shape with MDF wood styling.
 */
const fs = require("fs");
const path = require("path");

const W = 600, H = 600;
const MDF = "#A67C00";
const MDF_DARK = "#7A5A00";
const MDF_LIGHT = "#D4BA85";
const MDF_EDGE = "#5C4300";
const BG = "#FAF8F5";
const BG_INNER = "#F0EDE6";

function wrap(inner, name) {
  // Encode for data URI
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${MDF_LIGHT}"/>
      <stop offset="50%" stop-color="${MDF}"/>
      <stop offset="100%" stop-color="${MDF_LIGHT}"/>
    </linearGradient>
    <filter id="shadow"><feDropShadow dx="2" dy="3" stdDeviation="4" flood-color="#00000020"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}" rx="12"/>
  <rect x="16" y="16" width="${W-32}" height="${H-32}" fill="${BG_INNER}" rx="8"/>
  ${inner}
  <text x="${W/2}" y="${H-30}" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="16" fill="#999" font-weight="500">${name}</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const products = {
  // ═══════ CUTOUTS (20) ═══════
  "mdf-heart-cutout": wrap(`
    <path d="M300 420 C160 320 80 240 120 160 C150 100 210 90 260 130 L300 170 L340 130 C390 90 450 100 480 160 C520 240 440 320 300 420Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <path d="M300 420 C160 320 80 240 120 160 C150 100 210 90 260 130 L300 170 L340 130 C390 90 450 100 480 160 C520 240 440 320 300 420Z" fill="none" stroke="${MDF_DARK}" stroke-width="1.5" opacity="0.3" stroke-dasharray="4,3"/>
  `, "Heart Cutout • 3mm MDF"),

  "mdf-star-cutout": wrap(`
    <polygon points="300,100 340,220 470,220 365,295 400,420 300,340 200,420 235,295 130,220 260,220" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
  `, "Star Cutout • 3mm MDF"),

  "mdf-butterfly-cutout": wrap(`
    <path d="M300 250 C220 150 100 130 120 250 C100 350 220 370 300 300Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3" filter="url(#shadow)"/>
    <path d="M300 250 C380 150 500 130 480 250 C500 350 380 370 300 300Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3" filter="url(#shadow)"/>
    <path d="M300 300 C240 370 130 400 160 460 C180 490 260 470 300 400Z" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <path d="M300 300 C360 370 470 400 440 460 C420 490 340 470 300 400Z" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <line x1="300" y1="230" x2="300" y2="480" stroke="${MDF_EDGE}" stroke-width="3"/>
    <circle cx="285" cy="220" r="4" fill="${MDF_EDGE}"/><circle cx="315" cy="220" r="4" fill="${MDF_EDGE}"/>
  `, "Butterfly Cutout • 3mm MDF"),

  "mdf-elephant-cutout": wrap(`
    <ellipse cx="280" cy="280" rx="150" ry="130" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <ellipse cx="160" cy="250" rx="50" ry="100" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <circle cx="220" cy="220" r="12" fill="${BG}"/>
    <rect x="200" y="380" width="35" height="80" rx="8" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <rect x="280" y="380" width="35" height="80" rx="8" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
  `, "Elephant Cutout • 3mm MDF"),

  "mdf-circle-cutout": wrap(`
    <circle cx="300" cy="290" r="170" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <circle cx="300" cy="290" r="170" fill="none" stroke="${MDF_DARK}" stroke-width="1" opacity="0.2"/>
  `, "Circle Cutout • 3mm MDF"),

  "mdf-cat-cutout": wrap(`
    <ellipse cx="300" cy="320" rx="130" ry="140" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <polygon points="200,220 170,80 240,180" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <polygon points="400,220 430,80 360,180" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <circle cx="260" cy="280" r="14" fill="${BG}"/><circle cx="340" cy="280" r="14" fill="${BG}"/>
    <circle cx="260" cy="280" r="7" fill="${MDF_EDGE}"/><circle cx="340" cy="280" r="7" fill="${MDF_EDGE}"/>
    <ellipse cx="300" cy="320" rx="10" ry="6" fill="${MDF_EDGE}"/>
    <line x1="220" y1="310" x2="140" y2="290" stroke="${MDF_EDGE}" stroke-width="2"/>
    <line x1="380" y1="310" x2="460" y2="290" stroke="${MDF_EDGE}" stroke-width="2"/>
    <line x1="220" y1="330" x2="140" y2="340" stroke="${MDF_EDGE}" stroke-width="2"/>
    <line x1="380" y1="330" x2="460" y2="340" stroke="${MDF_EDGE}" stroke-width="2"/>
  `, "Cat Cutout • 3mm MDF"),

  "mdf-diamond-cutout": wrap(`
    <polygon points="300,100 480,290 300,480 120,290" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
  `, "Diamond Cutout • 3mm MDF"),

  "mdf-bunny-cutout": wrap(`
    <ellipse cx="300" cy="350" rx="110" ry="120" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <ellipse cx="250" cy="160" rx="35" ry="120" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <ellipse cx="350" cy="160" rx="35" ry="120" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <ellipse cx="250" cy="160" rx="20" ry="90" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="1" opacity="0.5"/>
    <ellipse cx="350" cy="160" rx="20" ry="90" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="1" opacity="0.5"/>
    <circle cx="265" cy="310" r="10" fill="${BG}"/><circle cx="335" cy="310" r="10" fill="${BG}"/>
    <circle cx="265" cy="310" r="5" fill="${MDF_EDGE}"/><circle cx="335" cy="310" r="5" fill="${MDF_EDGE}"/>
    <ellipse cx="300" cy="345" rx="8" ry="5" fill="${MDF_EDGE}"/>
  `, "Bunny Cutout • 3mm MDF"),

  "mdf-hexagon-cutout": wrap(`
    <polygon points="300,110 460,200 460,380 300,470 140,380 140,200" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
  `, "Hexagon Cutout • 3mm MDF"),

  "mdf-dog-cutout": wrap(`
    <ellipse cx="300" cy="300" rx="140" ry="120" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <ellipse cx="180" cy="200" rx="60" ry="70" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <ellipse cx="420" cy="200" rx="60" ry="70" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <circle cx="250" cy="270" r="12" fill="${BG}"/><circle cx="350" cy="270" r="12" fill="${BG}"/>
    <circle cx="250" cy="270" r="6" fill="${MDF_EDGE}"/><circle cx="350" cy="270" r="6" fill="${MDF_EDGE}"/>
    <ellipse cx="300" cy="310" rx="15" ry="10" fill="${MDF_EDGE}"/>
  `, "Dog Cutout • 3mm MDF"),

  "mdf-oval-cutout": wrap(`
    <ellipse cx="300" cy="290" rx="190" ry="140" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
  `, "Oval Cutout • 3mm MDF"),

  "mdf-fish-cutout": wrap(`
    <ellipse cx="260" cy="290" rx="160" ry="90" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <polygon points="430,290 540,200 540,380" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <circle cx="180" cy="265" r="12" fill="${BG}"/>
    <path d="M260 240 Q320 200 380 240" fill="none" stroke="${MDF_EDGE}" stroke-width="2" opacity="0.3"/>
  `, "Fish Cutout • 3mm MDF"),

  "mdf-triangle-cutout": wrap(`
    <polygon points="300,100 500,480 100,480" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
  `, "Triangle Cutout • 3mm MDF"),

  "mdf-owl-cutout": wrap(`
    <ellipse cx="300" cy="320" rx="130" ry="150" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <circle cx="240" cy="260" r="40" fill="${BG}"/><circle cx="360" cy="260" r="40" fill="${BG}"/>
    <circle cx="240" cy="260" r="20" fill="${MDF_EDGE}"/><circle cx="360" cy="260" r="20" fill="${MDF_EDGE}"/>
    <polygon points="300,300 280,330 320,330" fill="${MDF_EDGE}"/>
    <polygon points="200,180 160,80 250,160" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="400,180 440,80 350,160" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <path d="M200 380 Q300 430 400 380" fill="none" stroke="${MDF_EDGE}" stroke-width="2" opacity="0.3"/>
  `, "Owl Cutout • 3mm MDF"),

  "mdf-cross-cutout": wrap(`
    <rect x="230" y="100" width="140" height="380" rx="8" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <rect x="110" y="220" width="380" height="140" rx="8" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4"/>
  `, "Cross Cutout • 3mm MDF"),

  "mdf-bird-cutout": wrap(`
    <path d="M150 280 Q220 150 340 220 Q420 160 500 250 Q420 300 340 270 Q260 320 150 280Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <circle cx="200" cy="250" r="8" fill="${BG}"/>
    <path d="M150 280 L100 290 L150 300" fill="${MDF_DARK}" stroke="${MDF_EDGE}" stroke-width="2"/>
  `, "Bird Cutout • 3mm MDF"),

  "mdf-crescent-moon-cutout": wrap(`
    <path d="M350 120 A180 180 0 1 0 350 480 A130 130 0 1 1 350 120Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
  `, "Crescent Moon Cutout • 3mm MDF"),

  "mdf-turtle-cutout": wrap(`
    <ellipse cx="300" cy="280" rx="160" ry="120" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <circle cx="130" cy="250" r="35" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <circle cx="470" cy="250" r="25" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <rect x="200" y="380" width="30" height="60" rx="10" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <rect x="270" y="380" width="30" height="60" rx="10" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <rect x="340" y="380" width="30" height="60" rx="10" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <rect x="400" y="380" width="30" height="60" rx="10" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <path d="M80 300 Q60 360 90 380" stroke="${MDF}" stroke-width="6" fill="none" stroke-linecap="round"/>
  `, "Turtle Cutout • 3mm MDF"),

  "mdf-square-cutout": wrap(`
    <rect x="130" y="110" width="340" height="340" rx="6" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
  `, "Square Cutout • 3mm MDF"),

  "mdf-lion-cutout": wrap(`
    <circle cx="300" cy="290" r="170" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <circle cx="300" cy="290" r="110" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <circle cx="260" cy="260" r="12" fill="${BG}"/><circle cx="340" cy="260" r="12" fill="${BG}"/>
    <circle cx="260" cy="260" r="6" fill="${MDF_EDGE}"/><circle cx="340" cy="260" r="6" fill="${MDF_EDGE}"/>
    <ellipse cx="300" cy="300" rx="12" ry="8" fill="${MDF_EDGE}"/>
    <path d="M270 320 Q300 350 330 320" fill="none" stroke="${MDF_EDGE}" stroke-width="2"/>
  `, "Lion Cutout • 3mm MDF"),

  // ═══════ DIY KITS (15) ═══════
  "mdf-heart-puzzle-5-piece": wrap(`
    <path d="M300 400 C180 320 110 260 140 190 C165 130 215 120 255 155 L300 190 L345 155 C385 120 435 130 460 190 C490 260 420 320 300 400Z" fill="none" stroke="${MDF}" stroke-width="4"/>
    <line x1="300" y1="190" x2="300" y2="400" stroke="${MDF_DARK}" stroke-width="2" stroke-dasharray="8,5"/>
    <line x1="140" y1="280" x2="460" y2="280" stroke="${MDF_DARK}" stroke-width="2" stroke-dasharray="8,5"/>
    <line x1="200" y1="170" x2="300" y2="340" stroke="${MDF_DARK}" stroke-width="2" stroke-dasharray="8,5"/>
    <line x1="400" y1="170" x2="300" y2="340" stroke="${MDF_DARK}" stroke-width="2" stroke-dasharray="8,5"/>
    <text x="230" y="250" font-family="system-ui" font-size="28" fill="${MDF}" font-weight="bold">1</text>
    <text x="340" y="250" font-family="system-ui" font-size="28" fill="${MDF}" font-weight="bold">2</text>
    <text x="180" y="350" font-family="system-ui" font-size="28" fill="${MDF}" font-weight="bold">3</text>
    <text x="300" y="350" font-family="system-ui" font-size="28" fill="${MDF}" font-weight="bold">4</text>
    <text x="400" y="350" font-family="system-ui" font-size="28" fill="${MDF}" font-weight="bold">5</text>
  `, "Heart Puzzle Kit • 5 Piece"),

  "mdf-animal-face-paint-kit": wrap(`
    <circle cx="200" cy="250" r="90" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <circle cx="175" cy="230" r="10" fill="${BG}"/><circle cx="225" cy="230" r="10" fill="${BG}"/>
    <ellipse cx="200" cy="265" rx="8" ry="5" fill="${MDF_EDGE}"/>
    <circle cx="400" cy="250" r="90" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <circle cx="375" cy="230" r="10" fill="${BG}"/><circle cx="425" cy="230" r="10" fill="${BG}"/>
    <ellipse cx="400" cy="265" rx="8" ry="5" fill="${MDF_EDGE}"/>
    <rect x="250" y="400" width="100" height="12" rx="6" fill="${MDF}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <rect x="260" y="420" width="80" height="8" rx="4" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="1"/>
    <text x="300" y="460" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">🎨 + 12 Paint Pots</text>
  `, "Paint Animal Faces • MDF Kit"),

  "mdf-star-matching-puzzle": wrap(`
    <polygon points="120,200 140,260 200,260 150,295 170,355 120,320 70,355 90,295 40,260 100,260" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="250,170 265,215 310,215 275,245 288,290 250,265 212,290 225,245 190,215 235,215" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="420,190 435,240 480,240 445,270 458,320 420,295 382,320 395,270 360,240 405,240" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="180,380 190,410 220,410 197,430 205,460 180,445 155,460 163,430 140,410 170,410" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="380,380 390,410 420,410 397,430 405,460 380,445 355,460 363,430 340,410 370,410" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <text x="300" y="150" text-anchor="middle" font-family="system-ui" font-size="16" fill="${MDF}">8 Sizes • Match & Learn</text>
  `, "Star Matching Puzzle • 8 Piece"),

  "mdf-flower-garden-puzzle": wrap(`
    <ellipse cx="200" cy="180" rx="50" ry="30" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2" transform="rotate(-30,200,180)"/>
    <ellipse cx="250" cy="160" rx="50" ry="30" fill="${MDF}" stroke="${MDF_EDGE}" stroke-width="2" transform="rotate(30,250,160)"/>
    <ellipse cx="220" cy="210" rx="50" ry="30" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2" transform="rotate(0,220,210)"/>
    <circle cx="225" cy="185" r="18" fill="${MDF}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <line x1="225" y1="230" x2="225" y2="380" stroke="${MDF}" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="200" cy="320" rx="30" ry="12" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="1.5" transform="rotate(-20,200,320)"/>
    <ellipse cx="400" cy="180" rx="40" ry="25" fill="${MDF}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <circle cx="400" cy="180" r="12" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="1.5"/>
    <line x1="400" y1="205" x2="400" y2="350" stroke="${MDF}" stroke-width="4" stroke-linecap="round"/>
    <path d="M150 400 Q200 370 250 400 Q300 370 350 400 Q400 370 450 400" fill="none" stroke="${MDF}" stroke-width="3" opacity="0.3"/>
    <text x="300" y="470" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">10 Pieces • Mix & Match</text>
  `, "Flower Garden Puzzle • 10 Piece"),

  "mdf-dinosaur-paint-set": wrap(`
    <path d="M120 400 L180 250 L230 190 L280 170 L330 190 L380 230 L440 320 L480 400Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <polygon points="230,190 250,120 270,170" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="280,170 300,110 320,160" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="330,190 350,130 370,180" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <circle cx="200" cy="260" r="8" fill="${BG}"/>
    <text x="300" y="460" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">🦕 6 Dinos + 18 Paints</text>
  `, "Paint Dinosaurs • MDF Kit"),

  "mdf-alphabet-puzzle-board": wrap(`
    <rect x="100" y="120" width="400" height="320" rx="12" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <text x="170" y="220" font-family="system-ui" font-size="48" font-weight="bold" fill="${MDF}">A</text>
    <text x="250" y="220" font-family="system-ui" font-size="48" font-weight="bold" fill="${MDF}">B</text>
    <text x="330" y="220" font-family="system-ui" font-size="48" font-weight="bold" fill="${MDF}">C</text>
    <text x="410" y="220" font-family="system-ui" font-size="48" font-weight="bold" fill="${MDF}">D</text>
    <text x="170" y="320" font-family="system-ui" font-size="48" font-weight="bold" fill="${MDF}">1</text>
    <text x="250" y="320" font-family="system-ui" font-size="48" font-weight="bold" fill="${MDF}">2</text>
    <text x="330" y="320" font-family="system-ui" font-size="48" font-weight="bold" fill="${MDF}">3</text>
    <text x="410" y="320" font-family="system-ui" font-size="48" font-weight="bold" fill="${MDF}">4</text>
    <text x="300" y="470" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">26 Letters + 10 Numbers</text>
  `, "Alphabet Puzzle Board • 26 Letters"),

  "mdf-unicorn-paint-your-own": wrap(`
    <path d="M260 420 Q240 320 260 240 Q280 180 300 140 L305 145 Q305 200 310 240 Q330 320 340 420Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <circle cx="290" cy="230" r="70" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <circle cx="270" cy="215" r="8" fill="${BG}"/>
    <path d="M240 200 Q210 170 220 120" stroke="${MDF_EDGE}" stroke-width="4" fill="none"/>
    <path d="M330 200 Q360 170 350 120" stroke="${MDF_EDGE}" stroke-width="4" fill="none"/>
    <path d="M240 380 Q280 420 320 380" stroke="${MDF_EDGE}" stroke-width="3" fill="none"/>
    <text x="300" y="480" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">🦄 Paint + Glitter + Gems</text>
  `, "Paint Unicorn • MDF Kit"),

  "mdf-geometric-pattern-puzzle": wrap(`
    <polygon points="150,180 200,130 250,180" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <rect x="300" y="130" width="80" height="80" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="450,130 500,180 450,230 400,180" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <circle cx="180" cy="320" r="50" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="350,280 400,280 400,340 350,340" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <rect x="130" y="410" width="120" height="50" rx="25" fill="${MDF}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="400,400 460,400 460,460 400,460" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2" transform="rotate(45,430,430)"/>
    <text x="300" y="510" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">12 Shapes • Create Patterns</text>
  `, "Geometric Pattern Puzzle • 12 Piece"),

  "mdf-ocean-animals-paint-kit": wrap(`
    <ellipse cx="180" cy="260" rx="90" ry="55" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <polygon points="275,260 340,210 340,310" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <circle cx="130" cy="245" r="8" fill="${BG}"/>
    <circle cx="400" cy="230" r="50" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <path d="M400 180 L400 140 M370 195 L350 170 M430 195 L450 170" stroke="${MDF}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="400" cy="230" r="12" fill="${BG}"/>
    <text x="300" y="460" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">🐙 8 Sea Creatures + 15 Paints</text>
  `, "Paint Ocean Animals • MDF Kit"),

  "mdf-space-explorer-puzzle": wrap(`
    <polygon points="300,100 260,350 340,350" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <rect x="240" y="350" width="120" height="40" fill="${MDF}" stroke="${MDF_EDGE}" stroke-width="3"/>
    <polygon points="240,390 210,440 260,390" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="360,390 390,440 340,390" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <circle cx="160" cy="200" r="40" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <circle cx="450" cy="180" r="25" fill="${MDF}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <circle cx="430" cy="320" r="55" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <text x="300" y="490" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">🚀 10 Pieces • Build Solar System</text>
  `, "Space Explorer Puzzle • 10 Piece"),

  "mdf-rainbow-color-sorting": wrap(`
    <path d="M120 420 A180 180 0 0 1 480 420" fill="none" stroke="${MDF_DARK}" stroke-width="28" stroke-linecap="round"/>
    <path d="M160 420 A140 140 0 0 1 440 420" fill="none" stroke="${MDF}" stroke-width="28" stroke-linecap="round"/>
    <path d="M200 420 A100 100 0 0 1 400 420" fill="none" stroke="${MDF_LIGHT}" stroke-width="28" stroke-linecap="round"/>
    <text x="300" y="480" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">🌈 7 Arches • Sort by Size</text>
  `, "Rainbow Color Sorting • 7 Piece"),

  "mdf-butterfly-garden-puzzle": wrap(`
    <path d="M300 200 C220 120 120 140 140 240 C120 320 220 340 300 270Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <path d="M300 200 C380 120 480 140 460 240 C480 320 380 340 300 270Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <line x1="300" y1="180" x2="300" y2="350" stroke="${MDF_EDGE}" stroke-width="2"/>
    <ellipse cx="420" cy="380" rx="50" ry="30" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <circle cx="420" cy="380" r="15" fill="${MDF}" stroke="${MDF_EDGE}" stroke-width="1.5"/>
    <text x="300" y="470" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">🦋 8 Pieces • Butterflies + Flowers</text>
  `, "Butterfly Garden Puzzle • 8 Piece"),

  "mdf-vehicle-paint-set": wrap(`
    <rect x="100" y="280" width="200" height="100" rx="12" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <circle cx="150" cy="390" r="25" fill="${MDF_DARK}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <circle cx="260" cy="390" r="25" fill="${MDF_DARK}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <path d="M350 250 L480 250 L500 340 L350 340Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <polygon points="420,160 480,250 360,250" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <text x="300" y="470" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">🚗 6 Vehicles + 15 Paints</text>
  `, "Paint Vehicles • MDF Kit"),

  "mdf-3d-butterfly-building-kit": wrap(`
    <path d="M300 220 C220 140 120 160 140 260 C120 340 220 350 300 280Z" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="3" opacity="0.7"/>
    <path d="M300 220 C380 140 480 160 460 260 C480 340 380 350 300 280Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <line x1="300" y1="200" x2="300" y2="370" stroke="${MDF_EDGE}" stroke-width="3"/>
    <circle cx="288" cy="195" r="5" fill="${MDF_EDGE}"/><circle cx="312" cy="195" r="5" fill="${MDF_EDGE}"/>
    <text x="300" y="430" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">✨ 20 Pieces • No Glue Needed</text>
  `, "3D Butterfly Building Kit"),

  "mdf-3d-dinosaur-building-kit": wrap(`
    <path d="M120 380 L200 250 L260 200 L320 180 L380 210 L440 280 L500 380Z" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="3" opacity="0.6"/>
    <path d="M140 370 L210 260 L270 210 L330 190 L390 220 L450 290 L490 370Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <line x1="200" y1="260" x2="450" y2="290" stroke="${MDF_DARK}" stroke-width="1.5" stroke-dasharray="5,4"/>
    <line x1="260" y1="210" x2="390" y2="340" stroke="${MDF_DARK}" stroke-width="1.5" stroke-dasharray="5,4"/>
    <circle cx="180" cy="270" r="8" fill="${BG}"/>
    <polygon points="260,200 275,140 290,190" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <text x="300" y="440" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">🦖 25 Pieces • T-Rex Skeleton</text>
  `, "3D Dinosaur Building Kit"),

  // ═══════ HOME DECOR (10) ═══════
  "mdf-forest-animal-wall-art": wrap(`
    <circle cx="150" cy="240" r="65" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <circle cx="150" cy="240" r="35" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="1.5"/>
    <circle cx="300" cy="220" r="55" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <circle cx="450" cy="250" r="60" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <path d="M100 340 L150 310 L200 340Z" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <path d="M260 320 L300 290 L340 320Z" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <path d="M400 330 L450 300 L500 330Z" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <line x1="80" y1="360" x2="520" y2="360" stroke="${MDF}" stroke-width="3"/>
    <text x="300" y="440" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">5 Forest Animals • Ready to Hang</text>
  `, "Forest Animal Wall Art • 5 Piece"),

  "mdf-mandala-coaster-set": wrap(`
    <circle cx="180" cy="240" r="100" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    ${[0,45,90,135,180,225,270,315].map(a => {
      const x = 180 + 60*Math.cos(a*Math.PI/180);
      const y = 240 + 60*Math.sin(a*Math.PI/180);
      return `<circle cx="${x}" cy="${y}" r="18" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="1.5"/>`;
    }).join("\n    ")}
    <circle cx="180" cy="240" r="30" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="1.5"/>
    <circle cx="420" cy="240" r="100" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    ${[0,60,120,180,240,300].map(a => {
      const x = 420 + 60*Math.cos(a*Math.PI/180);
      const y = 240 + 60*Math.sin(a*Math.PI/180);
      return `<circle cx="${x}" cy="${y}" r="18" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="1.5"/>`;
    }).join("\n    ")}
    <circle cx="420" cy="240" r="30" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="1.5"/>
    <text x="300" y="440" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">4 Coasters • Intricate Patterns</text>
  `, "Mandala Coaster Set • 4 Piece"),

  "mdf-botanical-wall-art": wrap(`
    <path d="M300 480 L300 180" stroke="${MDF}" stroke-width="5" fill="none"/>
    <path d="M300 200 Q220 150 180 180 Q240 210 300 200Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <path d="M300 180 Q380 130 420 160 Q360 190 300 180Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <path d="M300 260 Q200 200 160 240 Q230 280 300 260Z" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <path d="M300 240 Q400 180 440 220 Q370 260 300 240Z" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <path d="M300 320 Q230 270 190 310 Q250 350 300 320Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <path d="M300 300 Q370 250 410 290 Q350 330 300 300Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <ellipse cx="300" cy="150" rx="30" ry="18" fill="${MDF}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <text x="300" y="530" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">3 Botanical Leaves • Matte White</text>
  `, "Botanical Wall Art • 3 Leaf Set"),

  "mdf-geometric-ornament-set": wrap(`
    <polygon points="150,150 220,150 220,220 150,220" fill="none" stroke="${MDF}" stroke-width="3"/>
    <polygon points="185,150 220,185 185,220 150,185" fill="none" stroke="${MDF_LIGHT}" stroke-width="2" transform="rotate(45,185,185)"/>
    <circle cx="350" cy="185" r="35" fill="none" stroke="${MDF}" stroke-width="3"/>
    <circle cx="350" cy="185" r="20" fill="none" stroke="${MDF_LIGHT}" stroke-width="2"/>
    <polygon points="470,150 510,210 430,210" fill="none" stroke="${MDF}" stroke-width="3"/>
    <polygon points="150,350 190,310 230,350 190,390" fill="none" stroke="${MDF}" stroke-width="3"/>
    <polygon points="350,320 380,320 380,380 350,380" fill="none" stroke="${MDF_LIGHT}" stroke-width="2"/>
    <circle cx="350" cy="350" r="25" fill="none" stroke="${MDF}" stroke-width="2" stroke-dasharray="4,3"/>
    <polygon points="470,330 500,350 470,370 440,350" fill="none" stroke="${MDF}" stroke-width="3"/>
    <line x1="150" y1="270" x2="150" y2="250" stroke="${MDF}" stroke-width="1.5"/>
    <line x1="350" y1="270" x2="350" y2="250" stroke="${MDF}" stroke-width="1.5"/>
    <line x1="470" y1="270" x2="470" y2="250" stroke="${MDF}" stroke-width="1.5"/>
    <text x="300" y="440" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">6 Ornaments • Gold Cord Included</text>
  `, "Geometric Ornament Set • 6 Piece"),

  "mdf-arabic-calligraphy-art": wrap(`
    <rect x="80" y="140" width="440" height="280" rx="8" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <rect x="100" y="160" width="400" height="240" rx="4" fill="none" stroke="${MDF}" stroke-width="1.5"/>
    <text x="300" y="310" text-anchor="middle" font-family="serif" font-size="72" fill="${MDF_DARK}" font-weight="bold" direction="rtl">بسم الله</text>
    <text x="300" y="260" text-anchor="middle" font-family="serif" font-size="20" fill="${MDF}" opacity="0.6">In the name of Allah</text>
    <text x="300" y="470" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">Arabic Calligraphy • Gold/Black/White</text>
  `, "Arabic Calligraphy Wall Art • Bismillah"),

  "mdf-honeycomb-shelf-set": wrap(`
    ${[[200,200],[340,200],[270,320]].map(([cx,cy]) => {
      let pts=[];
      for(let i=0;i<6;i++){const a=Math.PI*2*i/6-Math.PI/6;const r=70;pts.push(`${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`);}
      return `<polygon points="${pts.join(" ")}" fill="none" stroke="${MDF}" stroke-width="5"/>`;
    }).join("\n    ")}
    <line x1="200" y1="270" x2="200" y2="270" stroke="${MDF_EDGE}" stroke-width="1"/>
    <text x="300" y="460" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">3 Hexagons • Wall Mount Hardware</text>
  `, "Honeycomb Shelf Set • 3 Piece"),

  "mdf-leaf-coaster-set": wrap(`
    <ellipse cx="140" cy="220" rx="70" ry="35" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2" transform="rotate(-20,140,220)"/>
    <line x1="80" y1="240" x2="200" y2="200" stroke="${MDF_EDGE}" stroke-width="1.5" transform="rotate(-20,140,220)"/>
    <ellipse cx="300" cy="200" rx="70" ry="35" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2" transform="rotate(15,300,200)"/>
    <line x1="240" y1="210" x2="360" y2="190" stroke="${MDF_EDGE}" stroke-width="1.5"/>
    <ellipse cx="460" cy="230" rx="70" ry="35" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2" transform="rotate(-35,460,230)"/>
    <ellipse cx="180" cy="370" rx="65" ry="32" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2" transform="rotate(25,180,370)"/>
    <ellipse cx="380" cy="380" rx="65" ry="32" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2" transform="rotate(-10,380,380)"/>
    <ellipse cx="280" cy="450" rx="55" ry="28" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2" transform="rotate(5,280,450)"/>
    <text x="300" y="520" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">6 Botanical Shapes • Waterproof</text>
  `, "Leaf Coaster Set • 6 Piece"),

  "mdf-moon-phase-wall-hanging": wrap(`
    <line x1="80" y1="160" x2="520" y2="160" stroke="${MDF}" stroke-width="4"/>
    ${[0,1,2,3,4,5,6].map(i => {
      const cx = 120 + i * 60;
      const r = 22;
      let moonSvg = `<circle cx="${cx}" cy="220" r="${r}" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>`;
      // Add shadow for crescent effect
      if (i === 0) moonSvg += `<circle cx="${cx}" cy="220" r="${r}" fill="${BG_INNER}" opacity="0.9"/>`;
      if (i === 1) moonSvg += `<circle cx="${cx+8}" cy="220" r="${r}" fill="${BG_INNER}" opacity="0.7"/>`;
      if (i === 2) moonSvg += `<circle cx="${cx+12}" cy="220" r="${r}" fill="${BG_INNER}" opacity="0.5"/>`;
      if (i === 4) moonSvg += `<circle cx="${cx-12}" cy="220" r="${r}" fill="${BG_INNER}" opacity="0.5"/>`;
      if (i === 5) moonSvg += `<circle cx="${cx-8}" cy="220" r="${r}" fill="${BG_INNER}" opacity="0.7"/>`;
      if (i === 6) moonSvg += `<circle cx="${cx}" cy="220" r="${r}" fill="${BG_INNER}" opacity="0.9"/>`;
      moonSvg += `<line x1="${cx}" y1="${160+5}" x2="${cx}" y2="${220-r-2}" stroke="${MDF}" stroke-width="1.5"/>`;
      return moonSvg;
    }).join("\n    ")}
    <text x="300" y="300" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">7 Moon Phases • Jute Twine + Dowel</text>
  `, "Moon Phase Wall Hanging • 7 Piece"),

  "mdf-personalized-name-ornament": wrap(`
    <rect x="120" y="180" width="360" height="160" rx="16" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <text x="300" y="290" text-anchor="middle" font-family="cursive,Georgia,serif" font-size="64" fill="${BG}" font-weight="bold">Name</text>
    <circle cx="300" cy="145" r="10" fill="${MDF_DARK}"/>
    <line x1="300" y1="155" x2="300" y2="180" stroke="${MDF_DARK}" stroke-width="2"/>
    <text x="300" y="400" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">Up to 12 Characters • Custom Font</text>
  `, "Personalized Name Ornament • Custom Cut"),

  "mdf-spice-jar-labels": wrap(`
    ${[0,1,2].map(col => [0,1].map(row => {
      const x = 150 + col * 130;
      const y = 200 + row * 120;
      const names = ["Basil","Cumin","Paprika","Thyme","Saffron","Oregano"];
      const idx = col + row * 3;
      return `<ellipse cx="${x}" cy="${y}" rx="55" ry="35" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
      <text x="${x}" y="${y+6}" text-anchor="middle" font-family="serif" font-size="16" fill="${MDF_DARK}">${names[idx]}</text>`;
    }).join("\n    ")).join("\n    ")}
    <text x="300" y="430" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">30 Labels • Self-Adhesive + Blanks</text>
  `, "Spice Jar Label Set • 30 Piece"),

  // ═══════ KIDS TOYS (5) ═══════
  "mdf-counting-abc-board": wrap(`
    <rect x="80" y="120" width="440" height="320" rx="12" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="4" filter="url(#shadow)"/>
    <text x="160" y="230" font-family="system-ui" font-size="52" font-weight="bold" fill="${MDF}">A</text>
    <text x="240" y="230" font-family="system-ui" font-size="52" font-weight="bold" fill="${MDF}">B</text>
    <text x="320" y="230" font-family="system-ui" font-size="52" font-weight="bold" fill="${MDF}">C</text>
    <text x="400" y="230" font-family="system-ui" font-size="52" font-weight="bold" fill="${MDF}">D</text>
    <text x="160" y="350" font-family="system-ui" font-size="52" font-weight="bold" fill="${MDF}">1</text>
    <text x="240" y="350" font-family="system-ui" font-size="52" font-weight="bold" fill="${MDF}">2</text>
    <text x="320" y="350" font-family="system-ui" font-size="52" font-weight="bold" fill="${MDF}">3</text>
    <text x="400" y="350" font-family="system-ui" font-size="52" font-weight="bold" fill="${MDF}">4</text>
    <text x="300" y="490" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">36 Pieces • Double-Sided Board</text>
  `, "Counting & ABC Board • 36 Piece"),

  "mdf-3d-city-building-set": wrap(`
    <rect x="120" y="250" width="100" height="180" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <rect x="240" y="180" width="100" height="250" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <polygon points="290,130 240,180 340,180" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <rect x="360" y="280" width="100" height="150" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <circle cx="155" cy="290" r="8" fill="${BG}"/><circle cx="185" cy="290" r="8" fill="${BG}"/>
    <circle cx="275" cy="220" r="8" fill="${BG}"/><circle cx="305" cy="220" r="8" fill="${BG}"/>
    <circle cx="395" cy="310" r="8" fill="${BG}"/><circle cx="425" cy="310" r="8" fill="${BG}"/>
    <line x1="100" y1="430" x2="500" y2="430" stroke="${MDF}" stroke-width="3"/>
    <text x="300" y="480" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">40+ Pieces • Build Your City</text>
  `, "3D City Building Set • 40+ Piece"),

  "mdf-shape-sorter-puzzle": wrap(`
    <circle cx="150" cy="220" r="45" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <rect x="250" y="175" width="80" height="80" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="3"/>
    <polygon points="430,175 480,255 380,255" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <rect x="130" y="340" width="70" height="70" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="3"/>
    <path d="M310 340 C290 340 275 360 275 375 C275 395 295 410 310 410 C325 410 345 395 345 375 C345 360 330 340 310 340Z" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="3"/>
    <polygon points="430,340 460,370 430,400 400,370" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="3"/>
    <text x="300" y="470" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">8 Shapes • Toddler Safe</text>
  `, "Shape Sorter Puzzle • 8 Shapes"),

  "mdf-marble-run-contraption": wrap(`
    <rect x="130" y="120" width="20" height="340" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <rect x="450" y="120" width="20" height="340" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <line x1="140" y1="180" x2="460" y2="240" stroke="${MDF}" stroke-width="6" stroke-linecap="round"/>
    <line x1="460" y1="280" x2="140" y2="340" stroke="${MDF}" stroke-width="6" stroke-linecap="round"/>
    <line x1="140" y1="380" x2="460" y2="420" stroke="${MDF}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="220" cy="205" r="10" fill="${MDF_DARK}"/>
    <circle cx="380" cy="315" r="10" fill="${MDF_DARK}"/>
    <circle cx="300" cy="400" r="10" fill="${MDF_DARK}"/>
    <text x="300" y="510" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">30 Tracks + 5 Marbles • STEM</text>
  `, "Marble Run Contraption • STEM Set"),

  "mdf-tangram-puzzle-set": wrap(`
    <polygon points="150,150 300,150 225,225" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="300,150 450,150 375,225" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="150,150 150,300 225,225" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="150,300 225,225 225,300 150,375" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="225,225 300,150 375,225 300,300" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="300,300 375,225 450,300" fill="${MDF_LIGHT}" stroke="${MDF_EDGE}" stroke-width="2"/>
    <polygon points="150,375 225,300 300,300 300,450 150,450" fill="url(#wood)" stroke="${MDF_EDGE}" stroke-width="2"/>
    <text x="300" y="510" text-anchor="middle" font-family="system-ui" font-size="14" fill="${MDF}">7 Pieces + 20 Pattern Cards</text>
  `, "Tangram Puzzle Set • Classic Brain Teaser"),
};

// Replace in products.ts
const filePath = path.join(__dirname, "..", "src", "lib", "products.ts");
let content = fs.readFileSync(filePath, "utf-8");
const lines = content.split("\n");
let replaced = 0;

for (let i = 0; i < lines.length; i++) {
  for (const [slug, svgDataUri] of Object.entries(products)) {
    if (lines[i].includes(`slug: "${slug}"`)) {
      lines[i] = lines[i].replace(/imageUrl: "[^"]*"/, `imageUrl: "${svgDataUri}"`);
      replaced++;
      break;
    }
  }
}

fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
console.log(`✅ Replaced ${replaced} product images with high-quality SVGs`);
