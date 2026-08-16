import { NextResponse } from 'next/server';

// Build provenance: answers "which commit is actually running here?" without
// needing shell access to the container.
//
// The shape mirrors axiom_synapse's and trustmetrics' /api/health/version
// ({ sha, service, timestamp }) so ONE checker can read every app in the estate,
// and so a deploy can be verified against the commit it claims to ship rather
// than against a green build log.
//
// GIT_COMMIT_SHA is baked into the RUNNER stage of the Dockerfile. ARG is
// per-stage: declared only in the builder it exists during `next build` and is
// gone at runtime, which is exactly how an image becomes unidentifiable.
// It reads "unknown" when a build did not pass one -- a meaningful answer, not a
// failure: it means that image cannot be traced to a commit.

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    sha: process.env.GIT_COMMIT_SHA || 'unknown',
    service: 'lebon-grace',
    timestamp: new Date().toISOString(),
  });
}
