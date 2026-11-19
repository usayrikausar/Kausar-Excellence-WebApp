"use client";

import { useRouter } from "next/navigation";
import { PerancanganForm, PengurusanForm, KesPusakaForm, type ProspectOption } from "@/components/daie/sales-forms";
import { LogActivityForm } from "@/components/daie/log-activity-form";
import { NewProspectForm } from "@/components/daie/new-prospect-dialog";
import { QUICK_ADD_SAVED_KEY, type QuickAddType } from "@/lib/quick-add";
import type { CaseOption } from "@/lib/sale-details";

type ActivityProps = React.ComponentProps<typeof LogActivityForm>;

/**
 * One entry form on the quick-add screen. The forms are the same ones the
 * Sales and Activities pages use; after a save this goes back to the page
 * the "+" was tapped on, which then shows "Saved".
 */
export function QuickAddForm({
  type,
  uid,
  returnTo,
  prospects,
  activityProspects,
  team,
  cases,
}: {
  type: QuickAddType;
  uid: string;
  returnTo: string;
  prospects: ProspectOption[];
  activityProspects: ActivityProps["prospects"];
  team: ActivityProps["team"];
  cases: CaseOption[];
}) {
  const router = useRouter();
  function onSaved() {
    try {
      sessionStorage.setItem(QUICK_ADD_SAVED_KEY, "1");
    } catch {
      // Private mode: the save still happened, only the notice is skipped.
    }
    router.push(returnTo);
  }

  switch (type) {
    case "activity":
      return <LogActivityForm uid={uid} prospects={activityProspects} team={team} onSaved={onSaved} />;
    case "prospect":
      return <NewProspectForm uid={uid} onSaved={onSaved} />;
    case "perancangan":
      return <PerancanganForm uid={uid} prospects={prospects} initialMode="case" onSaved={onSaved} />;
    case "payment":
      return <PerancanganForm uid={uid} prospects={prospects} initialMode="collection" cases={cases} onSaved={onSaved} />;
    case "wasitah":
      return <PengurusanForm uid={uid} prospects={prospects} onSaved={onSaved} />;
    case "pusaka":
      return <KesPusakaForm uid={uid} prospects={prospects} onSaved={onSaved} />;
  }
}
