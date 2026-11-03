import { redirect } from "next/navigation";
import { login } from "@/app/actions/auth";
import { AuthForm } from "@/components/AuthForm";
import { currentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/app");
  const { t } = await getT();
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <AuthForm mode="login" action={login} labels={{ login: t.login, signup: t.signup, email: t.email, password: t.password, name: t.name, noAccount: t.noAccount, haveAccount: t.haveAccount, badLogin: t.badLogin }} />
    </main>
  );
}
