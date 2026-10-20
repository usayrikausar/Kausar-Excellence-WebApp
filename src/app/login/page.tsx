import { Suspense } from "react";
import Image from "next/image";
import { LoginBranding } from "@/components/marketing/login-branding";
import { LoginForm } from "@/components/marketing/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full">
      <LoginBranding />
      <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-white p-8">
        {/* The blue brand panel is hidden below lg, so phones get the logo here. */}
        <div className="rounded-2xl bg-navy-900 px-6 py-4 shadow-md lg:hidden">
          <Image src="/kausar-logo-cropped.png" alt="Kausar Group" width={1308} height={543} priority className="h-16 w-auto" />
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
