# Secure public file uploads to R2, for the custom design request page

Research for Task #72. Written 2026-08-19 against primary sources only: the
Next.js documentation, the Cloudflare R2 documentation, OWASP, MDN, and the
source or registry metadata of every library named. No secondary blog summary
was used. Where a source did not answer the question, this document says "could
not verify" rather than guessing.

Every claim below carries the URL it came from. Anything about this repository
was checked against the working tree, not from memory.

---

## Three things in the brief that are not true of the repository

These change the answers, so they come first.

**The proxy is Traefik, not Caddy.** `DEPLOYMENT-GUIDE.md` line 14 records the
live path as `Cloudflare -> coolify-proxy (Traefik) -> lebon-grace container
:3000`. `src/lib/rate-limit.ts` says the same and adds that "the Caddy/SSH-tunnel
deployment ... no longer exists". `docs/architecture-production-topology.html`
still draws Caddy on an AWS box in Mumbai and is out of date. Body size limits
differ between the two proxies, so this matters to section 1.

**`src/lib/rate-limit.ts` is in memory, not database backed.** Its own header
says so: "Deliberately dependency-free and in-process ... This Map is zeroed by
every restart and deploy". The database backed throttle is a different thing,
`src/lib/login-throttle.ts` over the `login_attempts` table from migration
`0006_login_attempts.sql`. That distinction decides section 5.

**sharp is present but is not a dependency of this project.** `package.json`
does not list it. `package-lock.json` line 7647 shows `"sharp": "^0.35.3"` inside
the `next` package entry, so it arrives as an optional dependency of
`next@16.3.0`. It is installed at `node_modules/sharp`, version 0.35.3, licence
Apache-2.0. `aws4fetch` is worse off: the only copy in the tree is
`scripts/social/node_modules/aws4fetch`, which is a separate install for the
social scripts. Neither is reachable from the app as things stand. Both must be
added to the root `package.json` before any of this can ship. See section 7.

**The table already exists.** `supabase/migrations/0012_design_requests.sql` is
committed and defines `public.design_requests` with `artwork_key`,
`artwork_type`, `artwork_bytes`, `status`, `expires_at` and RLS enabled. Section
7 works with that schema rather than proposing a new one.

---

## 1. Upload mechanism

### What Next.js 16 actually limits

Nothing, for route handlers. The `route.js` reference for 16.3.1 documents the
body being read with `request.json()`, `request.text()` and `request.formData()`
and states: "Notably, unlike API Routes with the Pages Router, you do not need to
use `bodyParser` to use any additional configuration."
(<https://nextjs.org/docs/app/api-reference/file-conventions/route>)

The segment config options listed on that same page are `dynamic`,
`dynamicParams`, `revalidate`, `fetchCache`, `runtime` and the deprecated
`preferredRegion`. There is no size option among them.

The 1 MB default that people remember belongs to Server Actions, not route
handlers: "By default, the maximum size of the request body sent to a Server
Action is 1MB ... you can configure this limit using the
`serverActions.bodySizeLimit` option. It can take the number of bytes or any
string format supported by bytes, for example `1000`, `'500kb'` or `'3mb'`."
(<https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions>)
That page also warns the limit counts multipart overhead: "The limit applies to
the raw HTTP request body, including the bytes that `multipart/form-data` adds
for boundaries, part headers, and field metadata ... an additional 10-20 KB is a
reasonable rule of thumb."

So: **a route handler in Next 16 has no documented body size limit, and no
documented way to configure one.** Next's own self-hosting guide says the limit
is somebody else's job: "A reverse proxy can handle malformed requests, slow
connection attacks, payload size limits, rate limiting, and other security
concerns, offloading these tasks from the Next.js server."
(<https://nextjs.org/docs/app/guides/self-hosting>)

The widely quoted 4.5 MB figure is a Vercel platform limit, not a Next.js one:
"The maximum payload size for the request body or the response body of a Vercel
Function is **4.5 MB**." (<https://vercel.com/docs/functions/limitations>) This
app does not run on Vercel and that number does not apply to it.

Could not verify: whether the Next.js Node server enforces any hard internal cap
below the Node HTTP defaults. The documentation does not state one, and no
primary Next.js page was found that does.

### What the layers in front actually limit

| Layer | Limit | Source |
|---|---|---|
| Cloudflare (Free and Pro) | 100 MB request body, 413 above it | <https://developers.cloudflare.com/workers/platform/limits/> |
| Cloudflare (Business) | 200 MB | same |
| Traefik | `maxRequestBodyBytes` default `0`, meaning unlimited. Above the limit, "it is not forwarded to the Service, and the client gets a `413`" | <https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/buffering/> |
| Caddy, if it ever returns | `request_body max_size`, "Reads of more bytes will return an error with HTTP status `413`" | <https://caddyserver.com/docs/caddyfile/directives/request_body> |

Traefik's `buffering` middleware is not applied unless configured, so today the
practical ceiling on this deployment is Cloudflare's 100 MB. That is far too
generous for a photograph and needs narrowing at two levels.

Note the Traefik side effect: `memRequestBodyBytes` defaults to 1,048,576 bytes,
above which Traefik buffers the request to disk. Enabling `buffering` to get
`maxRequestBodyBytes` also turns on that buffering behaviour.

### (a) POST through a route handler, or (b) presigned PUT direct to R2

**(a) is correct here, and the deciding factor is the requirement to validate
before storing.**

R2 presigned URLs support "GET ... HEAD ... PUT ... DELETE" and explicitly not
POST: "POST (multipart form uploads via HTML forms) is not currently supported."
(<https://developers.cloudflare.com/r2/api/s3/presigned-urls/>) That is the
whole argument. S3's presigned POST carries a policy document which can include
a `content-length-range` condition; presigned PUT has no equivalent. Cloudflare
documents exactly one restriction you can bake into a presigned PUT: "Specify
the allowed `Content-Type` in your SDK's parameters. The signature will include
this header, so uploads will fail with a `403/SignatureDoesNotMatch` error if
the client sends a different `Content-Type`." A client that sends
`Content-Type: image/jpeg` and a body of HTML satisfies that check completely.

Could not verify: whether R2 enforces a signed `Content-Length` on presigned
PUT. The presigned URL page does not mention Content-Length at all, and the S3
API compatibility page
(<https://developers.cloudflare.com/r2/api/s3/api/>) lists supported PutObject
headers as "Content-Type, Cache-Control, Content-Disposition, Content-Encoding,
Content-Language, Expires, Content-MD5" without saying whether a signed
Content-Length is rejected on mismatch. Do not design around it.

Cloudflare also warns what a presigned URL is: "Treat presigned URLs as bearer
tokens. Anyone with the URL can perform the specified operation until it
expires." Handing an anonymous, pre-payment visitor a write token to a bucket
is a strictly worse position than accepting bytes and deciding.

The other costs of (b) on this app:

- Browser uploads to a presigned URL need a CORS policy on the bucket.
  "Browser-based uploads and downloads using presigned URLs will fail" without
  one, "even though the URLs themselves remain valid."
  (<https://developers.cloudflare.com/r2/buckets/cors/>) That is a new
  cross-origin surface for one form.
- Validation would have to happen after the bytes are already stored, which
  means a second pass, a quarantine prefix, and a window during which an
  unvalidated object exists under our account.
- `aws4fetch` presigning would need verifying first. Its README documents
  `signQuery`, "set to true to sign the query string instead of the
  Authorization header", but the README does not show a presigned URL example
  and does not mention `X-Amz-Expires`
  (<https://github.com/mhart/aws4fetch>, <https://raw.githubusercontent.com/mhart/aws4fetch/master/README.md>).
  Could not verify how expiry is set with this library.

**Chosen: (a).** POST `multipart/form-data` to a Next route handler, validate and
re-encode in the handler, then PUT the re-encoded bytes to R2 server side with a
SigV4 signature, exactly as `scripts/social/r2-upload.mjs` already does.

The one real cost of (a) is memory. `request.formData()` buffers the entire body
before it resolves. Guard it in this order:

1. Reject on the `Content-Length` request header before touching the body. It is
   client supplied and can lie, so this is a cheap first filter, not the control.
2. Read `request.body` as a stream through a byte counter and abort past the cap.
   That is the control, because it cannot be lied to.
3. Set Traefik `buffering.maxRequestBodyBytes` as the outer belt so a
   multi-gigabyte body never reaches Node at all.

---

## 2. Content validation

### The library

`file-type`, by Sindre Sorhus and Borewit.

| Fact | Value | Source |
|---|---|---|
| Latest version | 22.0.2 | <https://registry.npmjs.org/file-type/latest> |
| Licence | MIT | same |
| Engines | Node >= 22 | same |
| Published | registry timestamp 1786758468205, about 2026-07-15 | same |
| Module format | ESM only | <https://github.com/sindresorhus/file-type> |
| Dependencies | strtok3, token-types, uint8array-extras, @tokenizer/inflate | registry |
| Default sample | 4100 bytes | README |

The container runs `node:22-alpine` (`Dockerfile` lines 19 and 74), so the
`engines: node >= 22` requirement is met.

The README's own warning is the important part and should be quoted in the code
that uses it: "File type detection is based on binary signatures (magic numbers)
and is a best-effort hint. It does not guarantee the file is actually of that
type or that the file is valid/not malformed." OWASP says the same about
signature checks generally: "This should not be used on its own, as bypassing it
is pretty common and easy."
(<https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html>)

### The magic numbers, for a handwritten check

The library is convenient, but three formats is a short list and a
dependency-free check is a legitimate choice for this app. The signatures:

| Format | Leading bytes | Notes |
|---|---|---|
| JPEG | `FF D8 FF` | every JPEG variant |
| PNG | `89 50 4E 47 0D 0A 1A 0A` | eight bytes, fixed |
| WebP | `52 49 46 46` at 0, `57 45 42 50` at 8 | `RIFF....WEBP` |
| GIF | `47 49 46 38` | `GIF8` |

Read the first 12 bytes, compare, reject anything else. This is a filter, not a
guarantee, for exactly the reason OWASP gives: prefixing three bytes to a
malicious payload is trivial.

### Rejecting HTML renamed to .jpg

Two independent gates, and it fails both.

An HTML file begins with `<!DOCTYPE`, `<html`, whitespace or a BOM. None of
those match any signature above, so the magic number check rejects it and
`file-type` returns `undefined`. Rely on `undefined` meaning reject, never
meaning "probably fine".

The second gate is decode. A file that survives the signature check only because
somebody glued `FF D8 FF` on the front will fail to decode as an image. sharp's
constructor defaults `failOn` to `'warning'`, "When to abort processing of
invalid pixel data, one of (in order of sensitivity, least to most): 'none',
'truncated', 'error', 'warning'"
(<https://sharp.pixelplumbing.com/api-constructor/>). Leave that default alone.
The strictest setting is the default, which is the right way round.

The third gate, and the only one that is actually a guarantee, is that we never
store the customer's bytes. OWASP: "applying image rewriting techniques destroys
any kind of malicious content injected in an image." We decode with sharp and
re-encode, and the object in R2 is our encoder's output, not their input.

### Rejecting SVG renamed to .jpg, and whether SVG is allowed at all

**SVG must not be accepted.** Not for the logo, not for anything.

SVG carries script by design. MDN: "The `<script>` SVG element allows to add
scripts to an SVG document."
(<https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/script>)

The usual reassurance is that scripts do not run when an SVG is used as an
image, and that is true as far as it goes. MDN lists the restrictions in an
image context as: "JavaScript is disabled", "External resources (e.g., images,
stylesheets) cannot be loaded, though they can be used if inlined through
`data:` URLs", ":visited-link styles aren't rendered", "Platform-native widget
styling (based on OS theme) is disabled." The next sentence is the one that
matters: "the above restrictions are specific to image contexts; they don't
apply when SVG content is viewed directly, or when it's embedded as a document
via the `<iframe>`, `<object>`, or `<embed>` elements."
(<https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image>)

"Viewed directly" is precisely what the operator will do. Anyone who clicks a
link to an SVG, or opens it in a new tab from an admin queue, is navigating to
it, not rendering it in an `<img>`. Script runs, with the origin of whatever
host served it. That is the whole attack, and it needs no bug anywhere in our
code.

Detection: SVG is XML text, not a binary format, so it has no magic number and
the byte check above rejects it by default. Do not add an SVG branch. Note also
that sharp accepts SVG as an input format on the prebuilt binaries
(<https://sharp.pixelplumbing.com/install/>), with a `density` option defaulting
to 72, so an SVG handed to sharp will be rasterised rather than refused. The
guard must be ours, before sharp sees it. Enumerate the allowed decoded formats
from `sharp().metadata()` and reject anything not in the list.

A logo does not need SVG. Ask for a PNG. If a customer only has SVG, that is a
WhatsApp conversation, which is what this whole feature is: the operator can
convert it themselves in a context where they know what they opened.

### Decompression and pixel bombs

sharp defaults `limitInputPixels` to `268402689` and the docs note it "Assumes
image dimensions contained in the input metadata can be trusted"; `unlimited`
defaults to `false`, and setting it true "removes safety features that prevent
memory exhaustion for JPEG, PNG, SVG, and HEIF formats"
(<https://sharp.pixelplumbing.com/api-constructor/>). Leave both at their
defaults, and additionally reject on explicit width and height ceilings read
from `metadata()`, because a 10 MB file that decodes to 200 megapixels is inside
neither the byte cap nor a useful design brief.

---

## 3. Serving it back safely

### The rule, from OWASP

"Store the files on a different host" is the first recommendation, "Store the
files outside the webroot, where only administrative access is allowed" the
second. For retrieval, "Use a handler that gets mapped to filenames inside the
application (someid -> file.ext)", never a path the user controls.
(<https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html>)

R2 satisfies "a different host" as long as the bucket is private and the shop
never proxies bytes without setting the headers itself.

### Content-Type

Never echo the browser's. OWASP: "The Content-Type for uploaded files is
provided by the user, and as such cannot be trusted, as it is trivial to spoof."
Migration 0012 already anticipated this in the `artwork_type` column comment:
"The content type WE determined by inspecting the bytes, never the one the
browser claimed."

Because the pipeline in section 2 re-encodes, `artwork_type` is not even an
observation about the customer's file. It is a statement about our encoder's
output, and it can only ever be `image/jpeg` or `image/png`. Serve that literal
value from a two-entry lookup, not from the database string, so a corrupted row
cannot become a header.

### X-Content-Type-Options

MDN on `nosniff`: "For requests with a destination of `script` or
`style`, the browser blocks the response if the MIME type doesn't match an
expected type (a JavaScript MIME type for scripts, or `text/css` for
stylesheets)." And: "For other response types, including navigations to a new
HTML document, the browser uses the supplied `Content-Type` as-is instead of
examining the content to infer the type."
(<https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options>)

MDN does not single out images. What the header buys us here is the second
clause: a response labelled `image/jpeg` will not be re-interpreted as HTML on
the strength of its contents. The shop already sends it globally from
`next.config.ts`, with a comment that names this exact case. Send it explicitly
on the artwork response too rather than inheriting it, so the guarantee does not
depend on a `source: "/:path*"` rule staying in place.

### Content-Disposition

MDN documents `inline` as the default and `attachment` as the download form,
with `filename` and `filename*`: "When both `filename` and `filename*` are
present in a single header field value, `filename*` is preferred over `filename`
when both are understood." The security guidance is to "Strip any path
information by replacing `/` with `_`", prefer ASCII, and "Do not overwrite
existing files when writing to disk."
(<https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition>)

Do not put the customer's filename in this header. Migration 0012 does not store
one, which is the correct decision, and it should stay that way. Build the
filename from `reference` and the extension, for example
`design-7QK4M2.jpg`. The workshop then gets a file named after the thing the
operator says on WhatsApp.

Could not verify: whether `Content-Disposition: attachment` prevents a browser
rendering the response in an `<img>` element. MDN describes the header in terms
of display and download, not subresource loading, and no primary source was
found that settles it. Do not build an admin preview that depends either way.
Serve two routes instead: an inline one for the preview and a download one with
`attachment`, both re-encoded, both `nosniff`.

### r2.dev, custom domain, or signed URL

**Not r2.dev.** Cloudflare is unambiguous: "Public access through `r2.dev`
subdomains is rate-limited and should only be used for development purposes",
and "To use features like WAF custom rules, caching, access controls, or Bot
Management, you must configure your bucket behind a custom domain."
(<https://developers.cloudflare.com/r2/buckets/public-buckets/>) There is also a
trap for anyone who enables it once and forgets: "Disable public access to your
r2.dev subdomain when using products like WAF or Cloudflare Access. If you do
not disable public access, your bucket will remain publicly available through
your r2.dev subdomain."

Public access of any kind is the wrong shape for this content regardless. A
public bucket means anyone who guesses or leaks a key can fetch a photograph of
a customer's child, forever, with no log tied to a person. The URL is the only
secret and it never expires.

**Recommended: private bucket, no public access at all, and an admin route
handler that fetches the object with a server side SigV4 GET and streams it
back.** This gives us:

- the admin session as the access control, which is the control we already have
- the ability to set every response header ourselves rather than hoping R2's
  stored metadata is right
- no CSP change, because the response comes from `'self'` and the existing
  `img-src 'self' data: blob: https://cbu01.alicdn.com https://*.supabase.co`
  already permits it
- an audit trail, since `src/lib/audit.ts` and the `admin_actions` table already
  exist

The alternative, a short-lived presigned GET on an R2 custom domain, is
defensible and Cloudflare supports expiries from "1 second to 7 days (604,800
seconds)". It costs a CSP change (`img-src` would need the custom domain host)
and it reintroduces the bearer-token property Cloudflare warns about. It buys
bandwidth savings this shop does not need at AED 15 a puzzle.

For the workshop, who may not have an admin login: generate a presigned GET at
the moment the operator sends it, with a short expiry, and record that it was
sent. Do not put a permanent public URL in a WhatsApp message that will outlive
the order by years.

### The response CSP for the artwork route

Add a route-specific `Content-Security-Policy: default-src 'none'; sandbox` on
the artwork responses. It costs nothing on an image response and it means that
if the content is ever something other than an image, it has no origin
privileges to abuse. This does not conflict with the global policy in
`next.config.ts`, because a route handler's own header wins for its own
response.

Note what `img-src` is and is not: MDN describes it as specifying "valid sources
of images and favicons"
(<https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/img-src>).
It governs where the admin page may load an image from. It does nothing about
what happens if the operator navigates directly to an artwork URL, which is the
SVG problem in section 2 and is why the answer there is "do not accept SVG",
not "constrain it with CSP".

---

## 4. EXIF and privacy

### What is in a phone photograph

GPS coordinates, capture timestamp, camera make and model, lens, and on many
devices a unique-enough combination to fingerprint the handset. For photographs
of children submitted by a stranger to a shop, the coordinates are the part that
matters: they are usually the family home.

### sharp strips it, by default, on re-encode

sharp is already installed at `node_modules/sharp`, version **0.35.3**, licence
**Apache-2.0** (read from `node_modules/sharp/package.json`). It arrives via
`next@16.3.0`, not via `package.json`. See section 7 for why that has to change.

The output documentation is explicit: "By default all metadata will be removed,
which includes EXIF-based orientation."
(<https://sharp.pixelplumbing.com/api-output/>) Keeping metadata is the thing
you have to opt into, through `keepExif()`, `keepIccProfile()`,
`keepMetadata()`, `withMetadata()` or `withExif()`. Do not call any of them.

The orientation clause is a real trap. Strip the EXIF Orientation tag from a
photograph taken in portrait and the image renders sideways. sharp's answer is
`autoOrient()`: "Auto-orient based on the EXIF `Orientation` tag, then remove the
tag", and "rotate() with no argument calls autoOrient() for backward
compatibility" (<https://sharp.pixelplumbing.com/api-operation/>). Call
`autoOrient()` before the encode so the rotation is baked into the pixels and
the tag goes away with everything else.

Could not verify: the sharp version in which `autoOrient()` was introduced. The
documentation does not state it. 0.35.3 is installed and documents the method,
so it is available here.

### Is re-encoding required, or can metadata be stripped losslessly

Both are possible. **Re-encoding is what this app should do**, and the reason is
not EXIF at all.

Losslessly: ExifTool does it. "for JPEG images, all APP segments (except Adobe
APP14, which is not removed by default) and trailers are removed which
effectively removes all metadata", and it does so without touching the
compressed image data (<https://exiftool.org/>, version 13.59, 27 May 2026).
That is a Perl program and an external binary in the container, not a Node
library, and adding it to a `node:22-alpine` image is a real cost.

Could not verify: the licence of a maintained pure-Node lossless JPEG metadata
stripper. ExifTool's own page has a licence section that the fetch did not
return the text of, and no Node wrapper was verified against a primary source.

The question is moot because section 2 already requires re-encoding: it is the
only step in the pipeline that actually guarantees the stored bytes are an image
and not a payload with an image-shaped prefix. Once you re-encode, metadata
removal is free and is the default. Lossless stripping would buy back a small
amount of image fidelity in exchange for giving up the one guarantee that
matters.

Resizing to a sane maximum dimension on the way through is worth doing at the
same time. The workshop is cutting a 3 mm MDF board, not printing a billboard.

### HEIC

The prebuilt sharp binaries support "JPEG, PNG, Ultra HDR, WebP, AVIF, TIFF, GIF
and SVG (input)". HEIF and HEIC are not in that list; supporting them requires
"a custom, globally-installed version of libvips"
(<https://sharp.pixelplumbing.com/install/>).

Could not verify: whether iOS Safari transcodes HEIC to JPEG when a photo is
chosen through `<input type="file">`. No primary source was found either way.
Assume it may not, detect HEIC by its `ftypheic` box, and return an error
message that tells the customer what to do rather than a generic failure. This
is the single most likely real-world rejection on a shop whose customers are on
phones.

---

## 5. Abuse and limits

### Size cap

Could not verify: a primary source giving typical phone photograph file sizes.
Any number here is an engineering judgement, so state it as one.

**10 MB is the recommendation**, chosen so that a 12 megapixel JPEG at high
quality passes comfortably while nothing that could plausibly be a photograph of
a child holding a toy gets anywhere near it. Enforce it at three places, because
each catches a different failure:

| Where | What it stops |
|---|---|
| `accept` and a client-side size check | honest mistakes, before the upload wastes anyone's time |
| the route handler's stream counter | everything, because it counts bytes actually read |
| Traefik `buffering.maxRequestBodyBytes` | bodies that should never reach Node at all |

The client-side check is a courtesy and nothing more. The stream counter is the
control. Do not rely on the `Content-Length` header alone, since the client
writes it.

Also cap decoded dimensions, per section 2. Bytes and pixels are different
attacks.

### Rate limiting an unauthenticated endpoint

`src/lib/rate-limit.ts` is in memory and its header states the consequence
plainly: "This Map is zeroed by every restart and deploy, so all nine public
limiters reset together."

That reset was judged acceptable for the existing limiters because what they
protect is a phone-number credential with a large search space. It is not
acceptable here, and the reason is different in kind. Those limiters protect
against guessing. This one protects against **accumulation**. Every request that
gets through leaves a persistent object in R2 and a row in Postgres, and a
deploy handing an attacker a fresh allowance means the damage is bounded by
deploy frequency rather than by the limit.

**Use the database, following the `login_attempts` pattern from migration
0006.** The design request endpoint should be limited per IP and per email
address, and the per-email limit is the more useful one, since IP rotation is
cheap and the operator has to read every row that lands.

Suggested shape, to be confirmed against real traffic: 3 submissions per IP per
hour, 10 per IP per day, 2 per email address per day. Combine with the honeypot
field pattern already used in `src/app/api/contact/route.ts`, which returns a
cheerful 200 so the bot does not learn it was caught.

Two things the limiter must not do:

- It must not bucket on the leftmost `x-forwarded-for` entry. `clientIp()` in
  `src/lib/rate-limit.ts` already gets this right and documents why at length.
  Reuse that function; do not write a second one.
- It must not count only successful submissions. Count the attempt, including
  rejected files, or an attacker gets unlimited free validation work out of us.

### R2 storage cost exposure

Current pricing (<https://developers.cloudflare.com/r2/pricing/>):

| Item | Standard | Free tier |
|---|---|---|
| Storage | $0.015 per GB-month | 10 GB-month per month |
| Class A operations, includes `PutObject` | $4.50 per million | 1 million per month |
| Class B operations, includes `GetObject` and `HeadObject` | $0.36 per million | 10 million per month |
| Egress | free | n/a |

Run the arithmetic before choosing the cap. At 10 MB per upload, the 10 GB free
storage tier is exhausted by **1,000 stored objects**. Above that it is $0.015
per GB-month, so 100 GB of accumulated artwork costs $1.50 a month. Class A is
not the exposure: a million uploads would be needed to leave the free tier on
operations, and the rate limiter makes that impossible long before storage does.

Egress being free is what makes it safe to serve artwork through the app rather
than caching it. It is also why a leaked public URL is unmetered, which is a
further argument for the private bucket in section 3.

The re-encode helps twice here. A 10 MB upload resized and re-encoded to a
sensible working size lands in R2 at a fraction of that, so the real storage
number is well under the cap, and the cap only ever bounds transient memory.

### Making abandoned uploads expire

Migration 0012 already provides the database half: `expires_at timestamptz NOT
NULL DEFAULT (now() + interval '90 days')`, an `expired` status, and a partial
index `design_requests_expiry_idx` over `(expires_at) WHERE artwork_key IS NOT
NULL AND status <> 'expired'`, which is exactly the query a sweep needs.

R2 provides the other half. Lifecycle rules can "delete objects after 90 days"
or on a specific date, are scoped by object prefix, are capped at 1,000 rules
per bucket, and "Objects will typically be removed from a bucket within 24 hours
of the `x-amz-expiration` value"
(<https://developers.cloudflare.com/r2/buckets/object-lifecycles/>). Deletes and
multipart aborts are free (<https://developers.cloudflare.com/r2/pricing/>).

**Use both, but do not let the lifecycle rule be the decision maker.** A
lifecycle rule knows only prefix and age. It cannot know that a request became
an order, and a blanket "delete after 90 days" would silently destroy the
artwork for work the workshop still has to cut.

The arrangement that works:

```
design-requests/pending/<uuid>.jpg     lifecycle: delete after 120 days
design-requests/approved/<uuid>.jpg    no lifecycle rule
```

The application copies the object from `pending/` to `approved/` when the
operator approves it, updates `artwork_key`, and clears `expires_at`. A nightly
sweep, following the `expires_at` index, deletes objects still under `pending/`
and sets `status = 'expired'`. The lifecycle rule is the backstop that catches
anything the sweep missed, which is why its window is longer than the database's
90 days rather than equal to it. If the sweep is broken for a month, the
photographs still go away.

One consequence to design for: `CopyObject` is a Class A operation, and the copy
plus the delete is two operations per approval. At this volume that is
irrelevant, but note it rather than discover it.

---

## 6. What not to do

**Do not trust the `Content-Type` the browser sends.** "The Content-Type for
uploaded files is provided by the user, and as such cannot be trusted, as it is
trivial to spoof."
(<https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html>)

**Do not validate by extension.** OWASP lists the bypasses: double extensions
like `.jpg.php`, null bytes like `.php%00.jpg`, and regexes that match anywhere
rather than at the end. It also insists that "the validation occurs after
decoding the filename". Same source.

**Do not treat a magic number check as sufficient.** "This should not be used on
its own, as bypassing it is pretty common and easy." Same source. `file-type`
says the same of itself: "a best-effort hint. It does not guarantee the file is
actually of that type."

**Do not store the customer's filename as the object key.** OWASP recommends
generating "random identifiers like UUIDs". Migration 0012 already uses
`gen_random_uuid()` for the row id and stores only `artwork_key`, so follow
through and derive the key from the uuid.

**Do not accept SVG for a logo.** MDN documents the SVG `<script>` element, and
documents that the image-context restrictions "don't apply when SVG content is
viewed directly, or when it's embedded as a document via the `<iframe>`,
`<object>`, or `<embed>` elements."
(<https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image>)

**Do not serve uploads from the shop's own origin without setting the headers
yourself.** OWASP's storage preference is "Store the files on a different host",
then "outside the webroot", and retrieval should go through "a handler that gets
mapped to filenames inside the application (someid -> file.ext)". Same source.

**Do not use the `r2.dev` URL in production.** "Public access through `r2.dev`
subdomains is rate-limited and should only be used for development purposes."
(<https://developers.cloudflare.com/r2/buckets/public-buckets/>)

**Do not treat a presigned URL as an access control.** "Treat presigned URLs as
bearer tokens. Anyone with the URL can perform the specified operation until it
expires."
(<https://developers.cloudflare.com/r2/api/s3/presigned-urls/>)

**Do not assume the framework caps the body.** Next's route handler reference
documents no limit and no configuration for one, and the self-hosting guide
assigns "payload size limits" to the reverse proxy
(<https://nextjs.org/docs/app/guides/self-hosting>). Traefik's
`maxRequestBodyBytes` defaults to `0`, unlimited
(<https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/buffering/>).
Nothing between Cloudflare's 100 MB and the Node process stops anything today.

**Do not call `sharp(...).keepMetadata()` or `withMetadata()` on customer
photographs.** sharp removes metadata by default
(<https://sharp.pixelplumbing.com/api-output/>); those methods put the GPS
coordinates back.

**Do not set `unlimited: true` on sharp.** It "removes safety features that
prevent memory exhaustion for JPEG, PNG, SVG, and HEIF formats"
(<https://sharp.pixelplumbing.com/api-constructor/>).

**Do not put a permanent artwork URL in a WhatsApp message.** It outlives the
order, the conversation and the customer's memory of consenting to it.

---

## 7. Recommended implementation for this app

### Prerequisites, before any route is written

Both of these are build breakers, not preferences.

1. **Add `sharp` to `package.json` dependencies at `^0.35.3`.** It is currently
   only an optional dependency of `next` (`package-lock.json` line 7647).
   Importing a transitive optional dependency from application code is fragile:
   it can be hoisted differently, and Next's output file tracing analyses
   "`import`, `require`, and `fs` usage" to decide what lands in
   `.next/standalone`
   (<https://nextjs.org/docs/app/api-reference/config/next-config-js/output>).
   That same page gives the pattern for native binaries, listing
   `'node_modules/sharp/**/*'` as a "common include pattern for native/runtime
   assets" in `outputFileTracingIncludes`. Add both, then verify the binary
   actually exists in the built image before deploying. `scripts/seal-standalone.mjs`
   exists because a missing module in the standalone output crash-looped the
   container for eleven minutes; its header is worth reading first.

2. **Add `aws4fetch` to `package.json` dependencies at `^1.0.20`** (MIT, no
   runtime dependencies, per <https://registry.npmjs.org/aws4fetch/latest>).
   The only copy in the tree today is `scripts/social/node_modules/aws4fetch`,
   which the app cannot reach.

3. Update the lockfile on Linux. `Dockerfile` warns that "A plain `npm install`
   on Windows drops those entries straight back out", and `npm run
   verify:lockfile` gates it.

### Environment

`LEBON_GRACE_R2_BUCKET` and the `R2_*` credentials already exist and are read by
`scripts/social/r2-upload.mjs`. Artwork must **not** go in `lebon-grace-media`.
That bucket is public and holds launch films. Create
`lebon-grace-artwork`, private, no public access, no `r2.dev` subdomain enabled.
The access keys are account scoped, so the same pair signs for both, which is
already noted in the upload script.

### Routes

**`POST /api/design-request`**, public, `runtime = "nodejs"`.

Validation order, and the order is the design:

| Step | Action | On failure |
|---|---|---|
| 1 | Database rate limit by IP via `clientIp()`, and by email | 429 with `Retry-After` |
| 2 | Honeypot field present | 200, no row, no object |
| 3 | `Content-Length` header over 10 MB | 413, body never read |
| 4 | Read `request.body` through a byte counter, abort past 10 MB | 413 |
| 5 | Validate the text fields: name, email via `isDeliverableEmail`, brief length | 400 |
| 6 | Insert the `design_requests` row with `artwork_key = NULL` | 500 |
| 7 | Magic number check on the first 12 bytes, JPEG PNG WebP GIF only | 400, row stays |
| 8 | `sharp(buf)` with default `failOn` and `limitInputPixels`, read `metadata()` | 400, row stays |
| 9 | Reject if `format` is not in the allowed set, or dimensions exceed the ceiling | 400, row stays |
| 10 | `.autoOrient().resize(max, max, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 })` | 500 |
| 11 | SigV4 PUT the re-encoded bytes to `design-requests/pending/<uuid>.jpg` | 500, row stays |
| 12 | Update the row with `artwork_key`, `artwork_type`, `artwork_bytes` | 500 |
| 13 | Email the operator, through `deliver()` in `src/lib/email.ts` | log, still 200 |

Step 6 before step 7 is deliberate and matches the migration's own comment:
"Nullable because a request row is created before the upload is confirmed: if
validation rejects the file, the row still records the attempt rather than
vanishing, which is what makes abuse visible." A rejection that leaves no trace
is a rejection nobody can rate-limit against.

Note what step 10 makes true. After it, the bytes in R2 are our encoder's
output. Every question in sections 2 and 4 is answered by that one step, and the
checks before it exist to make sure nothing expensive or exotic ever reaches it.

**`GET /api/admin/design-request/[id]/artwork`**, admin session required.

- Look up the row, get `artwork_key`.
- Signed GET to R2, server side.
- Stream back with, explicitly and not inherited:
  - `Content-Type`, from a two-entry literal lookup, never the database string
  - `Content-Disposition: inline; filename="design-<reference>.jpg"`
  - `X-Content-Type-Options: nosniff`
  - `Content-Security-Policy: default-src 'none'; sandbox`
  - `Cache-Control: private, no-store`
- Write an `admin_actions` row through `src/lib/audit.ts`.

**`GET /api/admin/design-request/[id]/artwork/download`**, same but
`Content-Disposition: attachment`. Two routes rather than a query parameter,
because a query parameter is one typo away from an attacker choosing which one
they get.

**`POST /api/admin/design-request/[id]/approve`**, admin session required. Copies
the object from `pending/` to `approved/`, updates `artwork_key`, sets `status =
'approved'`, clears the expiry pressure.

**The sweep.** A scheduled task, following `design_requests_expiry_idx`: for each
row past `expires_at` with an `artwork_key` still under `pending/`, delete the
object and set `status = 'expired'`. It must be idempotent, since the R2
lifecycle rule may have already removed the object.

### What the database stores

`0012_design_requests.sql` is already right about this. It stores a pointer, not
bytes: "WHERE THE FILE LIVES, not the file itself. The object key in R2, under a
PRIVATE prefix. Postgres is not a blob store."

Two additions worth considering, both optional:

- `artwork_sha256 text`. The hash of the stored bytes. Lets a duplicate
  submission be spotted, and lets the workshop confirm the file it received is
  the file that was approved.
- `artwork_rejected_reason text`. Rows created at step 6 that never get an
  `artwork_key` are currently indistinguishable from rows where the upload
  failed at step 11. The operator queue will want to tell those apart.

Note what is deliberately absent and should stay absent: the customer's original
filename, the browser-supplied Content-Type, and any EXIF. None of them are
useful and all three are liabilities.

### Security headers

Global, in `next.config.ts`: unchanged. `img-src 'self'` already permits the
admin preview, because the preview is served from `'self'`. **No CSP change is
required by this feature.** That is a direct consequence of choosing the
proxy-through-the-app option in section 3 over an R2 custom domain, and it is
worth stating in the commit message, because the alternative would have meant
adding a host to `img-src` for one admin page.

Per-response, on the two artwork routes: the four headers listed above, set
explicitly rather than inherited from the `source: "/:path*"` rule.

Infrastructure, at the Traefik layer: apply a `buffering` middleware with
`maxRequestBodyBytes` set to roughly 12 MB, giving the 10 MB cap headroom for
multipart boundaries and part headers, which the Next.js Server Actions
documentation estimates at 10 to 20 KB and which is worth over-providing.
Remember this also engages `memRequestBodyBytes`, default 1 MB, above which
Traefik buffers to disk
(<https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/buffering/>).

### What could not be verified, restated

- Whether the Next.js Node server enforces any internal request body cap. Not
  documented.
- Whether R2 rejects a presigned PUT whose Content-Length does not match a
  signed value. Not documented on either the presigned URL page or the S3 API
  compatibility page.
- Whether R2 honours `response-content-disposition` or `response-content-type`
  query parameters on GET. Not mentioned on the download or S3 API pages.
- How `X-Amz-Expires` is set with `aws4fetch`. The README documents `signQuery`
  but shows no presigned URL example.
- Whether `Content-Disposition: attachment` prevents rendering in an `<img>`
  element. Not addressed by MDN.
- Which sharp version introduced `autoOrient()`. Not stated in the docs. It
  exists in the installed 0.35.3.
- Whether iOS Safari transcodes HEIC to JPEG on `<input type="file">`. No
  primary source found.
- Typical phone photograph file sizes. No primary source. The 10 MB cap is an
  engineering judgement.
- The exact text of ExifTool's licence. The licence section was not returned by
  the fetch.

---

## Sources

Next.js
- <https://nextjs.org/docs/app/api-reference/file-conventions/route> (v16.3.1)
- <https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions> (v16.3.1)
- <https://nextjs.org/docs/app/api-reference/config/next-config-js/output> (v16.3.1)
- <https://nextjs.org/docs/app/guides/self-hosting> (v16.3.1)

Cloudflare
- <https://developers.cloudflare.com/r2/api/s3/presigned-urls/>
- <https://developers.cloudflare.com/r2/api/s3/api/>
- <https://developers.cloudflare.com/r2/buckets/public-buckets/>
- <https://developers.cloudflare.com/r2/buckets/cors/>
- <https://developers.cloudflare.com/r2/buckets/object-lifecycles/>
- <https://developers.cloudflare.com/r2/objects/download-objects/>
- <https://developers.cloudflare.com/r2/pricing/>
- <https://developers.cloudflare.com/workers/platform/limits/>

OWASP
- <https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html>

MDN
- <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options>
- <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition>
- <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/img-src>
- <https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image>
- <https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/script>

Libraries and infrastructure
- <https://sharp.pixelplumbing.com/api-constructor/>
- <https://sharp.pixelplumbing.com/api-output/>
- <https://sharp.pixelplumbing.com/api-operation/>
- <https://sharp.pixelplumbing.com/install/>
- <https://github.com/sindresorhus/file-type>
- <https://registry.npmjs.org/file-type/latest>
- <https://github.com/mhart/aws4fetch>
- <https://registry.npmjs.org/aws4fetch/latest>
- <https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/buffering/>
- <https://caddyserver.com/docs/caddyfile/directives/request_body>
- <https://exiftool.org/>
- <https://vercel.com/docs/functions/limitations>

Repository, read at the working tree on 2026-08-19
- `package.json`, `package-lock.json` line 7647
- `node_modules/sharp/package.json` (0.35.3, Apache-2.0)
- `next.config.ts`
- `Dockerfile` (node:22-alpine)
- `src/lib/rate-limit.ts`
- `src/app/api/contact/route.ts`
- `scripts/social/r2-upload.mjs`
- `scripts/seal-standalone.mjs`
- `supabase/migrations/0012_design_requests.sql`
- `supabase/migrations/0006_login_attempts.sql`
- `DEPLOYMENT-GUIDE.md` line 14
