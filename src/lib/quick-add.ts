// Quick add (phone): the "+" button's choices, each opening one entry form on
// its own screen at /add/<type>. Agreed 2026-11-18, modelled on BNI Connect's
// slip button. Client-safe.

export const QUICK_ADD_TYPES = ["activity", "prospect", "perancangan", "payment", "wasitah", "pusaka"] as const;
export type QuickAddType = (typeof QUICK_ADD_TYPES)[number];

export const QUICK_ADD_LABELS: Record<QuickAddType, { label: string; title: string; hint: string }> = {
  activity: { label: "Activity", title: "Log an activity", hint: "PIPPPAS step, training or JFW. Counts toward your traffic light." },
  prospect: { label: "New prospect", title: "New prospect", hint: "Add someone to your pipeline." },
  perancangan: { label: "Perancangan", title: "Perancangan case", hint: "Total amount, products and any promotion." },
  payment: { label: "Payment", title: "Payment received", hint: "RM collected for a Perancangan case." },
  wasitah: { label: "Wasitah", title: "Al Wasitah", hint: "Berlian, Mutiara, Intan or Khairat Pusaka cases." },
  pusaka: { label: "Kes Pusaka", title: "Kes Pusaka", hint: "Besar or Kecil estate case." },
};

export function isQuickAddType(v: string): v is QuickAddType {
  return (QUICK_ADD_TYPES as readonly string[]).includes(v);
}

/** Only a path inside the app (never another site) is a valid place to return to. */
export function safeReturnPath(v: string | undefined | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") && !v.startsWith("/add/") ? v : "/";
}

/** Set before returning from a save; the app shell shows "Saved" once and clears it. */
export const QUICK_ADD_SAVED_KEY = "kausar.quickAddSaved";
