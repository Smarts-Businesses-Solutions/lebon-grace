"use client";

import { useState, useRef } from "react";
import Link from "next/link";

/**
 * The custom design request form.
 *
 * This page sells a conversation, not a product. Nothing is charged here and no
 * order is created: the customer sends artwork, we agree the design together,
 * and only then do they check out at the ordinary AED 15.
 *
 * Saying that plainly at the top is the whole job of the copy. A form that
 * takes a photograph of someone's child without explaining what happens next
 * reads as either a purchase or a data grab, and it is neither.
 */

const MAX_BYTES = 10 * 1024 * 1024;

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; reference: string; message: string }
  | { kind: "error"; message: string };

export default function CustomClient() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    // Checked here as well as on the server. This one is only a courtesy: it
    // saves the customer a slow upload on a phone connection before being told
    // no. The server does not trust it.
    const file = data.get("artwork");
    if (file instanceof File && file.size > MAX_BYTES) {
      setState({
        kind: "error",
        message: "That file is over 10 MB. A photo from your phone should be well under it.",
      });
      return;
    }

    setState({ kind: "sending" });

    try {
      const res = await fetch("/api/custom", { method: "POST", body: data });
      const body = await res.json();

      if (!res.ok) {
        setState({ kind: "error", message: body.error ?? "Something went wrong. Please try again." });
        return;
      }

      setState({ kind: "sent", reference: body.reference, message: body.message });
      form.reset();
      setFileName(null);
    } catch {
      setState({
        kind: "error",
        message: "We could not reach the shop. Please check your connection and try again.",
      });
    }
  }

  if (state.kind === "sent") {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-[#23201C]/10 flex items-center justify-center">
          <span className="text-2xl">🪵</span>
        </div>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight">Artwork received</h2>
        <p className="mt-4 text-gray-600 text-sm max-w-md mx-auto">{state.message}</p>

        {/*
          The reference is the handle for the whole conversation. It goes on
          screen large enough to photograph, because that is what people
          actually do, and it is repeated in nothing else they have yet.
        */}
        <p className="mt-8 text-xs uppercase tracking-[0.18em] text-gray-500">Your reference</p>
        <p className="mt-1 text-2xl font-mono tracking-wider text-[#23201C]">{state.reference}</p>
        <p className="mt-4 text-xs text-gray-500 max-w-sm mx-auto">
          Quote this if you message us. We will come back to you on the email you gave.
        </p>

        <Link
          href="/shop"
          className="mt-10 inline-block px-6 py-3 bg-[#23201C] text-white text-sm font-semibold rounded-xl hover:bg-[#A8874D] transition-colors"
        >
          Have a look at the shop
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
      {/*
        Hidden from people, irresistible to bots. The server answers a filled
        one with a cheerful 200 and writes nothing, so the bot does not learn it
        was caught. Same trick as the contact form.
      */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-600">Your name</span>
          <input
            name="name"
            required
            maxLength={120}
            className="mt-2 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#A8874D]"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-600">Email</span>
          <input
            name="email"
            type="email"
            required
            className="mt-2 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#A8874D]"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-600">
          WhatsApp number <span className="normal-case font-normal text-gray-400">(optional, it is the fastest way)</span>
        </span>
        <input
          name="phone"
          type="tel"
          className="mt-2 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#A8874D]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-600">
          What would you like made?
        </span>
        <textarea
          name="brief"
          required
          rows={4}
          maxLength={2000}
          placeholder="A name, an age, the shape you have in mind. Anything that helps us picture it."
          className="mt-2 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#A8874D]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-600">
          Your photo or logo
        </span>
        <input
          name="artwork"
          type="file"
          required
          // JPEG, PNG and WebP only. The server decides by decoding the bytes,
          // never by this attribute or the filename, but narrowing the picker
          // saves a customer choosing a HEIC or a PDF and being refused.
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="mt-2 w-full text-sm text-gray-600 file:mr-4 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-[#23201C]/5 file:text-[#23201C] file:text-sm file:font-medium"
        />
        <span className="mt-2 block text-xs text-gray-500">
          JPEG, PNG or WebP, up to 10 MB. {fileName ? `Chosen: ${fileName}` : "A clear, well-lit photo engraves best."}
        </span>
      </label>

      {state.kind === "error" && (
        <p className="text-sm text-[#A4553F] bg-[#A4553F]/5 border border-[#A4553F]/30 rounded-xl px-4 py-3">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={state.kind === "sending"}
        className="w-full py-3.5 bg-[#23201C] text-white text-sm font-semibold rounded-xl hover:bg-[#A8874D] transition-colors disabled:opacity-60"
      >
        {state.kind === "sending" ? "Sending your artwork…" : "Send it over"}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Nothing is charged now. We will agree the design with you first.
      </p>
    </form>
  );
}
