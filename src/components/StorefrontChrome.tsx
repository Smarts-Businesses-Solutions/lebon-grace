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
export default function StorefrontChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <>{children}</>;
}
