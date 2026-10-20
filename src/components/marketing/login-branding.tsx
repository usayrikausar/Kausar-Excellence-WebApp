// Left-panel brand lockup for /login. "Marketing"-flavored (first thing an
// unauthenticated visitor sees), so it lives in components/marketing per the
// components/{marketing,daie,admin,ui} split.
import Image from "next/image";

export function LoginBranding() {
  return (
    <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, var(--color-navy-500) 0%, transparent 45%), radial-gradient(circle at 80% 80%, var(--color-navy-700) 0%, transparent 55%)",
        }}
      />
      <div className="relative z-10">
        {/* Navy plate, same as the app sidebar: the logo's white lettering and
            blue petal both wash out directly on Amanah Blue. */}
        <div className="inline-flex rounded-2xl bg-navy-900 px-6 py-4 shadow-lg">
          <Image src="/kausar-logo-cropped.png" alt="Kausar Group" width={1308} height={543} priority className="h-20 w-auto" />
        </div>
      </div>
      <div className="relative z-10 space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold leading-tight">
          Excellence WebApp
        </h1>
        <p className="max-w-md text-navy-100" style={{ color: "var(--color-navy-100)" }}>
          One dashboard for the daie network across Kausar Wealth, Global, Aspire, Intisar, and Nusrah —
          wasiat, hibah, and pusaka planning, managed with amanah.
        </p>
      </div>
      <p className="relative z-10 text-xs text-white/60">
        &copy; {new Date().getFullYear()} Kausar Group. Internal use only.
      </p>
    </div>
  );
}
