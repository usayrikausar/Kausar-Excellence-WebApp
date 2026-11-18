"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { QUICK_ADD_SAVED_KEY } from "@/lib/quick-add";

/** "Saved" for a moment after a quick-add form returns to the page it came from. */
export function QuickAddSavedNotice() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let saved = false;
    try {
      saved = sessionStorage.getItem(QUICK_ADD_SAVED_KEY) === "1";
      if (saved) sessionStorage.removeItem(QUICK_ADD_SAVED_KEY);
    } catch {
      return;
    }
    if (!saved) return;
    const on = setTimeout(() => setShow(true), 0);
    const off = setTimeout(() => setShow(false), 2600);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [pathname]);

  if (!show) return null;
  return (
    <div
      role="status"
      className="quick-add-in fixed inset-x-0 z-50 mx-auto flex w-fit items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg print:hidden"
      style={{ bottom: "calc(4rem + env(safe-area-inset-bottom) + 1.25rem)" }}
    >
      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> Saved
    </div>
  );
}
