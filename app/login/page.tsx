import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            SalonFlow
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Connexion
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Accédez au planning du salon avec votre compte individuel.
          </p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
