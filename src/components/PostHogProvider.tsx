"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, useState } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!POSTHOG_KEY || POSTHOG_KEY === "phc_..." || POSTHOG_KEY === "") {
      // PostHog not configured — pass through silently
      setReady(true);
      return;
    }

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false, // we handle pageviews manually via route changes
      capture_pageleave: true,
      person_profiles: "identified_only", // only create profiles for identified users
      loaded: () => {
        // Respect "Do Not Track"
        if (window.navigator.doNotTrack === "1") {
          posthog.opt_out_capturing();
        }
        setReady(true);
      },
    });
  }, []);

  // Always render children — PostHog is additive, not blocking
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
