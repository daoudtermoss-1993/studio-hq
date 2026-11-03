"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, eq, users } from "@studio/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email.includes("@") || !name) return { error: "missing" };
  if (password.length < 8) return { error: "weakPassword" };
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) return { error: "emailTaken" };
  const locale = (await cookies()).get("lang")?.value === "en" ? "en" : "ar";
  const [user] = await db.insert(users).values({ email, name, passwordHash: await hashPassword(password), locale }).returning();
  await createSession(user.id);
  redirect("/onboarding");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: "badLogin" };
  await createSession(user.id);
  redirect("/app");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function setLanguage(form: FormData) {
  const lang = form.get("lang") === "en" ? "en" : "ar";
  (await cookies()).set("lang", lang, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
  redirect(String(form.get("back") || "/"));
}
