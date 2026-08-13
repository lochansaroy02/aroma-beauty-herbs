import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";

import { ContactForm } from "@/components/shop/contact-form";

export const metadata = {
  title: "Contact — Aroma Beauty Herbs",
  description:
    "Questions about an order, an ingredient, or stocking us? Send a message and we'll reply within two working days.",
};

/**
 * Details sit beside the form rather than under it: half the people who land
 * here want an address or a phone number and would rather not fill anything in.
 */
const DETAILS = [
  {
    icon: MailIcon,
    label: "Email",
    value: "hello@aromabeautyherbs.com",
    href: "mailto:hello@aromabeautyherbs.com",
  },
  {
    icon: PhoneIcon,
    label: "Phone",
    value: "+91 70173 08109",
    href: "tel:+917017308109",
  },
  {
    icon: MapPinIcon,
    label: "Where we are",
    value: "Bawana, Delhi, India",
    href: null,
  },
  {
    icon: ClockIcon,
    label: "Replies",
    value: "Within two working days",
    href: null,
  },
] as const;

export default function ContactPage() {
  return (
    <div className="bg-paper">
      <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 lg:py-28">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] tracking-[0.22em] text-clay uppercase">
            Contact
          </p>
          <h1
            className="mt-6 font-heading text-[clamp(2.25rem,6vw,4rem)] leading-[1.02] text-ink text-balance"
            style={{ fontVariationSettings: '"SOFT" 55, "WONK" 1, "opsz" 120' }}
          >
            Tell us what you need
          </h1>
          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-soft text-pretty">
            An order that hasn&rsquo;t arrived, an ingredient you&rsquo;re unsure about, or a
            shop that wants to stock us — it all comes to the same inbox, and a
            person reads it.
          </p>
        </div>

        <div className="mt-14 grid gap-12 lg:mt-20 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
          <div>
            <ul className="grid gap-8">
              {DETAILS.map((detail) => (
                <li key={detail.label} className="flex gap-4">
                  <detail.icon
                    className="mt-0.5 size-4.5 shrink-0 text-leaf"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <div>
                    <p className="font-mono text-[11px] tracking-[0.18em] text-clay uppercase">
                      {detail.label}
                    </p>
                    {detail.href ? (
                      <a
                        href={detail.href}
                        className="mt-1.5 block text-[15px] text-ink underline-offset-4 hover:underline"
                      >
                        {detail.value}
                      </a>
                    ) : (
                      <p className="mt-1.5 text-[15px] text-ink">{detail.value}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-12 border-t border-ink/10 pt-8">
              <p className="font-mono text-[11px] tracking-[0.18em] text-clay uppercase">
                Before you write
              </p>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
                Tracking, returns and patch-testing are covered in the{" "}
                <Link href="/faqs" className="text-ink underline underline-offset-4">
                  FAQs
                </Link>
                . For an existing order, quoting the order number gets you a faster
                answer — you&rsquo;ll find it under{" "}
                <Link href="/orders" className="text-ink underline underline-offset-4">
                  your orders
                </Link>
                .
              </p>
            </div>
          </div>

          <ContactForm />
        </div>
      </div>
    </div>
  );
}
