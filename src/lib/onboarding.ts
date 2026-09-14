// My Onboarding — the subset of trainings flagged `requiredForOnboarding`.
// These recur (e.g. monthly "Start Training" cohorts), so this groups by
// title rather than treating every monthly session as its own requirement:
// attending ANY ONE instance of a given title satisfies that requirement.
// Pure function, no Firestore here — see getOnboardingStatusForUid in
// lib/data.ts for the fetch-and-call wrapper.

import type { TrainingWithId, TrainingAttendanceEntry } from "@/lib/types";

export interface OnboardingRequirement {
  title: string;
  cpdHours: number;
  completed: boolean;
  /** Date of the earliest attended instance, if completed. */
  completedDate: string | null;
  /** The nearest not-yet-attended instance dated today or later — actionable (scan QR / self-report). */
  upcomingSession: TrainingWithId | null;
  /** Most recent not-yet-attended instance that's already in the past — shown only when there's no upcoming one, so the daie knows they missed it rather than seeing a dead action. */
  missedSession: TrainingWithId | null;
}

export interface OnboardingStatus {
  /** True only once there's at least one requirement AND every one of them is completed. */
  complete: boolean;
  requirements: OnboardingRequirement[];
}

export function computeOnboardingStatus(trainings: TrainingWithId[], attendance: TrainingAttendanceEntry[], asOfIso: string = new Date().toISOString().slice(0, 10)): OnboardingStatus {
  const required = trainings.filter((t) => t.requiredForOnboarding);
  const attendedTrainingIds = new Set(attendance.map((a) => a.trainingId));

  const groups = new Map<string, TrainingWithId[]>();
  for (const t of required) {
    const list = groups.get(t.title) ?? [];
    list.push(t);
    groups.set(t.title, list);
  }

  const requirements: OnboardingRequirement[] = [...groups.entries()].map(([title, instances]) => {
    const sorted = [...instances].sort((a, b) => a.date.localeCompare(b.date));
    const attendedInstances = sorted.filter((t) => attendedTrainingIds.has(t.id));
    const unattended = sorted.filter((t) => !attendedTrainingIds.has(t.id));
    const completed = attendedInstances.length > 0;
    const upcomingSession = unattended.find((t) => t.date >= asOfIso) ?? null;
    const missedSession = upcomingSession ? null : (unattended.filter((t) => t.date < asOfIso).pop() ?? null);

    return {
      title,
      cpdHours: sorted[0]?.cpdHours ?? 0,
      completed,
      completedDate: completed ? attendedInstances[0].date : null,
      upcomingSession,
      missedSession,
    };
  });

  requirements.sort((a, b) => a.title.localeCompare(b.title));

  return {
    complete: requirements.length > 0 && requirements.every((r) => r.completed),
    requirements,
  };
}
