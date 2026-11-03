import { setLanguage } from "@/app/actions/auth";

export function LangToggle({ locale, label, back }: { locale: "ar" | "en"; label: string; back: string }) {
  return (
    <form action={setLanguage}>
      <input type="hidden" name="lang" value={locale === "ar" ? "en" : "ar"} />
      <input type="hidden" name="back" value={back} />
      <button className="btn-ghost px-3 py-1.5 text-xs">{label}</button>
    </form>
  );
}
