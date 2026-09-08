import { ForgotPasswordForm } from "@/app/forgot-password/forgot-password-form";
import { LoginSplash } from "@/app/login/login-splash";
import { SalonFlowLogo } from "@/features/brand/components/salonflow-logo";

export default function ForgotPasswordPage() {
  return (
    <LoginSplash>
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-9">
          <SalonFlowLogo size={54} />
          <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950">
            Mot de passe oublié
          </h1>
          <p className="mt-3 mb-7 text-sm leading-6 text-slate-600">
            Si votre compte possède un email, vous recevrez un lien sécurisé
            valable 30 minutes. Une employée sans email doit demander une
            réinitialisation à une Gérante.
          </p>
          <ForgotPasswordForm />
        </section>
      </main>
    </LoginSplash>
  );
}
