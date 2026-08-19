"use client";

import { useState } from "react";
import Link from "next/link";
import ContactInfo from "@/components/ContactInfo";

export default function ContactClient() {
  // Honeypot. Hidden from people, filled in by most naive bots. The API
  // silently accepts and discards anything that arrives with it set.
  const [honeypot, setHoneypot] = useState("");

  const [form, setForm] = useState({
    name: "", email: "", phone: "+971 ", subject: "General Inquiry", message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const ne: Record<string, string> = {};
    if (!form.name.trim()) ne.name = "Name is required";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) ne.email = "Valid email required";
    if (!form.message.trim() || form.message.trim().length < 10) ne.message = "Message must be at least 10 characters";
    return ne;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ne = validate();
    if (Object.keys(ne).length > 0) { setErrors(ne); return; }
    setSending(true);
    // Actually send it. This used to be a setTimeout that showed "sent" while
    // discarding the message, so every enquiry was silently lost.
    (async () => {
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, website: honeypot }),
        });
        if (res.ok) setSent(true);
        else {
          const d = await res.json().catch(() => ({}));
          setErrors({ form: d.error || "Could not send. Please try again." });
        }
      } catch {
        setErrors({ form: "Could not send. Please check your connection." });
      } finally {
        setSending(false);
      }
    })();
  };

  if (sent) {
    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-[#23201C]/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#A8874D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Message Sent</h1>
        <p className="mt-4 text-gray-500 text-sm max-w-md mx-auto">
          Thank you for reaching out. We typically respond within 24 hours during business days (Monday to Saturday).
        </p>
        <Link href="/" className="mt-8 inline-flex items-center px-6 py-3 bg-[#23201C] text-white text-sm font-semibold rounded-lg hover:bg-[#A8874D] transition-colors">
          Back to Home
        </Link>
      </section>
    );
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Contact Us</h1>
          <p className="mt-2 text-gray-300 text-sm lg:text-base">Have a question, feedback, or need help with an order? We&apos;re here for you.</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-5">
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute left-[-9999px] w-px h-px opacity-0"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs text-gray-600 tracking-wide mb-1.5">Full Name *</label>
                  <input type="text" name="name" value={form.name} onChange={handleChange}
                    className="scroll-mt-20 w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-[#A8874D] focus:ring-2 focus:ring-[#A8874D]/20 outline-none transition-all" placeholder="Your name" />
                  {errors.name && <p className="mt-1 text-red-500 text-xs">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-600 tracking-wide mb-1.5">Email Address *</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange}
                    className="scroll-mt-20 w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-[#A8874D] focus:ring-2 focus:ring-[#A8874D]/20 outline-none transition-all" placeholder="you@example.com" />
                  {errors.email && <p className="mt-1 text-red-500 text-xs">{errors.email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs text-gray-600 tracking-wide mb-1.5">Phone Number</label>
                  <input type="tel" name="phone" value={form.phone} onChange={handleChange}
                    className="scroll-mt-20 w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-[#A8874D] focus:ring-2 focus:ring-[#A8874D]/20 outline-none transition-all" placeholder="+971 5X XXX XXXX" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 tracking-wide mb-1.5">Subject</label>
                  <select aria-label="What is your message about?" name="subject" value={form.subject} onChange={handleChange}
                    className="scroll-mt-20 w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-[#A8874D] focus:ring-2 focus:ring-[#A8874D]/20 outline-none transition-all cursor-pointer">
                    <option>General Inquiry</option>
                    <option>Order Issue</option>
                    <option>Product Question</option>
                    <option>Shipping & Delivery</option>
                    <option>Returns & Refunds</option>
                    <option>Partnership / Wholesale</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 tracking-wide mb-1.5">Message *</label>
                <textarea name="message" value={form.message} onChange={handleChange} rows={6}
                  className="scroll-mt-20 w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-[#A8874D] focus:ring-2 focus:ring-[#A8874D]/20 outline-none transition-all resize-none" placeholder="Tell us how we can help..." />
                {errors.message && <p className="mt-1 text-red-500 text-xs">{errors.message}</p>}
              </div>

              {/* A failed send must say so. The old form always claimed
                  success, so nobody ever knew a message had not arrived. */}
              {errors.form && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                  {errors.form}
                </p>
              )}
              <button type="submit" disabled={sending}
                className="px-8 py-3.5 bg-[#23201C] text-white text-sm font-semibold rounded-xl hover:bg-[#A8874D] transition-colors disabled:opacity-60">
                {sending ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>

          {/* Contact Info Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
              <h3 className="text-lg font-semibold tracking-tight">Get in Touch</h3>

              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#23201C]/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#A8874D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <div>
                    {/* This used to link to /contact from /contact. */}
                    <p className="text-sm font-medium text-gray-900">Email</p>
                    <p className="text-sm text-gray-500">Use the form on this page</p>
                    <p className="text-xs text-ink-muted mt-0.5">We reply to the address you give us</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.941 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.67-.167-.67-.167h-.57c-.197 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.273-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.904-9.884 2.605 0 5.06 1.023 6.9 2.863a9.835 9.835 0 012.863 6.914c-.003 5.45-4.437 9.884-9.89 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.924c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.926 0-.026 0-.055 0-.083A11.942 11.942 0 0021.85 5.737" />
                    </svg>
                  </div>
                  <div>
                    {/* The label said "Click to reveal (bot-protected)" above a
                        static paragraph, so there was nothing to click. ContactInfo
                        does the actual reveal against /api/contact/reveal. */}
                    <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                    <ContactInfo />
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Address</p>
                    <p className="text-sm text-gray-500">Sharjah Media City<br />Al Messaned, Al Bataeh<br />Sharjah, UAE</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Business Hours</p>
                    <p className="text-sm text-gray-500">Monday to Saturday<br />9:00 AM to 6:00 PM (GST)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
