const fs = require("fs");

function mdToHtml(md) {
  // Convert markdown tables to HTML tables
  const lines = md.split("\n");
  let html = "";
  let inTable = false;
  let tableRows = [];
  let isHeader = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Table separator line
    if (/^\|[\s-|]+\|$/.test(trimmed)) {
      isHeader = true;
      continue;
    }

    // Table row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
      if (!inTable) {
        html += '<table><thead><tr>';
        cells.forEach((c) => { html += `<th>${c}</th>`; });
        html += "</tr></thead><tbody>\n";
        inTable = true;
        isHeader = false;
      } else if (isHeader) {
        // Skip separator line
        isHeader = false;
      } else {
        html += "<tr>";
        cells.forEach((c) => { html += `<td>${c}</td>`; });
        html += "</tr>\n";
      }
      continue;
    }

    // Close table if we were in one
    if (inTable) {
      html += "</tbody></table>\n\n";
      inTable = false;
    }

    // Headers
    if (trimmed.startsWith("### ")) {
      html += `<h3>${trimmed.slice(4)}</h3>\n`;
    } else if (trimmed.startsWith("## ")) {
      html += `<h2>${trimmed.slice(3)}</h2>\n`;
    } else if (trimmed.startsWith("# ")) {
      html += `<h1>${trimmed.slice(2)}</h1>\n`;
    }
    // Bold
    else if (trimmed.startsWith("- ")) {
      html += `<li>${trimmed.slice(2)}</li>\n`;
    }
    // Horizontal rule
    else if (trimmed === "---") {
      html += '<hr>\n';
    }
    // Empty line
    else if (trimmed === "") {
      html += "\n";
    }
    // Paragraph
    else if (trimmed) {
      // Process bold and links
      let processed = trimmed
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, '<code>$1</code>');
      html += `<p>${processed}</p>\n`;
    }
  }

  // Close any open table
  if (inTable) html += "</tbody></table>\n";

  return html;
}

function buildHTML(md, title, subtitle, sections) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Lebon Grace</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --gold: #C9A96E;
      --gold-light: #E8D5B0;
      --dark: #1a1a1a;
      --dark2: #2D2D2D;
      --green: #16A34A;
      --green-light: #F0FDF4;
      --red: #DC2626;
      --amber: #F59E0B;
      --amber-light: #FFFBEB;
      --blue: #3B82F6;
      --blue-light: #EFF6FF;
      --border: #E5E7EB;
      --text: #374151;
      --text-light: #6B7280;
      --bg: #FAFAFA;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      line-height: 1.8;
      color: var(--text);
      background: var(--bg);
      -webkit-font-smoothing: antialiased;
    }

    .container { max-width: 960px; margin: 0 auto; padding: 0 24px; }

    /* Hero */
    .hero {
      background: linear-gradient(135deg, var(--dark) 0%, var(--dark2) 50%, var(--dark) 100%);
      color: white;
      padding: 100px 24px 80px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 30% 50%, rgba(201,169,110,0.08) 0%, transparent 50%);
    }
    .hero h1 { font-size: 3em; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.5px; position: relative; }
    .hero .subtitle { color: var(--gold); font-size: 1.2em; font-weight: 500; position: relative; }
    .hero .date { color: #9CA3AF; font-size: 0.85em; margin-top: 8px; position: relative; }
    .hero .badge-row { display: flex; gap: 10px; justify-content: center; margin-top: 28px; flex-wrap: wrap; position: relative; }
    .hero .badge { background: rgba(201,169,110,0.12); color: var(--gold); padding: 8px 20px; border-radius: 24px; font-size: 0.82em; font-weight: 600; border: 1px solid rgba(201,169,110,0.25); backdrop-filter: blur(10px); }

    /* Navigation */
    .toc { background: white; border: 1px solid var(--border); border-radius: 16px; padding: 32px; margin: -40px auto 40px; position: relative; z-index: 10; max-width: 960px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .toc h2 { font-size: 1em; margin: 0 0 16px 0; padding: 0; border: none; }
    .toc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
    .toc a { display: block; padding: 8px 12px; border-radius: 8px; font-size: 0.85em; color: var(--text-light); text-decoration: none; transition: all 0.2s; }
    .toc a:hover { background: var(--green-light); color: var(--green); }

    /* Content */
    .content { padding: 40px 0; }

    h1 { font-size: 2.2em; font-weight: 800; color: var(--dark); margin: 60px 0 24px; letter-spacing: -0.3px; }
    h2 { font-size: 1.6em; font-weight: 700; color: var(--dark2); margin: 56px 0 20px; padding-bottom: 12px; border-bottom: 3px solid var(--gold); letter-spacing: -0.2px; }
    h3 { font-size: 1.2em; font-weight: 600; color: #4B5563; margin: 36px 0 12px; }
    p { margin-bottom: 16px; font-size: 0.95em; }
    strong { color: var(--dark); font-weight: 600; }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 0.88em;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      border: 1px solid var(--border);
    }
    thead { background: linear-gradient(135deg, var(--dark2), #3D3D3D); }
    th { color: white; padding: 14px 18px; text-align: left; font-weight: 600; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 12px 18px; border-bottom: 1px solid #F3F4F6; }
    tr:hover td { background: #F9FAFB; }
    tr:nth-child(even) td { background: #FAFBFC; }

    /* Lists */
    ul, ol { margin: 16px 0 16px 24px; }
    li { margin-bottom: 8px; font-size: 0.92em; line-height: 1.7; }

    /* Code */
    code { background: #F3F4F6; padding: 2px 8px; border-radius: 6px; font-size: 0.88em; font-family: 'SF Mono', Monaco, monospace; }

    /* Callouts */
    .callout { background: linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%); border-left: 4px solid var(--green); border-radius: 0 12px 12px 0; padding: 20px 24px; margin: 28px 0; }
    .callout.warning { background: linear-gradient(135deg, var(--amber-light) 0%, #FEF3C7 100%); border-left-color: var(--amber); }
    .callout.info { background: linear-gradient(135deg, var(--blue-light) 0%, #DBEAFE 100%); border-left-color: var(--blue); }
    .callout strong { display: block; margin-bottom: 6px; font-size: 0.95em; }
    .callout p { margin-bottom: 8px; }

    /* HR */
    hr { border: none; border-top: 1px solid var(--border); margin: 40px 0; }

    /* Footer */
    .footer { background: var(--dark); color: #9CA3AF; padding: 48px 24px; text-align: center; margin-top: 80px; border-top: 4px solid var(--gold); }
    .footer h3 { color: var(--gold); margin-bottom: 12px; font-size: 1.2em; }
    .footer p { font-size: 0.85em; margin-bottom: 4px; }
    .footer .meta { margin-top: 16px; font-size: 0.75em; color: #6B7280; }

    /* Responsive */
    @media (max-width: 768px) {
      .hero h1 { font-size: 2em; padding: 60px 24px 40px; }
      .toc { margin: -20px 16px 32px; padding: 20px; }
      table { font-size: 0.8em; }
      th, td { padding: 10px 12px; }
    }

    /* Print */
    @media print {
      .hero { padding: 40px 24px; background: #333; }
      .toc { display: none; }
      body { background: white; }
      table { page-break-inside: avoid; }
    }
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

<div class="toc">
  <h2>📋 Table of Contents</h2>
  <div class="toc-grid">
    ${sections.map((s, i) => `<a href="#s${i}">${s}</a>`).join("\n    ")}
  </div>
</div>

<div class="content container">
${mdToHtml(md)}
</div>

<div class="footer">
  <div class="container">
    <h3>Lebon Grace</h3>
    <p>${title}</p>
    <p>Equipment: Laser Cutter + Prusa 3D Printer | Market: UAE & Global</p>
    <p class="meta">Research compiled from AliExpress, Amazon, Alibaba, Etsy, 3axis.co, free-dxf.com, dxfdownloads.com, CADAM, and industry sources.</p>
    <p class="meta">July 2026 — Confidential — Lebon Grace Internal Use</p>
  </div>
</div>

</body>
</html>`;
}

// MDF Kids Toys
const mdfMd = fs.readFileSync("research/MDF-KIDS-TOYS-RESEARCH.md", "utf-8");
const mdfSections = ["Executive Summary", "Production Costs", "Competitor Pricing", "Free & AI Cut Files", "Safety Regulations", "Best-Selling Products", "Industry Trends", "Financial Projections", "Equipment Advantage", "IVEI Reference", "Action Plan", "Detailed Data", "Competitor Analysis", "Material Costs", "Unit Economics", "Free Design Sources", "DIY Kit Model", "AI Design", "Optimal Sizing", "File Sourcing", "Competitive Advantage", "IVEI Analysis", "Raw Material Costs", "Unit Economics (AED 1)", "Free & AI Sources", "Global Strategy"];
const mdfHtml = buildHTML(mdfMd, "MDF Kids Toys Business", "USD $1 Pricing Strategy | Deep Market Analysis | UAE + Global", mdfSections);
fs.writeFileSync("research/MDF-KIDS-TOYS-RESEARCH.html", mdfHtml);
console.log("MDF Kids Toys HTML:", (mdfHtml.length / 1024).toFixed(1) + "KB");

// MD Cutout
const cutoutMd = fs.readFileSync("research/MD-CUTOUT-RESEARCH.md", "utf-8");
const cutoutSections = ["Executive Summary", "Market Overview", "Product Analysis", "Competitor Analysis", "Pricing Strategy", "UAE Market", "Industry Trends", "Platform Strategy", "Financial Projections", "Action Plan", "Risk Analysis", "Appendix", "Equipment Advantage", "IVEI Competitor", "Product Opportunities", "UAE Opportunities", "Financial Projections (Revised)", "Pricing Tiers", "Digital File Revenue", "Your Equipment", "Cost Advantage", "IVEI Product Line", "Pricing at AED 1", "Product Opportunities", "Digital File Revenue", "UAE Seasonal", "Global Strategy"];
const cutoutHtml = buildHTML(cutoutMd, "MD Cutout Business", "AED 1 Pricing Strategy | Comprehensive Market Analysis | UAE + Global", cutoutSections);
fs.writeFileSync("research/MD-CUTOUT-RESEARCH.html", cutoutHtml);
console.log("MD Cutout HTML:", (cutoutHtml.length / 1024).toFixed(1) + "KB");
