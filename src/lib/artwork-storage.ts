import { AwsClient } from "aws4fetch";
import { randomUUID } from "node:crypto";

/**
 * Where customer artwork lives, and how it comes back out.
 *
 * A SEPARATE BUCKET FROM THE LAUNCH MEDIA, and that is the whole design.
 * `lebon-grace-media` has R2's public development URL switched on, so anything
 * stored there is readable by anyone who guesses the key. A prefix inside it
 * would not be private, it would just be undocumented.
 *
 * `lebon-grace-artwork` has no public domain and must never be given one.
 * Verified on creation: an anonymous GET against its r2.dev name answers 401,
 * where the launch bucket answers 200. It holds photographs customers send of
 * their children.
 *
 * So every read goes through a short-lived signed URL, minted server side, by
 * an admin route that has already checked the session. There is no path from
 * the public internet to these bytes that does not pass through our own auth.
 *
 * aws4fetch rather than the AWS SDK: this needs SigV4 and nothing else, and it
 * is kilobytes against tens of megabytes. Same choice as scripts/social.
 */

/** Keys live under this prefix so a lifecycle rule can target them later. */
const PENDING_PREFIX = "pending";

function client() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.LEBON_GRACE_R2_ARTWORK_BUCKET;

  // Fail loudly and early. A half-configured uploader that accepts a file and
  // silently drops it is worse than one that refuses to start.
  if (!accessKeyId || !secretAccessKey || !accountId || !bucket) {
    throw new Error(
      "artwork storage is not configured: needs R2_ACCESS_KEY_ID, " +
        "R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID and LEBON_GRACE_R2_ARTWORK_BUCKET",
    );
  }

  return {
    aws: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" }),
    base: `https://${accountId}.r2.cloudflarestorage.com/${bucket}`,
  };
}

/**
 * Build the object key for a request's artwork.
 *
 * The random segment matters. Keying on the design request's reference alone
 * would make every object name guessable from a reference someone saw over a
 * shoulder, and while the bucket is private, defence in depth costs nothing
 * here. Always .jpg because sanitiseArtwork only ever emits JPEG.
 */
export function artworkKey(reference: string): string {
  return `${PENDING_PREFIX}/${reference}/${randomUUID()}.jpg`;
}

/**
 * Store sanitised bytes. Only ever called with the output of sanitiseArtwork,
 * never with what arrived on the request.
 */
export async function putArtwork(key: string, body: Buffer, contentType: string): Promise<void> {
  const { aws, base } = client();

  const res = await aws.fetch(`${base}/${key}`, {
    method: "PUT",
    // One copy into a standalone ArrayBuffer. Buffer is a Uint8Array subclass,
    // but its type carries ArrayBufferLike and BodyInit will not take that, so
    // neither Buffer nor a Uint8Array view type-checks. A cast would silence
    // the compiler without answering it. The copy is bounded by
    // MAX_ARTWORK_BYTES, so 10 MB worst case, once, on a route that has already
    // decoded and re-encoded the same image.
    body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
    headers: {
      "Content-Type": contentType,
      // Belt and braces. The bucket is private, but if it were ever exposed by
      // mistake this stops a browser being talked into rendering the object as
      // anything other than the image type we decided it is.
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=0, no-store",
    },
  });

  if (!res.ok) {
    // Body may carry the customer's filename; keep it out of logs.
    throw new Error(`artwork upload failed: ${res.status}`);
  }
}

/**
 * A short-lived signed GET, for the admin viewer only.
 *
 * Sixty seconds by default. The operator's browser follows it immediately, so a
 * longer window only widens what a leaked URL is worth. It is a bearer
 * credential in a query string: it will end up in history and possibly a
 * referrer, so it should expire before either matters.
 */
export async function signedArtworkUrl(key: string, expiresInSeconds = 60): Promise<string> {
  const { aws, base } = client();

  const signed = await aws.sign(
    new Request(`${base}/${key}?X-Amz-Expires=${expiresInSeconds}`),
    { aws: { signQuery: true } },
  );

  return signed.url;
}

/**
 * Remove an object. Used by the expiry sweep and when a request is declined.
 *
 * Treats a 404 as success: the caller wants the object gone, and it is. A sweep
 * that throws on an already-deleted key would stall on its first retry.
 */
export async function deleteArtwork(key: string): Promise<void> {
  const { aws, base } = client();
  const res = await aws.fetch(`${base}/${key}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`artwork delete failed: ${res.status}`);
  }
}
