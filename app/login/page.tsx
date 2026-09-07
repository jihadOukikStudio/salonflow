import { LoginForm } from "@/app/login/login-form";
import { LoginSplash } from "@/app/login/login-splash";
import { SalonFlowLogo } from "@/features/brand/components/salonflow-logo";

export default function LoginPage() {
  return (
    <LoginSplash>
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-9">
          <div className="mb-8">
            <SalonFlowLogo size={54} />

            <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950">
              Connexion
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Accédez au planning du salon avec votre compte individuel.
            </p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-xs text-slate-500">
            Le 7ème Sens Marrakech
          </p>
        </section>
      </main>
    </LoginSplash>
  );
}
