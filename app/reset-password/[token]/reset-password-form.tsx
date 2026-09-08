"use client";

import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import {
  resetPasswordAction,
  type ResetPasswordActionState,
} from "@/app/reset-password/[token]/actions";

const initialState: ResetPasswordActionState = {
  success: false,
  error: null,
};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialState,
  );

  if (state.success) {
    return (
      <div className="space-y-5">
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"
        >
          Votre mot de passe a été modifié. Toutes vos anciennes sessions ont
          été invalidées.
        </p>
        <Link
          href="/login"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-violet-700 px-4 py-3 font-semibold text-white hover:bg-violet-800"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      <input type="hidden" name="token" value={token} />

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Nouveau mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          disabled={pending}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-violet-600 focus:ring-2 focus:ring-violet-200 disabled:bg-slate-100"
        />
      </div>

      <div>
        <label
          htmlFor="passwordConfirmation"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Confirmer le mot de passe
        </label>
        <input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          disabled={pending}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-violet-600 focus:ring-2 focus:ring-violet-200 disabled:bg-slate-100"
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
            Modification…
          </>
        ) : (
          "Modifier le mot de passe"
        )}
      </button>
    </form>
  );
}
