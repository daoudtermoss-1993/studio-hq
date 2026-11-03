"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";

interface Props {
  mode: "login" | "signup";
  action: (s: FormState, f: FormData) => Promise<FormState>;
  labels: Record<string, string>;
}

export function AuthForm({ mode, action, labels }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="card mx-auto w-full max-w-sm space-y-4">
      <h1 className="font-display text-2xl font-extrabold">{mode === "login" ? labels.login : labels.signup}</h1>
      {mode === "signup" && (
        <div>
          <label className="label" htmlFor="name">{labels.name}</label>
          <input className="input" id="name" name="name" required autoComplete="name" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">{labels.email}</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" dir="ltr" />
      </div>
      <div>
        <label className="label" htmlFor="password">{labels.password}</label>
        <input className="input" id="password" name="password" type="password" required minLength={8} dir="ltr"
          autoComplete={mode === "login" ? "current-password" : "new-password"} />
      </div>
      {state?.error && <p role="alert" className="text-sm text-coral">{labels[state.error] ?? state.error}</p>}
      <button className="btn-gold w-full" disabled={pending}>{mode === "login" ? labels.login : labels.signup}</button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? labels.noAccount : labels.haveAccount}{" "}
        <Link className="text-gold underline" href={mode === "login" ? "/signup" : "/login"}>
          {mode === "login" ? labels.signup : labels.login}
        </Link>
      </p>
    </form>
  );
}
