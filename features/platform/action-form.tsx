"use client";
import { useActionState, type ReactNode } from "react";
import {
  platformAction,
  type PlatformFormState,
} from "@/app/superadmin/actions";
import { buttonClass } from "./ui";

export function ActionForm({
  kind,
  children,
  submit,
  danger = false,
  actionHandler = platformAction,
}: {
  kind: string;
  children: ReactNode;
  submit: string;
  danger?: boolean;
  actionHandler?: (
    state: PlatformFormState,
    data: FormData,
  ) => Promise<PlatformFormState>;
}) {
  const [state, action, pending] = useActionState(actionHandler, {
    ok: false,
    message: "",
  });
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <fieldset disabled={pending} className="space-y-4 disabled:opacity-60">
        {children}
      </fieldset>
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`rounded-lg p-3 text-sm ${state.ok ? "bg-teal-50 text-teal-900" : "bg-rose-50 text-rose-900"}`}
        >
          {state.message}
        </p>
      )}
      <button
        disabled={pending}
        className={
          danger
            ? "min-h-11 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
            : buttonClass
        }
      >
        {pending ? "Enregistrement…" : submit}
      </button>
    </form>
  );
}
