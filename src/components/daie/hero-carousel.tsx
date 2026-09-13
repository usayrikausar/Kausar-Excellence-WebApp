"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Static, admin-editable-in-code array of campaign/BOD event banners for
// Phase 1 — no CMS yet, just a simple array-backed carousel. Swap this array
// (or wire it to a Firestore doc) when Phase 2 adds real banner management.
const SLIDES = [
  {
    title: "Welcome to Kausar Excellence",
    subtitle: "Track your sales, your team, and the latest from Kausar Group — all in one place.",
    accent: "primary" as const,
  },
  {
    title: "Q3 Wasiat Awareness Campaign",
    subtitle: "New collateral and talking points now available — ask your KDE for the latest deck.",
    accent: "accent" as const,
  },
  {
    title: "BOD Townhall — Save the Date",
    subtitle: "Board of Directors townhall for all units. Details coming via Bulletin.",
    accent: "success" as const,
  },
];

export function HeroCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 6000);
    return () => clearInterval(id);
  }, []);

  const slide = SLIDES[index];
  const bg =
    slide.accent === "accent"
      ? "bg-accent text-accent-foreground"
      : slide.accent === "success"
        ? "bg-success text-success-foreground"
        : "bg-primary text-primary-foreground";

  return (
    <div className={cn("relative overflow-hidden rounded-xl p-8", bg)}>
      <div className="max-w-xl space-y-2">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">{slide.title}</h2>
        <p className="text-sm opacity-90">{slide.subtitle}</p>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous slide"
          onClick={() => setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length)}
          className="rounded-full bg-black/10 p-1.5 hover:bg-black/20"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn("h-1.5 w-6 rounded-full transition-colors", i === index ? "bg-black/60" : "bg-black/20")}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Next slide"
          onClick={() => setIndex((i) => (i + 1) % SLIDES.length)}
          className="rounded-full bg-black/10 p-1.5 hover:bg-black/20"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
