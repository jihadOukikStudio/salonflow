import { logoutAction } from "@/app/logout/actions";
export function SessionExpired() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="max-w-md rounded-2xl border bg-white p-8">
        <h1 className="text-2xl font-semibold">Session indisponible</h1>
        <p className="my-4 text-slate-600">
          Votre session a expiré ou l’accès à votre compte ou salon a été
          suspendu. Reconnectez-vous ; si le problème persiste, contactez votre
          gérante ou l’assistance SalonFlow.
        </p>
        <form action={logoutAction}>
          <button className="rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white">
            Retour à la connexion
          </button>
        </form>
      </section>
    </main>
  );
}
