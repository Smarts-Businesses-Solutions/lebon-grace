import type { Metadata } from "next";
import Link from "next/link";
import CustomClient from "./CustomClient";

/**
 * /custom — send us a photo or a logo.
 *
 * A dedicated page rather than a field on the contact form. The flow has its
 * own steps and its own promise, and a contact form should not be the place a
 * customer hands over a photograph of their child without being told what
 * happens to it.
 *
 * The copy leads with the price staying the same, because that is the question
 * anyone asks first and the answer is unusual: no UAE competitor offers
 * personalisation at all, let alone free.
 */
export const metadata: Metadata = {
  title: "Custom photo and logo engraving | Lebon Grace",
  description:
    "Send us a photo or a logo and we will engrave it, free, on a hand-cut raw MDF puzzle. " +
    "Still AED 15. We agree the design with you before anything is cut.",
  alternates: { canonical: "/custom" },
};

export default function CustomPage() {
  return (
    <>
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
            Send us a photo or a logo
          </h1>
          <p className="mt-2 text-gray-300 text-sm lg:text-base max-w-2xl">
            We will engrave it free, on the same AED 15 board as everything else.
            Nothing is cut until you have seen the design and said yes.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <CustomClient />
          </div>

          <aside className="space-y-8">
            {/*
              How it works, stated before they upload rather than after. The
              approval step is the reason this page exists instead of a field at
              checkout, so it is the thing to be clearest about.
            */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                How it works
              </h2>
              <ol className="mt-4 space-y-4 text-sm text-gray-600">
                <li>
                  <strong className="text-[#23201C]">1. You send the artwork.</strong> A photo, a
                  logo, a drawing. Nothing is charged.
                </li>
                <li>
                  <strong className="text-[#23201C]">2. We talk it through.</strong> We come back to
                  you, usually on WhatsApp, and agree what the piece will look like.
                </li>
                <li>
                  <strong className="text-[#23201C]">3. You approve it.</strong> Only then does
                  anything get cut.
                </li>
                <li>
                  <strong className="text-[#23201C]">4. You order normally.</strong> AED 15, the same
                  as every other piece in the shop.
                </li>
              </ol>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                What engraves well
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>Clear, well-lit photographs with a simple background.</li>
                <li>Logos with solid shapes rather than fine gradients.</li>
                <li>Faces work, but close up rather than a full scene.</li>
              </ul>
              <p className="mt-4 text-sm text-gray-600">
                If it will not engrave well we will tell you before you spend anything, and suggest
                what would.
              </p>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Your photo
              </h2>
              {/*
                Said plainly because customers upload pictures of their children.
                Every claim here is enforced in code: EXIF stripping in
                artwork.ts, a private bucket in artwork-storage.ts, and the 90
                day expiry in migration 0012. Do not soften this copy without
                changing those.
              */}
              <p className="mt-4 text-sm text-gray-600">
                We strip the location and camera data before storing it, keep it somewhere only we
                can open, and delete it after 90 days if the piece is never made. It is never used
                for anything else.
              </p>
            </div>

            <div className="pt-2">
              <Link href="/faq" className="text-sm underline text-[#23201C] hover:text-[#A8874D]">
                More questions
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
