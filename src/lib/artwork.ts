import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

/**
 * Turn an untrusted upload into something safe to store.
 *
 * A customer sends a photo of their child or a logo, and we have to put it
 * somewhere the workshop can look at it later. Everything here exists because
 * that file arrives from the public internet with no authentication in front of
 * it.
 *
 * THE RE-ENCODE IS THE GUARANTEE, not the signature check.
 *
 * It is tempting to read the magic bytes, see that they say JPEG, and store the
 * file. `file-type` says plainly in its own README that it is a best-effort
 * hint, and OWASP says signature checks must not stand alone: a valid JPEG
 * header can sit in front of anything. What actually removes an injected
 * payload is decoding the pixels and writing a new file from them, which is
 * OWASP's "image rewriting" advice. Nothing of the original bytes survives.
 *
 * So the order below is deliberate and each step is cheap-before-expensive:
 *
 *   1. size, before anything is parsed
 *   2. magic bytes, to reject obvious rubbish without spending a decode
 *   3. decode and re-encode, which is the actual safety property
 *
 * SVG IS REJECTED, and not because it is hard to handle. An SVG can carry a
 * `<script>` element, and the restrictions that neuter it in an `<img>` do not
 * apply when the file is viewed directly, which is exactly what an operator
 * does when they click a link to see the artwork. A logo is not worth that.
 */

/**
 * 10 MB. A modern phone photo is 3 to 8 MB, so this accepts real submissions
 * while bounding what one request can cost us.
 *
 * Enforced HERE as well as at the route and the proxy. Three layers because
 * this is the only one that sees the actual buffer: a chunked upload can lie
 * about Content-Length, and Next 16 route handlers document no body limit of
 * their own.
 */
export const MAX_ARTWORK_BYTES = 10 * 1024 * 1024;

/**
 * What we accept, by what the BYTES say, never by filename or the browser's
 * Content-Type. Both of those are attacker-controlled.
 *
 * HEIC is absent on purpose: the prebuilt sharp binaries cannot decode it. An
 * iPhone may or may not transcode to JPEG on upload depending on how the file
 * is chosen, so a HEIC arrival is possible and must fail cleanly here rather
 * than throw somewhere less obvious.
 */
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ArtworkResult =
  | { ok: true; buffer: Buffer; contentType: "image/jpeg"; bytes: number; width: number; height: number }
  | { ok: false; reason: ArtworkRejection };

export type ArtworkRejection =
  | "empty"
  | "too-large"
  | "unrecognised"
  | "unsupported-type"
  | "not-an-image";

/** Messages safe to show a customer. Deliberately vague about internals. */
export const REJECTION_MESSAGE: Record<ArtworkRejection, string> = {
  empty: "That file looked empty. Please choose the artwork again.",
  "too-large": "That file is over 10 MB. A photo from your phone should be well under it.",
  unrecognised: "We could not read that file. Please send a JPEG, PNG or WebP.",
  "unsupported-type": "Please send a JPEG, PNG or WebP. We cannot accept PDFs, SVGs or HEIC.",
  "not-an-image": "That file is not an image we can open. Please try another.",
};

/**
 * Validate and sanitise. Returns a NEW buffer, never the caller's.
 *
 * Always returns JPEG. One output format means the viewer, the storage key and
 * the Content-Type header all stop being variables, and a customer sending a
 * PNG logo loses nothing that matters at engraving resolution.
 */
export async function sanitiseArtwork(input: Buffer): Promise<ArtworkResult> {
  if (input.length === 0) return { ok: false, reason: "empty" };
  if (input.length > MAX_ARTWORK_BYTES) return { ok: false, reason: "too-large" };

  // Cheap gate. Rejects an HTML file renamed to .jpg before we ask a decoder to
  // look at it. Not the guarantee, just the doorman.
  const sniffed = await fileTypeFromBuffer(input);
  if (!sniffed) return { ok: false, reason: "unrecognised" };
  if (!ACCEPTED.has(sniffed.mime)) return { ok: false, reason: "unsupported-type" };

  try {
    /*
     * autoOrient() BEFORE the metadata is dropped.
     *
     * sharp removes all metadata by default, and EXIF orientation is metadata.
     * Strip first and a photo taken in portrait arrives sideways, which looks
     * like a bug in the viewer rather than a missing call here. Applying the
     * rotation bakes it into the pixels, so the image stays upright once the
     * tag is gone.
     *
     * Dropping EXIF is not cosmetic. These are photographs of children, and
     * EXIF routinely carries GPS coordinates and a device serial.
     */
    const pipeline = sharp(input, { failOn: "error" }).autoOrient();

    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height) return { ok: false, reason: "not-an-image" };

    const buffer = await pipeline
      // Engraving does not need more than this, and it bounds what we store.
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    const out = await sharp(buffer).metadata();

    return {
      ok: true,
      buffer,
      contentType: "image/jpeg",
      bytes: buffer.length,
      width: out.width ?? meta.width,
      height: out.height ?? meta.height,
    };
  } catch {
    // A file that passed the signature check but will not decode. Malformed,
    // truncated, or a header glued to something else.
    return { ok: false, reason: "not-an-image" };
  }
}
