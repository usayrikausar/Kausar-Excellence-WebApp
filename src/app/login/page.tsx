import { Suspense } from "react";
import { LoginBranding } from "@/components/marketing/login-branding";
import { LoginForm } from "@/components/marketing/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full">
      <LoginBranding />
      <div className="flex flex-1 flex-col items-center justify-center bg-white p-8">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
