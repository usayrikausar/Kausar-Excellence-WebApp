/** True only in the staging build (scripts/deploy-staging.sh sets NEXT_PUBLIC_APP_ENV=staging). */
export const IS_STAGING = process.env.NEXT_PUBLIC_APP_ENV === "staging";

/**
 * A strip across every page of the staging app (login and report cards
 * included) so nobody mistakes it for the live app. Renders nothing on live.
 */
export function StagingBanner() {
  if (!IS_STAGING) return null;
  return (
    <div className="bg-red-700 px-4 py-1.5 text-center text-xs font-semibold text-white print:hidden">
      STAGING · demo data only. Nothing you do here reaches the live app.
    </div>
  );
}
