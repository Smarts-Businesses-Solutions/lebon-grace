const fs = require("fs");

function mdToHtml(md) {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^---$/gm, "<hr/>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");
}

function buildHTML(md, title, subtitle) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Lebon Grace</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--gold:#C9A96E;--dark:#2D2D2D;--green:#16A34A;--border:#E5E7EB}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Inter",system-ui,sans-serif;line-height:1.8;color:#374151;background:#FAF8F5}
.container{max-width:960px;margin:0 auto;padding:0 24px}
.hero{background:linear-gradient(135deg,#1a1a1a,#2D2D2D,#1a1a1a);color:white;padding:80px 24px;text-align:center;border-bottom:4px solid var(--gold)}
.hero h1{font-size:2.8em;font-weight:800;margin-bottom:12px}
.hero .subtitle{color:#C9A96E;font-size:1.1em;font-weight:500}
.hero .date{color:#9CA3AF;font-size:0.85em}
.hero .badge-row{display:flex;gap:8px;justify-content:center;margin-top:20px;flex-wrap:wrap}
.hero .badge{background:rgba(201,169,110,0.15);color:#C9A96E;padding:6px 16px;border-radius:20px;font-size:0.8em;font-weight:600;border:1px solid rgba(201,169,110,0.3)}
.content{padding:40px 24px}
h2{font-size:1.8em;font-weight:700;color:#1a1a1a;margin:48px 0 20px;padding-bottom:10px;border-bottom:3px solid var(--gold)}
h3{font-size:1.3em;font-weight:600;color:#2D2D2D;margin:32px 0 12px}
p{margin-bottom:16px;font-size:0.95em;line-height:1.8}
strong{color:#1a1a1a;font-weight:600}
table{width:100%;border-collapse:collapse;margin:20px 0;font-size:0.88em;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)}
thead{background:linear-gradient(135deg,#2D2D2D,#3D3D3D)}
th{color:white;padding:12px 16px;text-align:left;font-weight:600;font-size:0.82em}
td{padding:10px 16px;border-bottom:1px solid #F3F4F6}
tr:hover{background:#F9FAFB}
ul,ol{margin:12px 0 12px 24px}
li{margin-bottom:6px;font-size:0.92em}
hr{border:none;border-top:1px solid #E5E7EB;margin:30px 0}
.callout{background:linear-gradient(135deg,#F0FDF4,#ECFDF5);border-left:4px solid var(--green);border-radius:0 12px 12px 0;padding:20px 24px;margin:24px 0}
.callout.warning{background:linear-gradient(135deg,#FFFBEB,#FEF3C7);border-left-color:#F59E0B}
.callout strong{display:block;margin-bottom:6px}
.footer{background:#1a1a1a;color:#9CA3AF;padding:40px 24px;text-align:center;margin-top:60px;border-top:4px solid var(--gold)}
.footer h3{color:var(--gold);margin-bottom:12px}
.footer p{font-size:0.85em}
@media(max-width:768px){.hero h1{font-size:2em}table{font-size:0.8em}th,td{padding:8px 10px}}
</style>
</head>
<body>
<div class="hero">
  <div class="container">
    <div class="subtitle">Lebon Grace — Business Research</div>
    <h1>${title}</h1>
    <p class="date">${subtitle}</p>
    <div class="badge-row">
      <span class="badge">Laser Cutter (2020)</span>
      <span class="badge">Prusa 3D Printer (2020)</span>
      <span class="badge">Zero Startup Cost</span>
      <span class="badge">UAE + Global</span>
    </div>
  </div>
</div>
<div class="content container">
${mdToHtml(md)}
</div>
<div class="footer">
  <div class="container">
    <h3>Lebon Grace</h3>
    <p>${title} — July 2026</p>
    <p>Equipment: Laser Cutter + Prusa 3D Printer | Market: UAE & Global</p>
  </div>
</div>
</body>
</html>`;
}

// MDF Kids Toys
const mdfMd = fs.readFileSync("research/MDF-KIDS-TOYS-RESEARCH.md", "utf-8");
const mdfHtml = buildHTML(mdfMd, "MDF Kids Toys Business", "USD $1 Pricing Strategy | Deep Market Analysis");
fs.writeFileSync("research/MDF-KIDS-TOYS-RESEARCH.html", mdfHtml);
console.log("MDF Kids Toys HTML:", (mdfHtml.length / 1024).toFixed(1) + "KB");

// MD Cutout
const cutoutMd = fs.readFileSync("research/MD-CUTOUT-RESEARCH.md", "utf-8");
const cutoutHtml = buildHTML(cutoutMd, "MD Cutout Business", "AED 1 Pricing Strategy | Comprehensive Market Analysis");
fs.writeFileSync("research/MD-CUTOUT-RESEARCH.html", cutoutHtml);
console.log("MD Cutout HTML:", (cutoutHtml.length / 1024).toFixed(1) + "KB");

console.log("\nDone!");
