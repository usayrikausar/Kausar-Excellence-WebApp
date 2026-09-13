import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Rank, SubscriptionStatus } from "@/lib/types";

/** Shared shadcn-style className combiner: clsx for conditionals, tailwind-merge to dedupe. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const RM_FORMATTER = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
});

export function formatRM(amount: number) {
  return RM_FORMATTER.format(amount).replace("MYR", "RM");
}

export function formatDate(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(date);
}

// Standard contract term is 24 months; KDE gets a longer 36-month renewal
// term. (Some historical entries were originally 12 months then extended —
// that's legacy residue from before this policy, not something to replicate
// going forward; every current contract follows one of these two terms.)
const STANDARD_CONTRACT_MONTHS = 24;
const KDE_CONTRACT_MONTHS = 36;

function contractTermMonths(rank: Rank): number {
  return rank === "KDE" ? KDE_CONTRACT_MONTHS : STANDARD_CONTRACT_MONTHS;
}

/** Wasiyyah contracts auto-expire 24 months after the license date (36 for KDE). */
export function contractExpiryDate(dateLicensed: string, rank: Rank): Date {
  const date = new Date(dateLicensed);
  date.setMonth(date.getMonth() + contractTermMonths(rank));
  return date;
}

export function isContractExpired(dateLicensed: string, rank: Rank): boolean {
  return contractExpiryDate(dateLicensed, rank).getTime() < Date.now();
}

/**
 * "Active" for display purposes: an admin-active subscription AND a
 * not-yet-expired Wasiyyah contract (someone can be subscriptionStatus
 * "active" but still show as expired here if their contract term lapsed and
 * no one's renewed dateLicensed yet).
 */
export function isActiveStatus(member: { subscriptionStatus: SubscriptionStatus; dateLicensed: string | null; rank: Rank }): boolean {
  const contractExpired = member.dateLicensed ? isContractExpired(member.dateLicensed, member.rank) : false;
  return member.subscriptionStatus === "active" && !contractExpired;
}
