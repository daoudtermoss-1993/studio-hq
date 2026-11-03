import { redirect } from "next/navigation";
import { signup } from "@/app/actions/auth";
import { AuthForm } from "@/components/AuthForm";
import { currentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Sign up" };

export default async function SignupPage() {
  if (await currentUser()) redirect("/app");
  const { t } = await getT();
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <AuthForm
        mode="signup"
        action={signup}
        labels={{ login: t.login, signup: t.signup, email: t.email, password: t.password, name: t.name, noAccount: t.noAccount, haveAccount: t.haveAccount, emailTaken: t.emailTaken, weakPassword: t.weakPassword, missing: t.name }}
      />
    </main>
  );
}
