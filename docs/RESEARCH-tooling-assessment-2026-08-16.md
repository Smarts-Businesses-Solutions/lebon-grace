# Tooling assessment: 13 GitHub repos against lebon-grace

Researched 2026-08-16. Every claim below comes from the repo's own README,
LICENSE file, or the GitHub API for that repo. Nothing is inferred from a repo
name and nothing comes from a blog post or a secondary write-up.

Star counts and licence fields are from the GitHub REST API
(`GET /repos/{owner}/{repo}`), read on 2026-08-16. The API star count is the
authoritative one; scraped page numbers were checked against it.

---

## What was being judged against

Six open needs. A repo that serves none of them lands in NOT FOR THIS PROJECT,
and most of them do.

1. A file-upload path for photo or logo personalisation. Checkout takes one
   free-text string today and the shop has no upload anywhere.
2. Real courier cost per parcel. `src/lib/delivery.ts` hardcodes
   `UAE_DELIVERY = 20` and `FREE_DELIVERY_OVER = 150` with no record of what a
   parcel actually costs to send.
3. Uptime and deploy monitoring on cx53.
4. Per-platform link-placement enforcement in `scripts/social/flywheel.mjs`.
   The X rule is prose in a doc, not a constraint in code.
5. Diagrams for `FOR-EVARISTE.md`. That file is 1015 lines and contains zero
   `mermaid` blocks and zero inline SVG.
6. Video review or editing tooling for the launch films in `remotion-launch/`.

---

## 1. HKUDS/CLI-Anything

Source: <https://github.com/HKUDS/CLI-Anything>, <https://clianything.cc/>

**What it does.** The README states the mission as "Making ALL Software
Agent-Native" and "Bridging the Gap Between AI Agents and the World's
Software". It generates command-line interfaces for GUI software from that
software's codebase, so an agent can drive Blender, GIMP, LibreOffice, OBS,
Audacity and similar without GUI automation. A companion registry, CLI-Hub
(`pip install cli-anything-hub`, then `cli-hub install <name>`), distributes
community-built CLIs. The hub site describes itself as an "Agent-Friendly CLI
Registry" and notes that "Public CLIs remain the property of their respective
software owners and maintainers".

**Maturity.** Presented as production-grade: the README badges claim 2,461
passing tests across 18+ applications and links a tech report
(arXiv:2606.03854). Active, last push 2026-08-13.

**Main dependencies.** Python 3.10 or newer, Click 8.0 or newer, and a
supported AI coding agent as the driver.

**Licence.** Apache-2.0. No commercial restriction. Note the hub caveat above:
the licence of any individual generated CLI is a separate question from the
licence of this repo.

**Stars.** 47,531.

**Verdict: serves none of the listed needs.** The premise is bridging agents to
GUI software that has no CLI. Everything in this project's pipeline already has
a CLI or an API: ffmpeg, Remotion, Playwright, the Post for Me API, the R2
scripts. Generating a CLI harness for tools that ship one is work with no
payoff here.

---

## 2. cloudflare/computer

Source: <https://github.com/cloudflare/computer>

**What it does.** The README's first line: "Cloudflare Computer is a virtual
filesystem that lives inside a Durable Object." SQLite holds authoritative
state; one pluggable execution surface (`workspace.runtime`) offers three
backends: a container with a FUSE mount, an isolate shell running just-bash in
a Dynamic Worker, and an isolate JavaScript backend running an ECMAScript
module in a fresh Dynamic Worker.

**Maturity.** Demo/experiment, and the README says so in a callout:
"**PREVIEW ONLY** This package is provided as a preview for feedback only.
APIs are unstable and the design is subject to change. Suitable for
experiments, exploration and prototypes. It is NOT suitable for production use
at this time." It also warns the spec under `docs/` is "forward-looking" and
should be read "for intent, not as description of the code today".

**Main dependencies.** Cloudflare Durable Objects, SQLite, Workers RPC,
capnweb, Dynamic Workers, FUSE. Whole thing assumes the Cloudflare Workers
platform.

**Licence.** MIT.

**Stars.** 8,301.

**Verdict: serves none of the listed needs.** Need 1 is a customer-facing
upload from a Next.js checkout into object storage. This is agent-facing
scratch state on Workers, and the project's only Cloudflare surface is R2 media
hosting for the social flywheel. Vendor-declared not production ready settles
it regardless.

---

## 3. cathrynlavery/diagram-design

Source: <https://github.com/cathrynlavery/diagram-design>

**What it does.** An agent skill for Claude Code, Codex and Pi that produces
editorial diagrams as self-contained HTML plus SVG. The repo description says
"29 editorial diagram types"; the README body says "27 visual types". That is a
discrepancy inside the repo's own primary sources and is worth knowing before
quoting a number. Every type ships in three static variants (minimal light,
minimal dark, full editorial), and the README states there is "no build step,
JavaScript, or external image dependency". Named types include architecture,
flowchart, sequence, state machine, ER/data model, timeline, swimlane,
quadrant, nested, tree, org chart, Venn, layer stack, pyramid/funnel, radar,
loop/flywheel and IT current-state. It can also redraw existing draw.io or
Mermaid sources at a chosen size and detail level, and it reads a website to
pick up brand colours.

**Maturity.** Usable and maintained. Version 2.3 or later, CI across Linux,
Windows and macOS, last push 2026-08-14. This skill is already present in this
environment's skill list, so adoption cost is close to zero.

**Main dependencies.** An agent host (Claude Code, Codex, Pi). Google Fonts for
typography. Python 3 for utility scripts. Playwright optional, only for PNG
export, and Playwright is already in this project.

**Licence.** MIT. No restriction on commercial or self-hosted use.

**Stars.** 19,042.

**Verdict: serves need 5.** `FOR-EVARISTE.md` is 1015 lines of text with no
diagram of any kind. The architecture there is genuinely awkward in prose: a
Coolify service running a prebuilt image, reached through an AWS Caddy box over
an SSH reverse tunnel, with Supabase alongside. That is an architecture diagram
and a sequence diagram waiting to be drawn. Static HTML plus SVG output also
fits how `docs/video/upload-kits.html` is already published. The flywheel type
maps onto `scripts/social/`.

---

## 4. diegosouzapw/OmniRoute

Source: <https://github.com/diegosouzapw/OmniRoute>

**What it does.** An AI gateway. The repo description: "one endpoint, 339
providers (90+ free), 1200+ models". The README adds quota-aware auto-fallback,
19 routing strategies, RTK plus Caveman prompt compression claimed at 15 to 95
percent token saving, MCP and A2A support, and a Desktop/PWA dashboard. It
aggregates documented free tiers into a headline number (about 1.51B free
tokens per month) shown on `/dashboard/free-tiers`.

**Maturity.** Actively developed, last push 2026-08-16. The README is
self-aware about the numbers moving and says figures are re-audited every two
weeks. It also flags that 15 providers are ToS-flagged and leaves the decision
to the user, which is an honest disclosure and also a warning.

**Main dependencies.** TypeScript, a self-hosted gateway process, and API keys
for whichever of the 339 providers you enable.

**Licence.** MIT.

**Stars.** 48,783.

**Verdict: serves none of the listed needs.** None of the six needs is an LLM
routing problem. Adopting this would add a self-hosted gateway to cx53 in
exchange for cheaper model calls that no part of the shop makes at runtime. The
ToS-flagged provider disclosure is a reason for a live commercial shop to stay
away.

---

## 5. TencentCloud/TencentDB-Agent-Memory

Source: <https://github.com/TencentCloud/TencentDB-Agent-Memory>

**What it does.** The repo description calls it "a team-level memory hub for AI
Agents", turning conversations, docs and code into four memory assets: Chat
Memory, Skill, LLM-Wiki and Code-Graph, shared across agents and frameworks. It
works by proxy: point an agent's base URL at the proxy and no plugin, hook or
MCP server is needed. Ships with Claude Code, Codex, CodeBuddy, DeepSeek
Harness, Hermes and OpenClaw integrations.

**Maturity.** The README carries a banner reading "Team Memory Beta is evolving
quickly". Usable but explicitly beta. Last push 2026-08-15.

**Main dependencies.** Node 22.16 or newer, Docker (the install is
`deploy/global-images/start-all.sh`), three services running together
(`memory-core`, `memory-hub`, a proxy), and two separate sets of LLM
credentials.

**Licence.** The GitHub API reports `NOASSERTION` because a Tencent preamble
sits above the licence text, but the LICENSE file itself says "TencentDB Agent
Memory is licensed under the MIT" followed by the full MIT terms. Treat it as
MIT. Not AGPL, no non-commercial clause.

**Stars.** 22,069.

**Verdict: serves none of the listed needs.** Agent memory for a multi-agent
team. This project already has a memory layer and none of the six needs is
about agent recall. Three extra services and two LLM credential sets on cx53
for zero movement on any need.

---

## 6. mattpocock/skills

Source: <https://github.com/mattpocock/skills>

**What it does.** The repo description: "Skills for Real Engineers. Straight
from my .agents directory." A set of agent skills, installed either as a Claude
Code plugin (`claude plugins install mattpocock-skills`) or copied into a repo
via `npx skills@latest add mattpocock/skills`. The skills tree holds
`engineering/` (code-review, codebase-design, diagnosing-bugs, domain-modeling,
grill-with-docs, implement, prototype, research, tdd, to-spec, to-tickets,
triage, wayfinder and others), `productivity/` (grill-me, grilling, handoff,
teach, writing-for-agents and others), plus `misc`, `in-progress` and
`deprecated`. The README frames them as fixes for agent failure modes,
starting with misalignment, and prescribes a "grilling session" before work
begins.

**Maturity.** Usable and heavily maintained, last push 2026-08-15. Shipped
through Claude Code's official marketplace.

**Main dependencies.** An agent host. Shell for the installer. Nothing runs in
production.

**Licence.** MIT.

**Stars.** 218,724.

**Verdict: serves none of the listed needs.** Worth saying plainly: these are
process skills, not product capability, and none of the six needs is a process
gap. The overlap that exists is with rules this project already wrote for
itself. `grill-me` and `grilling` do the same job as the "Challenge Me" section
in `CLAUDE.md`; `tdd` and `diagnosing-bugs` restate the existing bug protocol.
Installing it would duplicate house rules rather than add anything.

---

## 7. zhaoxuya520/reverse-skill

Source: <https://github.com/zhaoxuya520/reverse-skill>

**What it does.** A security skill router. The README: when an agent
"encounters an APK, a binary, frontend JS encryption, a CTF challenge, or a
pentesting target, this package routes it to the right methodology, checks
available tools, and executes a repeatable workflow instead of guessing
commands". It covers reverse engineering, authorised penetration testing and
security research, with 41 routing rules (R0 to R40), a 163-case regression
benchmark and 42 tracked skill modules.

**Maturity.** Usable, release v1.0.1, CI on Windows and Ubuntu, last push
2026-08-15.

**Main dependencies.** PowerShell is the primary language (`master-route.ps1`).
Bootstraps external toolchains on demand: jadx, apktool, Frida, IDA, Burp
Suite. An agent client (Claude Code, Kiro, Cursor, Cline).

**Licence.** MIT.

**Stars.** 25,564.

**Verdict: serves none of the listed needs.** Offensive security tooling for
APKs, binaries and CTFs. This project is a Next.js shop with no binary, no
mobile app and no authorised pentest engagement. Nothing here touches any of
the six needs.

---

## 8. permissionlesstech/bitchat

Source: <https://github.com/permissionlesstech/bitchat>

**What it does.** The README: "A decentralized peer-to-peer messaging app with
dual transport architecture: local Bluetooth mesh networks for offline
communication and internet-based Nostr protocol for global reach. No accounts,
no phone numbers, no central servers." Bluetooth LE mesh with multi-hop relay
up to 7 hops, Noise Protocol end-to-end encryption on the mesh, geohash-based
location channels over Nostr relays, IRC-style commands.

**Maturity.** Production-ready as a shipped consumer app: live on the App Store
and Play Store, last push 2026-08-16. The README also states the repo "has been
the target of takedown demands" and documents build verification against a
per-release hash manifest.

**Main dependencies.** Swift, iOS and macOS native frameworks, CoreBluetooth,
Nostr relays, LZ4 compression. There is an Android client too.

**Licence.** The Unlicense (public domain). The README says the project "is
released into the public domain". No commercial restriction whatsoever.

**Stars.** 35,412.

**Verdict: serves none of the listed needs.** A Swift mesh messaging app. There
is no reading of any of the six needs it touches.

---

## 9. virgiliojr94/book-to-skill

Source: <https://github.com/virgiliojr94/book-to-skill>

**What it does.** Converts a technical book, a document folder or a glob into a
single agent skill. Input formats listed: PDF, EPUB, DOCX, MD, HTML, RTF, MOBI.
Output is a skill directory with a `SKILL.md`, per-chapter files, frameworks,
decision rules and anti-patterns, loaded on demand by slash command. The README
claims "24x to 51x fewer tokens than dumping the book into context" to answer
one question. Works with any host on the Agent Skills standard: GitHub Copilot
CLI, Amp, Claude Code.

**Maturity.** Usable, tagged releases, last push 2026-08-13.

**Main dependencies.** Python. Calibre only for MOBI/AZW input. An agent host.

**Licence.** MIT.

**Stars.** 21,974.

**Verdict: serves none of the listed needs.** It converts documents into agent
skills. None of the six needs is blocked on reference material. The one thing
it could produce here, a skill distilled from `FOR-EVARISTE.md`, runs backwards
against need 5: that file needs pictures, not another text derivative.

---

## 10. pascalorg/editor

Source: <https://github.com/pascalorg/editor>

**What it does.** The README's first line: "A 3D building editor built with
React Three Fiber and WebGPU." The repo description is "Create and share 3D
architectural projects", topics include BIM, CAD, floorplan and
parametric-design. It is a Turborepo monorepo shipping `@pascal-app/core`
(node schemas, Zustand scene state), `@pascal-app/viewer` (R3F rendering),
`@pascal-app/editor` (tools and UI), `@pascal-app/nodes`, `@pascal-app/cli` and
`@pascal-app/mcp` (an MCP server exposing scene tools to AI hosts). Runs
locally with `npx @pascal-app/cli editor`, storing projects in
`~/.pascal/data/pascal.db`.

**Maturity.** Usable and very active, last push 2026-08-16, packages published
to npm.

**Main dependencies.** Node 22.13 or newer, Next.js, React Three Fiber,
Three.js, WebGPU, Zustand, Zundo, IndexedDB.

**Licence.** MIT.

**Stars.** 21,415.

**Verdict: serves none of the listed needs.** The name invites a wrong guess in
two directions and neither survives the README. It is not a general-purpose
editor and it is not a 2D vector or laser-cutting tool, so it does nothing for
the DXF or MDF side of the catalogue. It is architectural BIM: buildings,
levels, zones, floorplans. No overlap with any of the six needs.

---

## 11. bojieli/ai-agent-book

Source: <https://github.com/bojieli/ai-agent-book>

**What it does.** Not software. It is the open-source repository for a book,
"深入理解 AI Agent：设计原理与工程实践" (Deep Understanding of AI Agents: Design
Principles and Engineering Practice) by Li Bojie. Ten chapters, full text plus
compiled PDF and EPUB, 95 companion experiments, translated into 13 languages
by the community. Built around the formula "Agent = LLM + context + tools".

**Maturity.** A finished, actively republished book with per-push builds and
tagged releases. Not a tool, so production-readiness does not apply.

**Main dependencies.** Python for the companion experiments. Otherwise a PDF
reader.

**Licence.** Apache-2.0.

**Stars.** 37,718.

**Verdict: serves none of the listed needs.** Reading material about agent
design. It moves none of the six needs. Worth noting for completeness: a skill
derived from this book (`ai-agent-engineering`) is already available in this
environment, so even the reference-material angle is covered without touching
the repo.

---

## 12. koala73/worldmonitor

Source: <https://github.com/koala73/worldmonitor>

**What it does.** A geopolitical intelligence dashboard, not a server
monitoring tool. The README's own "What It Does" list: curated news feeds
AI-synthesized into briefs, a 3D globe and WebGL flat map, cross-stream
correlation of military, economic, disaster and escalation signals, a Country
Instability Index, a finance radar covering exchanges, commodities and crypto,
and site variants for tech, finance, commodity, energy and happy. Flight data
comes from Wingbits ADS-B. The word "infrastructure" in the repo description
means real-world infrastructure such as aviation and energy, not uptime of a
server.

**Maturity.** Production-ready as a product: stable public deployments, signed
desktop binaries for Windows, macOS and Linux, npm, PyPI, RubyGems and Go SDKs,
a hosted MCP server and a REST API.

**Main dependencies.** Vanilla TypeScript, Vite, globe.gl, Three.js, deck.gl,
MapLibre GL, Tauri 2, Protocol Buffers, Redis via Upstash, Vercel Edge
Functions. Local AI through Ollama, or Groq/OpenRouter.

**Licence.** AGPL-3.0-only. **Flag this.** The README's own table allows
self-hosted and commercial use under AGPL "when you comply with AGPL
obligations", but private-source proprietary use requires separate permission.
Because this project is self-hosted and network-facing, AGPL section 13 would
attach source-availability duties to any derived deployment. This repo is
public today, but taking AGPL code turns a licensing choice into a licensing
obligation.

**Stars.** 82,238.

**Verdict: serves none of the listed needs.** Specifically, it does **not**
serve need 3. Need 3 is "is cx53 up and did the deploy land". This tells you
about coups and commodity prices. Wrong kind of monitoring, and the AGPL makes
the wrong tool an expensive one.

---

## 13. OpenCut-app/OpenCut

Source: <https://github.com/OpenCut-app/OpenCut>

**What it does.** The README headline: "A free and open source video editor for
web, desktop, and mobile." The repo description calls it "The open-source
CapCut alternative".

**Maturity.** This is the important part and it comes straight from the
README's Status section: "**OpenCut is being rewritten from the ground up.**"
Planned for the rewrite are an Editor API, a plugin-first architecture, one
Rust core across desktop, mobile and browser, an MCP server for AI agents,
headless mode for automation and batch rendering, and a scripting tab. The
README then says the previous version at `opencut-app/opencut-classic` "is the
one to reach for today" and that `opencut.app` still runs it.

That pointer needs a correction that the README does not make: the GitHub API
reports `opencut-app/opencut-classic` as **archived**, last pushed 2026-05-17,
221 stars. The version being recommended is frozen. The README also states
"We're not set up to take outside contributions yet while the architecture is
being designed."

So the honest maturity reading is: the usable version is archived, and the
maintained version is an in-flight rewrite that is not taking contributions.

**Main dependencies.** proto and moon (moonrepo) for the toolchain, with `web`,
`api` and `desktop` targets. A Rust core is planned. Sponsored by fal.ai.

**Licence.** MIT.

**Stars.** 83,491.

**Verdict: serves need 6, with a real maturity caveat.** It is the only repo of
the 13 that touches video at all. A browser-based timeline editor would let the
launch films be reviewed and trimmed without a Remotion re-render, which is the
current cost of any small change. The headless mode and MCP server on the
roadmap would fit the existing ffmpeg pipeline well if they land. But the
roadmap is not shipped and the shipped thing is archived, so this is a trial
against the classic build, not a dependency to take on.

---

## Ranked summary

### ADOPT

- **cathrynlavery/diagram-design** (MIT, 19,042 stars). Serves **need 5**.
  `FOR-EVARISTE.md` has 1015 lines and zero diagrams; this produces
  self-contained HTML plus SVG with no build step, and the skill is already
  available in this environment.

### WORTH A TRIAL

- **OpenCut-app/OpenCut** (MIT, 83,491 stars). Serves **need 6**. The only
  video tool of the 13, but the usable build (`opencut-classic`) is archived
  and the maintained one is a rewrite closed to contributions. Trial it, do not
  depend on it.

### NOT FOR THIS PROJECT

- **HKUDS/CLI-Anything** (Apache-2.0, 47,531). Serves none. Generates CLIs for
  GUI software; everything in this pipeline already has a CLI.
- **cloudflare/computer** (MIT, 8,301). Serves none. Agent scratch filesystem
  on Workers, and the README says "NOT suitable for production use".
- **diegosouzapw/OmniRoute** (MIT, 48,783). Serves none. LLM gateway; no need
  here is a model-routing problem, and 15 providers are ToS-flagged.
- **TencentCloud/TencentDB-Agent-Memory** (MIT via LICENSE text, 22,069).
  Serves none. Three services and two LLM credential sets for agent memory
  nobody asked for.
- **mattpocock/skills** (MIT, 218,724). Serves none. Process skills that
  duplicate rules already written in `CLAUDE.md`.
- **zhaoxuya520/reverse-skill** (MIT, 25,564). Serves none. APK, binary and CTF
  security routing; this project has no binary and no pentest engagement.
- **permissionlesstech/bitchat** (Unlicense, 35,412). Serves none. A Swift
  Bluetooth mesh messaging app.
- **virgiliojr94/book-to-skill** (MIT, 21,974). Serves none. No need here is
  blocked on reference material, and need 5 wants pictures not more text.
- **pascalorg/editor** (MIT, 21,415). Serves none. Architectural BIM, not a
  2D or laser-cutting editor. The name is the trap.
- **bojieli/ai-agent-book** (Apache-2.0, 37,718). Serves none. A book, and its
  derived skill is already available here anyway.
- **koala73/worldmonitor** (**AGPL-3.0-only**, 82,238). Serves none, and
  specifically not need 3: it monitors geopolitics and commodities, not server
  uptime. AGPL copyleft on a network-facing self-hosted deployment.

### The result that matters

Needs **1** (file upload for photo personalisation), **2** (real courier cost
per parcel), **3** (uptime and deploy monitoring on cx53) and **4**
(per-platform link-placement enforcement in the flywheel) are served by
**none of the 13 repos**. Four of the six needs came out of this exercise
untouched. Those four still need their own solutions and this list does not
contain them.

### Licence flags

- **AGPL**: `koala73/worldmonitor` only, AGPL-3.0-only.
- **Non-commercial clauses**: none found in any of the 13.
- **Worth knowing**: `TencentCloud/TencentDB-Agent-Memory` reads as
  `NOASSERTION` through the GitHub API because of a Tencent preamble above the
  licence text. The LICENSE file itself grants MIT terms.
- **Public domain**: `permissionlesstech/bitchat` is the Unlicense.

### Fetch failures

None. All 13 repositories and <https://clianything.cc/> were reachable on
2026-08-16 and every claim above is sourced from the repo's own README, its
LICENSE file, or the GitHub REST API.
