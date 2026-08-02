"use client";

import { useState } from "react";
import Link from "next/link";

export default function UnsubscribeClient() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const r = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) {
        const { error } = await r.json().catch(() => ({ error: "" }));
        setError(error || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="max-w-md mx-auto px-4 py-20 text-center">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Unsubscribe</h1>
      {done ? (
        <>
          <p className="mt-4 text-gray-500 text-sm">
            That address has been removed from our mailing list. It can take a moment to
            take effect, and you can subscribe again any time.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center px-6 py-3 bg-[#16A34A] text-white text-sm font-semibold rounded-lg hover:bg-[#15803D] transition-colors"
          >
            Back to Home
          </Link>
        </>
      ) : (
        <>
          <p className="mt-3 text-gray-500 text-sm">
            Enter the address you subscribed with and we will remove it. This does not
            affect emails about orders you have placed.
          </p>
          <form onSubmit={submit} className="mt-8 flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] outline-none"
            />
            <button
              type="submit"
              disabled={sending}
              className="px-6 py-3 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              {sending ? "Removing…" : "Unsubscribe"}
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </>
      )}
    </section>
  );
}
