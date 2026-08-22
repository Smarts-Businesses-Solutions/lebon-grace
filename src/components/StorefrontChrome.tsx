"use client";

import { usePathname } from "next/navigation";

/**
 * Keeps the shop's header and footer off the admin.
 *
 * /admin sits under the root layout, so it inherited the storefront chrome: the
 * LEBON GRACE wordmark, "Search puzzles", a cart icon and the customer nav,
 * stacked above the admin's own bar. Two headers, two identities, and a cart
 * button on a page where nobody is shopping.
 *
 * Done as a gate rather than a route group because moving /admin into
 * (admin)/ would change its URL segment handling and touch every link to it.
 * This keeps the change to one component and the layout line that uses it.
 *
 * Children are passed through rather than imported here, so Footer stays a
 * server component and is not dragged into the client bundle by this file.
 */
/*
 * /links joins /admin for a different reason.
 *
 * It is the single URL a social bio points at, and its whole job is to be four
 * obvious choices on a phone in one screen. Wrapping that in the shop's
 * header, search bar, cart icon and full footer turns it back into the shop
 * with extra steps, which is the thing the page exists to avoid.
 */
const NO_CHROME = ["/admin", "/links"];

export default function StorefrontChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (NO_CHROME.some((p) => pathname?.startsWith(p))) return null;
  return <>{children}</>;
}
