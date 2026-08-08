/**
 * Generate SVG data URI images for all 50 MDF products.
 * Each SVG draws the actual product shape in MDF wood tones.
 */
const fs = require("fs");
const path = require("path");

const W = 400, H = 400;
const MDF_DARK = "#8B6914";
const MDF_MID = "#A67C00";
const MDF_LIGHT = "#C9A96E";
const BG = "#F5F0E8";
const BG2 = "#EDE5D8";

function svgWrap(inner, label) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${BG}"/><rect x="20" y="20" width="${W-40}" height="${H-40}" rx="16" fill="${BG2}"/>${inner}<text x="${W/2}" y="${H-40}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" fill="#999" font-weight="500">${label}</text></svg>`)}`;
}

// Shape SVG paths
const shapes = {
  // ─── Cutouts ───
  "mdf-heart-cutout": (s) => `<path d="M${s/2} ${s*0.75} C${s*0.2} ${s*0.5} ${s*0.05} ${s*0.3} ${s*0.2} ${s*0.18} C${s*0.3} ${s*0.08} ${s*0.42} ${s*0.15} ${s/2} ${s*0.3} C${s*0.58} ${s*0.15} ${s*0.7} ${s*0.08} ${s*0.8} ${s*0.18} C${s*0.95} ${s*0.3} ${s*0.8} ${s*0.5} ${s/2} ${s*0.75}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/>`,

  "mdf-star-cutout": (s) => {
    const cx=s/2, cy=s*0.42, r1=s*0.32, r2=s*0.14;
    let pts = [];
    for (let i=0; i<10; i++) {
      const a = (Math.PI*2*i/10) - Math.PI/2;
      const r = i%2===0 ? r1 : r2;
      pts.push(`${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`);
    }
    return `<polygon points="${pts.join(" ")}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/>`;
  },

  "mdf-butterfly-cutout": (s) => `<path d="M${s/2} ${s*0.2} C${s*0.35} ${s*0.1} ${s*0.1} ${s*0.15} ${s*0.12} ${s*0.35} C${s*0.14} ${s*0.5} ${s*0.3} ${s*0.55} ${s/2} ${s*0.45} C${s*0.7} ${s*0.55} ${s*0.86} ${s*0.5} ${s*0.88} ${s*0.35} C${s*0.9} ${s*0.15} ${s*0.65} ${s*0.1} ${s/2} ${s*0.2}Z M${s/2} ${s*0.45} C${s*0.4} ${s*0.55} ${s*0.15} ${s*0.6} ${s*0.18} ${s*0.75} C${s*0.2} ${s*0.85} ${s*0.35} ${s*0.82} ${s/2} ${s*0.65} C${s*0.65} ${s*0.82} ${s*0.8} ${s*0.85} ${s*0.82} ${s*0.75} C${s*0.85} ${s*0.6} ${s*0.6} ${s*0.55} ${s/2} ${s*0.45}Z M${s/2} ${s*0.2} L${s/2} ${s*0.85}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/>`,

  "mdf-elephant-cutout": (s) => `<ellipse cx="${s*0.45}" cy="${s*0.45}" rx="${s*0.28}" ry="${s*0.25}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><circle cx="${s*0.3}" cy="${s*0.35}" r="${s*0.04}" fill="${BG}"/><ellipse cx="${s*0.2}" cy="${s*0.55}" rx="${s*0.08}" ry="${s*0.18}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><rect x="${s*0.35}" y="${s*0.65}" width="${s*0.06}" height="${s*0.15}" rx="3" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><rect x="${s*0.48}" y="${s*0.65}" width="${s*0.06}" height="${s*0.15}" rx="3" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`,

  "mdf-circle-cutout": (s) => `<circle cx="${s/2}" cy="${s*0.42}" r="${s*0.3}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/>`,

  "mdf-cat-cutout": (s) => `<ellipse cx="${s/2}" cy="${s*0.5}" rx="${s*0.25}" ry="${s*0.28}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><polygon points="${s*0.3},${s*0.28} ${s*0.25},${s*0.08} ${s*0.38},${s*0.22}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><polygon points="${s*0.7},${s*0.28} ${s*0.75},${s*0.08} ${s*0.62},${s*0.22}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><circle cx="${s*0.42}" cy="${s*0.42}" r="${s*0.03}" fill="${BG}"/><circle cx="${s*0.58}" cy="${s*0.42}" r="${s*0.03}" fill="${BG}"/><ellipse cx="${s/2}" cy="${s*0.52}" rx="${s*0.03}" ry="${s*0.02}" fill="${MDF_DARK}"/><line x1="${s*0.35}" y1="${s*0.48}" x2="${s*0.2}" y2="${s*0.45}" stroke="${MDF_DARK}" stroke-width="2"/><line x1="${s*0.65}" y1="${s*0.48}" x2="${s*0.8}" y2="${s*0.45}" stroke="${MDF_DARK}" stroke-width="2"/>`,

  "mdf-diamond-cutout": (s) => `<polygon points="${s/2},${s*0.1} ${s*0.8},${s*0.42} ${s/2},${s*0.75} ${s*0.2},${s*0.42}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/>`,

  "mdf-bunny-cutout": (s) => `<ellipse cx="${s/2}" cy="${s*0.55}" rx="${s*0.2}" ry="${s*0.22}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><ellipse cx="${s*0.4}" cy="${s*0.2}" rx="${s*0.06}" ry="${s*0.2}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><ellipse cx="${s*0.6}" cy="${s*0.2}" rx="${s*0.06}" ry="${s*0.2}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><circle cx="${s*0.44}" cy="${s*0.48}" r="${s*0.025}" fill="${BG}"/><circle cx="${s*0.56}" cy="${s*0.48}" r="${s*0.025}" fill="${BG}"/>`,

  "mdf-hexagon-cutout": (s) => {
    const cx=s/2, cy=s*0.42, r=s*0.3;
    let pts = [];
    for (let i=0; i<6; i++) {
      const a = Math.PI*2*i/6 - Math.PI/6;
      pts.push(`${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`);
    }
    return `<polygon points="${pts.join(" ")}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/>`;
  },

  "mdf-dog-cutout": (s) => `<ellipse cx="${s/2}" cy="${s*0.48}" rx="${s*0.25}" ry="${s*0.22}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><ellipse cx="${s*0.3}" cy="${s*0.3}" rx="${s*0.1}" ry="${s*0.12}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><ellipse cx="${s*0.7}" cy="${s*0.3}" rx="${s*0.1}" ry="${s*0.12}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><circle cx="${s*0.42}" cy="${s*0.42}" r="${s*0.025}" fill="${BG}"/><circle cx="${s*0.58}" cy="${s*0.42}" r="${s*0.025}" fill="${BG}"/><ellipse cx="${s/2}" cy="${s*0.52}" rx="${s*0.04}" ry="${s*0.025}" fill="${MDF_DARK}"/>`,

  "mdf-oval-cutout": (s) => `<ellipse cx="${s/2}" cy="${s*0.42}" rx="${s*0.32}" ry="${s*0.24}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/>`,

  "mdf-fish-cutout": (s) => `<ellipse cx="${s*0.42}" cy="${s*0.42}" rx="${s*0.25}" ry="${s*0.15}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><polygon points="${s*0.68},${s*0.42} ${s*0.85},${s*0.28} ${s*0.85},${s*0.55}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><circle cx="${s*0.32}" cy="${s*0.38}" r="${s*0.025}" fill="${BG}"/>`,

  "mdf-triangle-cutout": (s) => `<polygon points="${s/2},${s*0.12} ${s*0.82},${s*0.72} ${s*0.18},${s*0.72}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/>`,

  "mdf-owl-cutout": (s) => `<ellipse cx="${s/2}" cy="${s*0.48}" rx="${s*0.25}" ry="${s*0.3}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><circle cx="${s*0.38}" cy="${s*0.38}" r="${s*0.08}" fill="${BG}"/><circle cx="${s*0.62}" cy="${s*0.38}" r="${s*0.08}" fill="${BG}"/><circle cx="${s*0.38}" cy="${s*0.38}" r="${s*0.04}" fill="${MDF_DARK}"/><circle cx="${s*0.62}" cy="${s*0.38}" r="${s*0.04}" fill="${MDF_DARK}"/><polygon points="${s/2},${s*0.48} ${s*0.46},${s*0.54} ${s*0.54},${s*0.54}" fill="${MDF_DARK}"/><polygon points="${s*0.32},${s*0.15} ${s*0.25},${s*0.02} ${s*0.4},${s*0.12}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.68},${s*0.15} ${s*0.75},${s*0.02} ${s*0.6},${s*0.12}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`,

  "mdf-cross-cutout": (s) => `<rect x="${s*0.35}" y="${s*0.12}" width="${s*0.3}" height="${s*0.6}" rx="4" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><rect x="${s*0.15}" y="${s*0.3}" width="${s*0.7}" height="${s*0.24}" rx="4" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/>`,

  "mdf-bird-cutout": (s) => `<path d="M${s*0.2} ${s*0.4} Q${s*0.35} ${s*0.15} ${s*0.55} ${s*0.3} Q${s*0.7} ${s*0.2} ${s*0.85} ${s*0.35} Q${s*0.7} ${s*0.45} ${s*0.55} ${s*0.4} Q${s*0.4} ${s*0.5} ${s*0.2} ${s*0.4}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><circle cx="${s*0.3}" cy="${s*0.35}" r="${s*0.02}" fill="${BG}"/>`,

  "mdf-crescent-moon-cutout": (s) => `<path d="M${s*0.55} ${s*0.12} A${s*0.3} ${s*0.3} 0 1 0 ${s*0.55} ${s*0.72} A${s*0.22} ${s*0.22} 0 1 1 ${s*0.55} ${s*0.12}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/>`,

  "mdf-turtle-cutout": (s) => `<ellipse cx="${s/2}" cy="${s*0.42}" rx="${s*0.28}" ry="${s*0.2}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><circle cx="${s*0.22}" cy="${s*0.35}" r="${s*0.06}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.78}" cy="${s*0.35}" r="${s*0.05}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><rect x="${s*0.3}" y="${s*0.58}" width="${s*0.06}" height="${s*0.12}" rx="3" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><rect x="${s*0.42}" y="${s*0.58}" width="${s*0.06}" height="${s*0.12}" rx="3" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><rect x="${s*0.55}" y="${s*0.58}" width="${s*0.06}" height="${s*0.12}" rx="3" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><rect x="${s*0.65}" y="${s*0.58}" width="${s*0.06}" height="${s*0.12}" rx="3" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><path d="M${s*0.15} ${s*0.45} Q${s*0.08} ${s*0.55} ${s*0.12} ${s*0.6}" stroke="${MDF_MID}" stroke-width="4" fill="none"/>`,

  "mdf-square-cutout": (s) => `<rect x="${s*0.18}" y="${s*0.12}" width="${s*0.64}" height="${s*0.6}" rx="4" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/>`,

  "mdf-lion-cutout": (s) => `<circle cx="${s/2}" cy="${s*0.45}" r="${s*0.3}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><circle cx="${s/2}" cy="${s*0.45}" r="${s*0.2}" fill="${MDF_LIGHT}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.42}" cy="${s*0.4}" r="${s*0.025}" fill="${BG}"/><circle cx="${s*0.58}" cy="${s*0.4}" r="${s*0.025}" fill="${BG}"/><ellipse cx="${s/2}" cy="${s*0.48}" rx="${s*0.03}" ry="${s*0.02}" fill="${MDF_DARK}"/>`,

  // ─── DIY Kits ───
  "mdf-heart-puzzle-5-piece": (s) => {
    // 5 interlocking pieces forming a heart
    return `<path d="M${s/2} ${s*0.7} C${s*0.22} ${s*0.48} ${s*0.08} ${s*0.3} ${s*0.22} ${s*0.18} C${s*0.32} ${s*0.08} ${s*0.42} ${s*0.15} ${s/2} ${s*0.28} C${s*0.58} ${s*0.15} ${s*0.68} ${s*0.08} ${s*0.78} ${s*0.18} C${s*0.92} ${s*0.3} ${s*0.78} ${s*0.48} ${s/2} ${s*0.7}Z" fill="none" stroke="${MDF_MID}" stroke-width="3" stroke-dasharray="8,4"/><line x1="${s/2}" y1="${s*0.28}" x2="${s/2}" y2="${s*0.7}" stroke="${MDF_DARK}" stroke-width="2" stroke-dasharray="6,4"/><line x1="${s*0.22}" y1="${s*0.42}" x2="${s*0.78}" y2="${s*0.42}" stroke="${MDF_DARK}" stroke-width="2" stroke-dasharray="6,4"/><line x1="${s*0.35}" y1="${s*0.2}" x2="${s*0.5}" y2="${s*0.55}" stroke="${MDF_DARK}" stroke-width="2" stroke-dasharray="6,4"/><line x1="${s*0.65}" y1="${s*0.2}" x2="${s*0.5}" y2="${s*0.55}" stroke="${MDF_DARK}" stroke-width="2" stroke-dasharray="6,4"/>`;
  },

  "mdf-animal-face-paint-kit": (s) => {
    // Paint palette + brush + animal face
    return `<circle cx="${s*0.35}" cy="${s*0.5}" r="${s*0.22}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><circle cx="${s*0.28}" cy="${s*0.42}" r="${s*0.03}" fill="${BG}"/><circle cx="${s*0.42}" cy="${s*0.42}" r="${s*0.03}" fill="${BG}"/><ellipse cx="${s*0.35}" cy="${s*0.52}" rx="${s*0.03}" ry="${s*0.02}" fill="${MDF_DARK}"/><rect x="${s*0.62}" y="${s*0.15}" width="${s*0.06}" height="${s*0.55}" rx="3" fill="${MDF_LIGHT}" stroke="${MDF_DARK}" stroke-width="2" transform="rotate(-15,${s*0.65},${s*0.42})"/><circle cx="${s*0.6}" cy="${s*0.14}" r="${s*0.05}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2" transform="rotate(-15,${s*0.6},${s*0.14})"/>`;
  },

  "mdf-star-matching-puzzle": (s) => {
    // Multiple stars of different sizes
    const stars = [[s*0.3,s*0.3,s*0.18],[s*0.6,s*0.25,s*0.12],[s*0.5,s*0.55,s*0.15],[s*0.25,s*0.6,s*0.1],[s*0.72,s*0.55,s*0.1]];
    return stars.map(([cx,cy,r]) => {
      let pts=[];
      for(let i=0;i<10;i++){const a=Math.PI*2*i/10-Math.PI/2;const rr=i%2===0?r:r*0.45;pts.push(`${cx+rr*Math.cos(a)},${cy+rr*Math.sin(a)}`);}
      return `<polygon points="${pts.join(" ")}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`;
    }).join("");
  },

  "mdf-flower-garden-puzzle": (s) => {
    // Flower with petals
    let petals = "";
    for (let i=0; i<6; i++) {
      const a = Math.PI*2*i/6;
      const px = s*0.4 + s*0.18*Math.cos(a);
      const py = s*0.38 + s*0.18*Math.sin(a);
      petals += `<ellipse cx="${px}" cy="${py}" rx="${s*0.09}" ry="${s*0.06}" fill="${MDF_LIGHT}" stroke="${MDF_DARK}" stroke-width="2" transform="rotate(${i*60},${px},${py})"/>`;
    }
    return petals + `<circle cx="${s*0.4}" cy="${s*0.38}" r="${s*0.07}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><line x1="${s*0.4}" y1="${s*0.5}" x2="${s*0.4}" y2="${s*0.75}" stroke="${MDF_MID}" stroke-width="4"/><ellipse cx="${s*0.35}" cy="${s*0.65}" rx="${s*0.06}" ry="${s*0.03}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="1.5" transform="rotate(-30,${s*0.35},${s*0.65})"/>`;
  },

  "mdf-dinosaur-paint-set": (s) => `<path d="M${s*0.15} ${s*0.6} L${s*0.25} ${s*0.35} L${s*0.35} ${s*0.25} L${s*0.45} ${s*0.2} L${s*0.55} ${s*0.25} L${s*0.65} ${s*0.3} L${s*0.75} ${s*0.4} L${s*0.8} ${s*0.55} L${s*0.7} ${s*0.6} L${s*0.6} ${s*0.55} L${s*0.5} ${s*0.6} L${s*0.4} ${s*0.6} L${s*0.3} ${s*0.65}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><circle cx="${s*0.3}" cy="${s*0.35}" r="${s*0.02}" fill="${BG}"/><polygon points="${s*0.35},${s*0.25} ${s*0.38},${s*0.12} ${s*0.42},${s*0.22}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.45},${s*0.2} ${s*0.48},${s*0.1} ${s*0.52},${s*0.18}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.55},${s*0.25} ${s*0.58},${s*0.14} ${s*0.62},${s*0.23}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`,

  "mdf-alphabet-puzzle-board": (s) => `<rect x="${s*0.15}" y="${s*0.15}" width="${s*0.7}" height="${s*0.55}" rx="8" fill="${MDF_LIGHT}" stroke="${MDF_DARK}" stroke-width="3"/><text x="${s*0.25}" y="${s*0.38}" font-family="system-ui" font-size="${s*0.14}" font-weight="bold" fill="${MDF_MID}">A</text><text x="${s*0.45}" y="${s*0.38}" font-family="system-ui" font-size="${s*0.14}" font-weight="bold" fill="${MDF_MID}">B</text><text x="${s*0.65}" y="${s*0.38}" font-family="system-ui" font-size="${s*0.14}" font-weight="bold" fill="${MDF_MID}">C</text><text x="${s*0.25}" y="${s*0.58}" font-family="system-ui" font-size="${s*0.14}" font-weight="bold" fill="${MDF_MID}">1</text><text x="${s*0.45}" y="${s*0.58}" font-family="system-ui" font-size="${s*0.14}" font-weight="bold" fill="${MDF_MID}">2</text><text x="${s*0.65}" y="${s*0.58}" font-family="system-ui" font-size="${s*0.14}" font-weight="bold" fill="${MDF_MID}">3</text>`,

  "mdf-unicorn-paint-your-own": (s) => `<path d="M${s*0.4} ${s*0.65} Q${s*0.35} ${s*0.45} ${s*0.42} ${s*0.3} Q${s*0.5} ${s*0.15} ${s*0.5} ${s*0.1} L${s*0.52} ${s*0.12} Q${s*0.52} ${s*0.2} ${s*0.55} ${s*0.3} Q${s*0.62} ${s*0.45} ${s*0.6} ${s*0.65}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><circle cx="${s*0.48}" cy="${s*0.35}" r="${s*0.12}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><circle cx="${s*0.46}" cy="${s*0.33}" r="${s*0.02}" fill="${BG}"/><path d="M${s*0.38} ${s*0.28} Q${s*0.3} ${s*0.2} ${s*0.32} ${s*0.12}" stroke="${MDF_DARK}" stroke-width="3" fill="none"/><path d="M${s*0.55} ${s*0.28} Q${s*0.62} ${s*0.2} ${s*0.6} ${s*0.12}" stroke="${MDF_DARK}" stroke-width="3" fill="none"/><path d="M${s*0.42} ${s*0.65} Q${s*0.45} ${s*0.72} ${s*0.5} ${s*0.75} Q${s*0.55} ${s*0.72} ${s*0.58} ${s*0.65}" stroke="${MDF_DARK}" stroke-width="2" fill="none"/>`,

  "mdf-geometric-pattern-puzzle": (s) => {
    // Mix of geometric shapes
    return `<polygon points="${s*0.25},${s*0.2} ${s*0.35},${s*0.12} ${s*0.35},${s*0.28}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><rect x="${s*0.5}" y="${s*0.12}" width="${s*0.18}" height="${s*0.18}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.75},${s*0.12} ${s*0.85},${s*0.2} ${s*0.8},${s*0.3} ${s*0.7},${s*0.3}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.3}" cy="${s*0.45}" r="${s*0.1}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.55},${s*0.4} ${s*0.65},${s*0.35} ${s*0.75},${s*0.45} ${s*0.65},${s*0.55}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><rect x="${s*0.2}" y="${s*0.6}" width="${s*0.2}" height="${s*0.12}" rx="6" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.55},${s*0.6} ${s*0.7},${s*0.55} ${s*0.8},${s*0.65} ${s*0.7},${s*0.75} ${s*0.55},${s*0.7}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`;
  },

  "mdf-ocean-animals-paint-kit": (s) => `<ellipse cx="${s*0.3}" cy="${s*0.4}" rx="${s*0.15}" ry="${s*0.1}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.45},${s*0.4} ${s*0.55},${s*0.32} ${s*0.55},${s*0.48}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.25}" cy="${s*0.38}" r="${s*0.02}" fill="${BG}"/><path d="M${s*0.6} ${s*0.3} Q${s*0.65} ${s*0.15} ${s*0.7} ${s*0.25} Q${s*0.75} ${s*0.15} ${s*0.8} ${s*0.3} Q${s*0.75} ${s*0.4} ${s*0.7} ${s*0.35} Q${s*0.65} ${s*0.4} ${s*0.6} ${s*0.3}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.35}" cy="${s*0.65}" r="${s*0.08}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><path d="M${s*0.35} ${s*0.57} L${s*0.35} ${s*0.48} M${s*0.28} ${s*0.52} L${s*0.22} ${s*0.45} M${s*0.42} ${s*0.52} L${s*0.48} ${s*0.45}" stroke="${MDF_MID}" stroke-width="2.5" fill="none"/>`,

  "mdf-space-explorer-puzzle": (s) => `<polygon points="${s*0.5},${s*0.1} ${s*0.42},${s*0.55} ${s*0.58},${s*0.55}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><rect x="${s*0.38}" y="${s*0.55}" width="${s*0.24}" height="${s*0.08}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.38},${s*0.63} ${s*0.32},${s*0.72} ${s*0.42},${s*0.63}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.62},${s*0.63} ${s*0.68},${s*0.72} ${s*0.58},${s*0.63}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.2}" cy="${s*0.25}" r="${s*0.08}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.8}" cy="${s*0.2}" r="${s*0.05}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.75}" cy="${s*0.45}" r="${s*0.1}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`,

  "mdf-rainbow-color-sorting": (s) => {
    let arcs = "";
    const colors = [MDF_DARK, MDF_MID, MDF_LIGHT];
    for (let i=0; i<3; i++) {
      const r = s*0.3 - i*s*0.08;
      arcs += `<path d="M${s*0.2} ${s*0.55} A${r} ${r} 0 0 1 ${s*0.6} ${s*0.55}" fill="none" stroke="${colors[i]}" stroke-width="${s*0.06}"/>`;
    }
    return arcs;
  },

  "mdf-butterfly-garden-puzzle": (s) => `<path d="M${s*0.35} ${s*0.3} C${s*0.2} ${s*0.15} ${s*0.08} ${s*0.25} ${s*0.15} ${s*0.4} C${s*0.2} ${s*0.5} ${s*0.3} ${s*0.52} ${s*0.35} ${s*0.42}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><path d="M${s*0.35} ${s*0.3} C${s*0.5} ${s*0.15} ${s*0.62} ${s*0.25} ${s*0.55} ${s*0.4} C${s*0.5} ${s*0.5} ${s*0.4} ${s*0.52} ${s*0.35} ${s*0.42}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><path d="M${s*0.35} ${s*0.42} C${s*0.25} ${s*0.52} ${s*0.12} ${s*0.55} ${s*0.18} ${s*0.65} C${s*0.22} ${s*0.72} ${s*0.32} ${s*0.68} ${s*0.35} ${s*0.55}Z" fill="${MDF_LIGHT}" stroke="${MDF_DARK}" stroke-width="2"/><path d="M${s*0.35} ${s*0.42} C${s*0.45} ${s*0.52} ${s*0.58} ${s*0.55} ${s*0.52} ${s*0.65} C${s*0.48} ${s*0.72} ${s*0.38} ${s*0.68} ${s*0.35} ${s*0.55}Z" fill="${MDF_LIGHT}" stroke="${MDF_DARK}" stroke-width="2"/><line x1="${s*0.35}" y1="${s*0.28}" x2="${s*0.35}" y2="${s*0.7}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.65}" cy="${s*0.6}" r="${s*0.06}" fill="${MDF_LIGHT}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.72}" cy="${s*0.52}" r="${s*0.04}" fill="${MDF_LIGHT}" stroke="${MDF_DARK}" stroke-width="1.5"/><circle cx="${s*0.68}" cy="${s*0.68}" r="${s*0.04}" fill="${MDF_LIGHT}" stroke="${MDF_DARK}" stroke-width="1.5"/>`,

  "mdf-vehicle-paint-set": (s) => `<rect x="${s*0.15}" y="${s*0.4}" width="${s*0.35}" height="${s*0.18}" rx="4" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.25}" cy="${s*0.6}" r="${s*0.05}" fill="${MDF_DARK}"/><circle cx="${s*0.42}" cy="${s*0.6}" r="${s*0.05}" fill="${MDF_DARK}"/><path d="M${s*0.55} ${s*0.35} L${s*0.7} ${s*0.35} L${s*0.8} ${s*0.48} L${s*0.55} ${s*0.48}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.72},${s*0.2} ${s*0.82},${s*0.35} ${s*0.62},${s*0.35}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><rect x="${s*0.15}" y="${s*0.18}" width="${s*0.25}" height="${s*0.12}" rx="6" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.23}" cy="${s*0.3}" r="${s*0.03}" fill="${MDF_DARK}"/><circle cx="${s*0.32}" cy="${s*0.3}" r="${s*0.03}" fill="${MDF_DARK}"/>`,

  "mdf-3d-butterfly-building-kit": (s) => `<path d="M${s*0.5} ${s*0.35} C${s*0.35} ${s*0.15} ${s*0.1} ${s*0.2} ${s*0.15} ${s*0.4} C${s*0.18} ${s*0.55} ${s*0.35} ${s*0.55} ${s*0.5} ${s*0.42}Z" fill="${MDF_LIGHT}" stroke="${MDF_MID}" stroke-width="3"/><path d="M${s*0.5} ${s*0.35} C${s*0.65} ${s*0.15} ${s*0.9} ${s*0.2} ${s*0.85} ${s*0.4} C${s*0.82} ${s*0.55} ${s*0.65} ${s*0.55} ${s*0.5} ${s*0.42}Z" fill="${MDF_LIGHT}" stroke="${MDF_MID}" stroke-width="3"/><path d="M${s*0.5} ${s*0.42} C${s*0.38} ${s*0.55} ${s*0.15} ${s*0.58} ${s*0.2} ${s*0.7} C${s*0.25} ${s*0.78} ${s*0.4} ${s*0.72} ${s*0.5} ${s*0.58}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><path d="M${s*0.5} ${s*0.42} C${s*0.62} ${s*0.55} ${s*0.85} ${s*0.58} ${s*0.8} ${s*0.7} C${s*0.75} ${s*0.78} ${s*0.6} ${s*0.72} ${s*0.5} ${s*0.58}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><line x1="${s*0.5}" y1="${s*0.32}" x2="${s*0.5}" y2="${s*0.78}" stroke="${MDF_DARK}" stroke-width="2.5"/><circle cx="${s*0.48}" cy="${s*0.3}" r="${s*0.02}" fill="${MDF_DARK}"/><circle cx="${s*0.52}" cy="${s*0.3}" r="${s*0.02}" fill="${MDF_DARK}"/>`,

  "mdf-3d-dinosaur-building-kit": (s) => `<path d="M${s*0.2} ${s*0.6} L${s*0.3} ${s*0.35} L${s*0.4} ${s*0.25} L${s*0.5} ${s*0.22} L${s*0.6} ${s*0.28} L${s*0.7} ${s*0.35} L${s*0.8} ${s*0.5} L${s*0.75} ${s*0.6}Z" fill="${MDF_LIGHT}" stroke="${MDF_MID}" stroke-width="3"/><line x1="${s*0.3}" y1="${s*0.35}" x2="${s*0.7}" y2="${s*0.35}" stroke="${MDF_MID}" stroke-width="1.5" stroke-dasharray="4,3"/><line x1="${s*0.4}" y1="${s*0.25}" x2="${s*0.6}" y2="${s*0.45}" stroke="${MDF_MID}" stroke-width="1.5" stroke-dasharray="4,3"/><line x1="${s*0.5}" y1="${s*0.22}" x2="${s*0.5}" y2="${s*0.55}" stroke="${MDF_MID}" stroke-width="1.5" stroke-dasharray="4,3"/><circle cx="${s*0.3}" cy="${s*0.35}" r="${s*0.025}" fill="${BG}"/><polygon points="${s*0.4},${s*0.25} ${s*0.42},${s*0.15} ${s*0.45},${s*0.23}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.5},${s*0.22} ${s*0.52},${s*0.12} ${s*0.55},${s*0.2}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`,

  // ─── Home Decor ───
  "mdf-forest-animal-wall-art": (s) => `<circle cx="${s*0.25}" cy="${s*0.4}" r="${s*0.12}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.5}" cy="${s*0.35}" r="${s*0.1}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.72}" cy="${s*0.42}" r="${s*0.11}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><path d="M${s*0.15} ${s*0.55} L${s*0.25} ${s*0.45} L${s*0.35} ${s*0.55}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><path d="M${s*0.4} ${s*0.52} L${s*0.5} ${s*0.42} L${s*0.6} ${s*0.52}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><path d="M${s*0.62} ${s*0.55} L${s*0.72} ${s*0.45} L${s*0.82} ${s*0.55}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><line x1="${s*0.15}" y1="${s*0.6}" x2="${s*0.85}" y2="${s*0.6}" stroke="${MDF_DARK}" stroke-width="2"/>`,

  "mdf-mandala-coaster-set": (s) => {
    let circles = "";
    for (let i=4; i>=1; i--) {
      circles += `<circle cx="${s/2}" cy="${s*0.42}" r="${s*0.06*i}" fill="none" stroke="${i%2===0?MDF_MID:MDF_LIGHT}" stroke-width="2"/>`;
    }
    // Petals
    let petals = "";
    for (let i=0; i<8; i++) {
      const a = Math.PI*2*i/8;
      const px = s/2 + s*0.2*Math.cos(a);
      const py = s*0.42 + s*0.2*Math.sin(a);
      petals += `<circle cx="${px}" cy="${py}" r="${s*0.04}" fill="${MDF_LIGHT}" stroke="${MDF_MID}" stroke-width="1.5"/>`;
    }
    return `<circle cx="${s/2}" cy="${s*0.42}" r="${s*0.3}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/>` + circles + petals;
  },

  "mdf-botanical-wall-art": (s) => `<path d="M${s*0.5} ${s*0.75} L${s*0.5} ${s*0.25}" stroke="${MDF_MID}" stroke-width="3" fill="none"/><path d="M${s*0.5} ${s*0.4} Q${s*0.3} ${s*0.3} ${s*0.2} ${s*0.35} Q${s*0.35} ${s*0.45} ${s*0.5} ${s*0.4}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><path d="M${s*0.5} ${s*0.35} Q${s*0.7} ${s*0.25} ${s*0.8} ${s*0.3} Q${s*0.65} ${s*0.4} ${s*0.5} ${s*0.35}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><path d="M${s*0.5} ${s*0.5} Q${s*0.3} ${s*0.42} ${s*0.15} ${s*0.48} Q${s*0.32} ${s*0.55} ${s*0.5} ${s*0.5}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><path d="M${s*0.5} ${s*0.45} Q${s*0.68} ${s*0.38} ${s*0.82} ${s*0.42} Q${s*0.65} ${s*0.52} ${s*0.5} ${s*0.45}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><path d="M${s*0.5} ${s*0.3} L${s*0.5} ${s*0.15}" stroke="${MDF_MID}" stroke-width="2" fill="none"/><ellipse cx="${s*0.5}" cy="${s*0.12}" rx="${s*0.06}" ry="${s*0.04}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`,

  "mdf-geometric-ornament-set": (s) => `<polygon points="${s/2},${s*0.12} ${s*0.8},${s*0.35} ${s/2},${s*0.58} ${s*0.2},${s*0.35}" fill="none" stroke="${MDF_MID}" stroke-width="3"/><circle cx="${s/2}" cy="${s*0.35}" r="${s*0.18}" fill="none" stroke="${MDF_LIGHT}" stroke-width="2"/><rect x="${s*0.25}" y="${s*0.5}" width="${s*0.2}" height="${s*0.2}" fill="none" stroke="${MDF_MID}" stroke-width="2" transform="rotate(45,${s*0.35},${s*0.6})"/><polygon points="${s*0.65},${s*0.5} ${s*0.8},${s*0.6} ${s*0.72},${s*0.75} ${s*0.58},${s*0.65}" fill="none" stroke="${MDF_MID}" stroke-width="2"/>`,

  "mdf-arabic-calligraphy-art": (s) => `<rect x="${s*0.1}" y="${s*0.15}" width="${s*0.8}" height="${s*0.55}" rx="4" fill="${MDF_LIGHT}" stroke="${MDF_DARK}" stroke-width="3"/><text x="${s/2}" y="${s*0.48}" text-anchor="middle" font-family="serif" font-size="${s*0.22}" fill="${MDF_DARK}" font-weight="bold" direction="rtl">بسم الله</text><rect x="${s*0.15}" y="${s*0.2}" width="${s*0.7}" height="${s*0.45}" rx="2" fill="none" stroke="${MDF_MID}" stroke-width="1.5"/>`,

  "mdf-honeycomb-shelf-set": (s) => {
    const hexes = [[s*0.3,s*0.3],[s*0.55,s*0.3],[s*0.42,s*0.55]];
    return hexes.map(([cx,cy]) => {
      let pts=[];
      for(let i=0;i<6;i++){const a=Math.PI*2*i/6-Math.PI/6;const r=s*0.14;pts.push(`${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`);}
      return `<polygon points="${pts.join(" ")}" fill="none" stroke="${MDF_MID}" stroke-width="4"/>`;
    }).join("");
  },

  "mdf-leaf-coaster-set": (s) => {
    const leaves = [[s*0.25,s*0.3,-20],[s*0.5,s*0.35,10],[s*0.72,s*0.3,-30],[s*0.38,s*0.6,15],[s*0.62,s*0.6,-10]];
    return leaves.map(([cx,cy,rot]) => `<ellipse cx="${cx}" cy="${cy}" rx="${s*0.1}" ry="${s*0.05}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2" transform="rotate(${rot},${cx},${cy})"/><line x1="${cx-s*0.08*Math.cos(rot*Math.PI/180)}" y1="${cy-s*0.08*Math.sin(rot*Math.PI/180)}" x2="${cx+s*0.08*Math.cos(rot*Math.PI/180)}" y2="${cy+s*0.08*Math.sin(rot*Math.PI/180)}" stroke="${MDF_DARK}" stroke-width="1" transform="rotate(${rot},${cx},${cy})"/>`).join("");
  },

  "mdf-moon-phase-wall-hanging": (s) => {
    let moons = "";
    const phases = [1, 0.8, 0.5, 0.2, 0.5, 0.8, 1];
    for (let i=0; i<7; i++) {
      const cx = s*0.1 + i*(s*0.8/6);
      const r = s*0.05;
      moons += `<circle cx="${cx}" cy="${s*0.35}" r="${r}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="1.5"/>`;
      if (phases[i] < 1) {
        moons += `<circle cx="${cx}" cy="${s*0.35}" r="${r}" fill="${BG}" clip-path="inset(0 ${phases[i]*100}% 0 0)"/>`;
      }
      moons += `<line x1="${cx}" y1="${s*0.35+r+2}" x2="${cx}" y2="${s*0.55}" stroke="${MDF_DARK}" stroke-width="1"/>`;
    }
    moons += `<line x1="${s*0.05}" y1="${s*0.28}" x2="${s*0.95}" y2="${s*0.28}" stroke="${MDF_DARK}" stroke-width="2"/>`;
    return moons;
  },

  "mdf-personalized-name-ornament": (s) => `<rect x="${s*0.15}" y="${s*0.25}" width="${s*0.7}" height="${s*0.4}" rx="8" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="3"/><text x="${s/2}" y="${s*0.52}" text-anchor="middle" font-family="cursive,serif" font-size="${s*0.15}" fill="${BG}" font-weight="bold">Name</text><circle cx="${s/2}" cy="${s*0.18}" r="${s*0.03}" fill="${MDF_DARK}"/><line x1="${s/2}" y1="${s*0.15}" x2="${s/2}" y2="${s*0.25}" stroke="${MDF_DARK}" stroke-width="1.5"/>`,

  "mdf-spice-jar-labels": (s) => {
    let labels = "";
    const names = ["Basil","Cumin","Paprika","Thyme","Saffron","Oregano"];
    for (let i=0; i<6; i++) {
      const row = Math.floor(i/3);
      const col = i%3;
      const x = s*0.15 + col*s*0.28;
      const y = s*0.2 + row*s*0.3;
      labels += `<ellipse cx="${x+s*0.08}" cy="${y}" rx="${s*0.1}" ry="${s*0.08}" fill="${MDF_LIGHT}" stroke="${MDF_MID}" stroke-width="2"/><text x="${x+s*0.08}" y="${y+s*0.03}" text-anchor="middle" font-family="serif" font-size="${s*0.035}" fill="${MDF_DARK}">${names[i]}</text>`;
    }
    return labels;
  },

  // ─── Kids Toys ───
  "mdf-counting-abc-board": (s) => `<rect x="${s*0.1}" y="${s*0.15}" width="${s*0.8}" height="${s*0.55}" rx="8" fill="${MDF_LIGHT}" stroke="${MDF_DARK}" stroke-width="3"/><text x="${s*0.2}" y="${s*0.35}" font-family="system-ui" font-size="${s*0.1}" font-weight="bold" fill="${MDF_MID}">A B C</text><text x="${s*0.2}" y="${s*0.55}" font-family="system-ui" font-size="${s*0.1}" font-weight="bold" fill="${MDF_MID}">1 2 3</text>`,

  "mdf-3d-city-building-set": (s) => `<rect x="${s*0.15}" y="${s*0.35}" width="${s*0.2}" height="${s*0.3}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><rect x="${s*0.4}" y="${s*0.25}" width="${s*0.2}" height="${s*0.4}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.5},${s*0.15} ${s*0.4},${s*0.25} ${s*0.6},${s*0.25}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><rect x="${s*0.65}" y="${s*0.4}" width="${s*0.18}" height="${s*0.25}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><circle cx="${s*0.22}" cy="${s*0.42}" r="${s*0.02}" fill="${BG}"/><circle cx="${s*0.28}" cy="${s*0.42}" r="${s*0.02}" fill="${BG}"/><circle cx="${s*0.47}" cy="${s*0.32}" r="${s*0.02}" fill="${BG}"/><circle cx="${s*0.53}" cy="${s*0.32}" r="${s*0.02}" fill="${BG}"/><line x1="${s*0.1}" y1="${s*0.65}" x2="${s*0.9}" y2="${s*0.65}" stroke="${MDF_DARK}" stroke-width="2"/>`,

  "mdf-shape-sorter-puzzle": (s) => {
    const shapes = [
      [s*0.25,s*0.35,()=>`<circle cx="${s*0.25}" cy="${s*0.35}" r="${s*0.08}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`],
      [s*0.5,s*0.35,()=>`<rect x="${s*0.42}" y="${s*0.27}" width="${s*0.16}" height="${s*0.16}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`],
      [s*0.75,s*0.35,()=>`<polygon points="${s*0.75},${s*0.27} ${s*0.83},${s*0.43} ${s*0.67},${s*0.43}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`],
      [s*0.25,s*0.6,()=>`<polygon points="${s*0.25},${s*0.52} ${s*0.33},${s*0.52} ${s*0.33},${s*0.68} ${s*0.25},${s*0.68}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`],
      [s*0.5,s*0.6,()=>`<path d="M${s*0.5} ${s*0.52} C${s*0.44} ${s*0.52} ${s*0.42} ${s*0.58} ${s*0.42} ${s*0.6} C${s*0.42} ${s*0.66} ${s*0.5} ${s*0.7} ${s*0.5} ${s*0.7} C${s*0.5} ${s*0.7} ${s*0.58} ${s*0.66} ${s*0.58} ${s*0.6} C${s*0.58} ${s*0.58} ${s*0.56} ${s*0.52} ${s*0.5} ${s*0.52}Z" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`],
      [s*0.75,s*0.6,()=>`<polygon points="${s*0.75},${s*0.52} ${s*0.82},${s*0.6} ${s*0.75},${s*0.68} ${s*0.68},${s*0.6}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`],
    ];
    return shapes.map(([, , fn]) => fn()).join("");
  },

  "mdf-marble-run-contraption": (s) => {
    let tracks = "";
    // Vertical supports
    tracks += `<rect x="${s*0.2}" y="${s*0.15}" width="${s*0.04}" height="${s*0.55}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`;
    tracks += `<rect x="${s*0.76}" y="${s*0.15}" width="${s*0.04}" height="${s*0.55}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`;
    // Angled tracks
    tracks += `<line x1="${s*0.22}" y1="${s*0.25}" x2="${s*0.78}" y2="${s*0.35}" stroke="${MDF_MID}" stroke-width="4"/>`;
    tracks += `<line x1="${s*0.78}" y1="${s*0.4}" x2="${s*0.22}" y2="${s*0.5}" stroke="${MDF_MID}" stroke-width="4"/>`;
    tracks += `<line x1="${s*0.22}" y1="${s*0.55}" x2="${s*0.78}" y2="${s*0.62}" stroke="${MDF_MID}" stroke-width="4"/>`;
    // Marbles
    tracks += `<circle cx="${s*0.35}" cy="${s*0.29}" r="${s*0.03}" fill="${MDF_DARK}"/>`;
    tracks += `<circle cx="${s*0.6}" cy="${s*0.46}" r="${s*0.03}" fill="${MDF_DARK}"/>`;
    return tracks;
  },

  "mdf-tangram-puzzle-set": (s) => {
    // 7 tangram pieces forming a square
    return `<polygon points="${s*0.2},${s*0.2} ${s*0.5},${s*0.2} ${s*0.35},${s*0.35}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.5},${s*0.2} ${s*0.8},${s*0.2} ${s*0.65},${s*0.35}" fill="${MDF_LIGHT}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.2},${s*0.2} ${s*0.2},${s*0.5} ${s*0.35},${s*0.35}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.2},${s*0.5} ${s*0.35},${s*0.35} ${s*0.35},${s*0.5} ${s*0.2},${s*0.65}" fill="${MDF_LIGHT}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.35},${s*0.35} ${s*0.5},${s*0.2} ${s*0.65},${s*0.35} ${s*0.5},${s*0.5}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.5},${s*0.5} ${s*0.65},${s*0.35} ${s*0.8},${s*0.5}" fill="${MDF_LIGHT}" stroke="${MDF_DARK}" stroke-width="2"/><polygon points="${s*0.2},${s*0.65} ${s*0.35},${s*0.5} ${s*0.5},${s*0.5} ${s*0.5},${s*0.8} ${s*0.2},${s*0.8}" fill="${MDF_MID}" stroke="${MDF_DARK}" stroke-width="2"/>`;
  },
};

// Generate SVG data URIs
const svgResults = {};
for (const [slug, shapeFn] of Object.entries(shapes)) {
  const label = slug.replace(/^mdf-/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  svgResults[slug] = svgWrap(shapeFn(W), label);
}

// Now replace in products.ts
const filePath = path.join(__dirname, "..", "src", "lib", "products.ts");
let content = fs.readFileSync(filePath, "utf-8");
const lines = content.split("\n");

let replaced = 0;
for (let i = 0; i < lines.length; i++) {
  for (const [slug, svgDataUri] of Object.entries(svgResults)) {
    if (lines[i].includes(`slug: "${slug}"`)) {
      // Replace the imageUrl value
      lines[i] = lines[i].replace(
        /imageUrl: "[^"]*"/,
        `imageUrl: "${svgDataUri}"`
      );
      replaced++;
      break;
    }
  }
}

fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
console.log(`✅ Replaced ${replaced} product images with SVG shapes`);

// Verify a few
const verify = fs.readFileSync(filePath, "utf-8");
for (const slug of ["mdf-heart-cutout", "mdf-star-cutout", "mdf-cat-cutout"]) {
  const m = verify.match(new RegExp(`slug: "${slug}"[^}]*imageUrl: "([^"]{50})`));
  console.log(`  ${slug}: ${m ? m[1] + "..." : "NOT FOUND"}`);
}
