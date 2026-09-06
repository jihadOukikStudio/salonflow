"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { loginAction, type LoginActionState } from "@/app/login/actions";

const initialState: LoginActionState = {
  error: null,
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Email
        </label>

        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={320}
          disabled={pending}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-violet-600 focus:ring-2 focus:ring-violet-200 disabled:bg-slate-100 disabled:text-slate-500"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Mot de passe
        </label>

        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={512}
          disabled={pending}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-violet-600 focus:ring-2 focus:ring-violet-200 disabled:bg-slate-100 disabled:text-slate-500"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <LoaderCircle
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
              strokeWidth={1.8}
            />
            Connexion…
          </>
        ) : (
          "Se connecter"
        )}
      </button>
    </form>
  );
}
