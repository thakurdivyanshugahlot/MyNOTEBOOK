"use client";

import Link from "next/link";
import { useInView } from "@/hooks/useInView";

const SOURCE_CARDS = [
  { label: "lecture-04.pdf", tag: "p.76", rotate: "-rotate-6", delay: "0s" },
  { label: "subtitles.vtt", tag: "12:04", rotate: "rotate-3", delay: "0.4s" },
  { label: "roadmap.com", tag: "web", rotate: "-rotate-2", delay: "0.8s" },
];

const STEPS = [ 
  { 
    title: "Add your sources",
    body: "Drop in a PDF, a lecture's subtitles, or just paste a link. Nothing leaves your notebook.",
  },
  {
    title: "Ask, in your own words",
    body: "Typos and vague questions are fine — it rewrites, breaks down, and searches for you behind the scenes.",
  },
  {
    title: "Get an answer with a page number",
    body: "Not just an answer — a citation. Click it and see the exact page or timestamp it came from.",
  },
];

const FEATURES = [
  {
    title: "Cites the page, not just the source",
    body: "Every claim links back to the exact page or timestamp — not just \"somewhere in this PDF.\"",
  },
  {
    title: "Handles messy questions",
    body: "Step-back prompting and query rewriting mean you don't have to phrase things perfectly.",
  },
  {
    title: "One notebook per topic",
    body: "Sources and answers stay scoped — nothing bleeds between your different notebooks.",
  },
  {
    title: "Reads more than PDFs",
    body: "PDFs, plain text, subtitles, and websites all go into the same searchable notebook.",
  },
];

function FeatureCard({ title, body, index }: { title: string; body: string; index: number }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`relative bg-[#F8F4E9] rounded-lg p-6 shadow-[0_2px_10px_rgba(0,0,0,0.15)] transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${index * 90}ms` }}
    >
      <span
        aria-hidden
        className="absolute -top-2 left-6 w-8 h-4 bg-[#E8B94D]/70 rotate-2 rounded-[1px]"
      />
      <h3 className="font-semibold text-[#1E2B24] mb-2">{title}</h3>
      <p className="text-sm text-[#3F4A43] leading-relaxed">{body}</p>
    </div>
  );
}

export default function LandingPage() {
  const steps = useInView<HTMLDivElement>();

  return (
    <div className="bg-[#232d28]">
      {/* Fonts + custom keyframes */}
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap");

        .font-hand {
          font-family: "Kalam", cursive;
        }

        @keyframes float-card {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .float-card {
          animation: float-card 5s ease-in-out infinite;
        }

        @keyframes chalk-draw {
          to {
            stroke-dashoffset: 0;
          }
        }
        .chalk-underline path {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: chalk-draw 0.9s 0.5s ease-out forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .float-card {
            animation: none;
          }
          .chalk-underline path {
            animation: none;
            stroke-dashoffset: 0;
          }
        }
      `}</style>

      {/* HERO */}
      <section className="relative overflow-hidden min-h-screen flex items-center px-6 md:px-16">
        {/* faint chalk dust texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, #F3EFE4 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center py-24 w-full">
          <div>
            <p className="font-hand text-[#E8B94D] text-xl mb-3">notes that cite themselves</p>

            <h1 className="text-4xl md:text-5xl font-bold text-[#F3EFE4] leading-[1.15] mb-6">
              Every source, one notebook,
              <br />
              answers you can{" "}
              <span className="relative inline-block">
                point to
                <svg
                  className="chalk-underline absolute left-0 -bottom-2 w-full"
                  height="12"
                  viewBox="0 0 160 12"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    pathLength="1"
                    d="M2 8 C 40 2, 90 10, 158 4"
                    stroke="#E8748A"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              .
            </h1>

            <p className="text-[#C7C2B4] text-lg mb-8 max-w-md leading-relaxed">
              Drop in a PDF, a lecture's subtitles, or a webpage. Ask a question in plain
              language — get an answer with the exact page or timestamp it came from.
            </p>

            <div className="flex items-center gap-4">
              <Link
                href="/notebook"
                className="bg-[#E8B94D] text-[#1E2B24] font-semibold px-6 py-3 rounded-lg hover:bg-[#F3EFE4] transition-colors"
              >
                Open your notebooks →
              </Link>
              <span className="text-[#8B9189] text-sm">No sign-up needed to try it.</span>
            </div>
          </div>

          {/* floating source cards */}
          <div className="relative h-80 hidden md:block">
            {SOURCE_CARDS.map((card, i) => (
              <div
                key={card.label}
                className={`float-card absolute bg-[#F8F4E9] rounded-md px-4 py-3 shadow-xl ${card.rotate}`}
                style={{
                  top: `${i * 34}%`,
                  left: `${i % 2 === 0 ? 10 : 35}%`,
                  animationDelay: card.delay,
                }}
              >
                <div className="text-xs font-mono text-[#1E2B24]/60 mb-1">{card.tag}</div>
                <div className="text-sm font-medium text-[#1E2B24]">{card.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        ref={steps.ref}
        className="bg-[#26362D] px-6 md:px-16 py-24 border-t border-[#F3EFE4]/10"
      >
        <div className="max-w-5xl mx-auto">
          <p className="font-hand text-[#E8B94D] text-lg mb-2">how it works</p>
          <h2 className="text-2xl md:text-3xl font-bold text-[#F3EFE4] mb-14">
            Three steps, start to cited answer.
          </h2>

          <div className="grid md:grid-cols-3 gap-10">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className={`transition-all duration-700 ease-out ${
                  steps.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="font-mono text-[#E8748A] text-sm mb-3">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="text-[#F3EFE4] font-semibold mb-2">{step.title}</h3>
                <p className="text-[#A9AF9F] text-sm leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-[#1E2B24] px-6 md:px-16 py-24">
        <div className="max-w-5xl mx-auto">
          <p className="font-hand text-[#E8B94D] text-lg mb-2">what's different</p>
          <h2 className="text-2xl md:text-3xl font-bold text-[#F3EFE4] mb-14">
            Built so you can trust the answer.
          </h2>

          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} title={f.title} body={f.body} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="bg-[#26362D] px-6 md:px-16 py-20 text-center border-t border-[#F3EFE4]/10">
        <svg
          className="mx-auto mb-8 opacity-40"
          width="120"
          height="14"
          viewBox="0 0 120 14"
          fill="none"
          aria-hidden
        >
          <path
            d="M2 7 C 20 2, 30 12, 50 7 S 80 2, 100 7 S 115 12, 118 7"
            stroke="#F3EFE4"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <h2 className="text-2xl md:text-3xl font-bold text-[#F3EFE4] mb-6">
          Your notebook is waiting.
        </h2>
        <Link
          href="/notebook"
          className="inline-block bg-[#E8B94D] text-[#1E2B24] font-semibold px-6 py-3 rounded-lg hover:bg-[#F3EFE4] transition-colors"
        >
          Open your notebooks →
        </Link>
      </section>
    </div>
  );
}