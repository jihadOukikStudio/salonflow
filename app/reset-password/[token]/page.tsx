import { LoginSplash } from "@/app/login/login-splash";
import { ResetPasswordForm } from "@/app/reset-password/[token]/reset-password-form";
import { SalonFlowLogo } from "@/features/brand/components/salonflow-logo";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <LoginSplash>
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-9">
          <SalonFlowLogo size={54} />
          <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950">
            Nouveau mot de passe
          </h1>
          <p className="mt-3 mb-7 text-sm leading-6 text-slate-600">
            Choisissez un nouveau mot de passe d’au moins 12 caractères.
          </p>
          <ResetPasswordForm token={token} />
        </section>
      </main>
    </LoginSplash>
  );
}
