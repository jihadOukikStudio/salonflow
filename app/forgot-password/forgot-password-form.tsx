"use client";

import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import {
  forgotPasswordAction,
  type ForgotPasswordActionState,
} from "@/app/forgot-password/actions";

const initialState: ForgotPasswordActionState = {
  success: false,
  message: null,
  error: null,
};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Email du compte
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={320}
          disabled={pending || state.success}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-violet-600 focus:ring-2 focus:ring-violet-200 disabled:bg-slate-100 disabled:text-slate-500"
          placeholder="nom@exemple.com"
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

      {state.message ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"
        >
          {state.message}
        </p>
      ) : null}

      {!state.success ? (
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
              Envoi…
            </>
          ) : (
            "Recevoir le lien"
          )}
        </button>
      ) : null}

      <Link
        href="/login"
        className="block text-center text-sm font-medium text-violet-700 hover:text-violet-900"
      >
        Retour à la connexion
      </Link>
    </form>
  );
}
