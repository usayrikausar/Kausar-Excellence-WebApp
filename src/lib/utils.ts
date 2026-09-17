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
// term. Used only as a fallback (see contractExpiryDate below) for the rare
// record that has a dateLicensed but no real dateExpiry synced yet — every
// current, up-to-date record carries its own dateExpiry straight from
// Wasiyyah's "Tempoh Tamat", which is renewal-aware and doesn't go stale the
// way this fixed-term formula does the moment someone renews.
const STANDARD_CONTRACT_MONTHS = 24;
const KDE_CONTRACT_MONTHS = 36;

function contractTermMonths(rank: Rank): number {
  return rank === "KDE" ? KDE_CONTRACT_MONTHS : STANDARD_CONTRACT_MONTHS;
}

type ExpiryFields = { dateExpiry: string | null; dateLicensed: string | null; rank: Rank };

/** The daie's real contract end date: dateExpiry if set, else a fixed-term estimate from dateLicensed, else null (never licensed). */
export function contractExpiryDate(member: ExpiryFields): Date | null {
  if (member.dateExpiry) return new Date(member.dateExpiry);
  if (!member.dateLicensed) return null;
  const date = new Date(member.dateLicensed);
  date.setMonth(date.getMonth() + contractTermMonths(member.rank));
  return date;
}

export function isContractExpired(member: ExpiryFields): boolean {
  const expiry = contractExpiryDate(member);
  return expiry !== null && expiry.getTime() < Date.now();
}

/** Whole days from now until the contract expires — negative if already expired, null if no expiry date is known at all. */
export function daysUntilExpiry(member: ExpiryFields): number | null {
  const expiry = contractExpiryDate(member);
  if (!expiry) return null;
  return Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export const EXPIRY_REMINDER_WINDOW_DAYS = 180;
export const EXPIRY_REMINDER_URGENT_DAYS = 90;

/** True when a not-yet-expired contract is due for a renewal reminder — within 6 months of expiry (see EXPIRY_REMINDER_WINDOW_DAYS). */
export function isExpiryReminderDue(member: ExpiryFields): boolean {
  const days = daysUntilExpiry(member);
  return days !== null && days > 0 && days <= EXPIRY_REMINDER_WINDOW_DAYS;
}

/**
 * "Active" for display purposes: an admin-active subscription AND a
 * not-yet-expired Wasiyyah contract (someone can be subscriptionStatus
 * "active" but still show as expired here if their contract term lapsed and
 * no one's renewed dateExpiry yet).
 */
export function isActiveStatus(member: { subscriptionStatus: SubscriptionStatus } & ExpiryFields): boolean {
  return member.subscriptionStatus === "active" && !isContractExpired(member);
}
