// Left-panel brand lockup for /login. "Marketing"-flavored (first thing an
// unauthenticated visitor sees), so it lives in components/marketing per the
// components/{marketing,daie,admin,ui} split.
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
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold">
          Kausar Group
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
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Shariah-compliant by design
        </span>
      </div>
      <p className="relative z-10 text-xs text-white/60">
        &copy; {new Date().getFullYear()} Kausar Group. Internal use only.
      </p>
    </div>
  );
}
