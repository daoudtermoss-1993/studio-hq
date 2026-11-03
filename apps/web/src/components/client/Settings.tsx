import type { Client } from "@studio/db";
import { settingsOf, waConfigured } from "@studio/core";
import { clientSettingsAction, clientStatusAction, connectWaAction } from "@/app/actions/clients";
import { CopyButton } from "@/components/CopyButton";
import type { T } from "@/lib/i18n";

export function ClientSettings({ c, t }: { c: Client; t: T }) {
  const s = settingsOf(c);
  const hidden = <input type="hidden" name="clientId" value={c.id} />;
  const webhook = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/wa/${c.id}`;
  const f = (name: keyof typeof s & keyof typeof t.cl, type = "text", ltr = false) => (
    <div><label className="label" htmlFor={name}>{t.cl[name] as string}</label><input id={name} name={name} type={type} dir={ltr ? "ltr" : "auto"} className="input" defaultValue={String(s[name] ?? "")} /></div>
  );
  return (
    <div className="space-y-4">
      <form action={clientSettingsAction} className="card grid gap-3 sm:grid-cols-2">
        {hidden}
        <h2 className="font-bold text-gold sm:col-span-2">{t.cl.settingsTitle}</h2>
        <div className="sm:col-span-2">{f("tone")}</div>
        {f("escalation")}
        <div><label className="label" htmlFor="timezone">Timezone</label><input id="timezone" name="timezone" dir="ltr" className="input" defaultValue={c.timezone} /></div>
        {f("bookingLink", "url", true)}{f("reviewLink", "url", true)}
        {f("openHour", "time", true)}{f("closeHour", "time", true)}
        {f("reminderTemplate", "text", true)}{f("reviewTemplate", "text", true)}
        {f("templateLanguage", "text", true)}{f("dailyCap", "number", true)}
        {f("retentionDays", "number", true)}
        <div className="sm:col-span-2"><button className="btn-gold">{t.cl.save}</button></div>
      </form>
      <form action={connectWaAction} className="card grid gap-3 sm:grid-cols-3">
        {hidden}
        <h2 className="font-bold text-gold sm:col-span-3">{t.cl.waTitle} · <span className={waConfigured(c) ? "text-ok" : "text-muted"}>{waConfigured(c) ? t.cl.waConnected : t.cl.waNotConnected}</span></h2>
        <div><label className="label" htmlFor="pnid">{t.cl.waPhoneId}</label><input id="pnid" name="phoneNumberId" required pattern="\d{5,25}" dir="ltr" className="input" defaultValue={c.waPhoneNumberId} /></div>
        <div><label className="label" htmlFor="wat">{t.cl.waToken}</label><input id="wat" name="accessToken" type="password" autoComplete="off" dir="ltr" className="input" placeholder={c.waTokenEnc ? "••••••• (saved)" : ""} /></div>
        <div><label className="label" htmlFor="was">{t.cl.waSecret}</label><input id="was" name="appSecret" type="password" autoComplete="off" dir="ltr" className="input" placeholder={c.waAppSecretEnc ? "••••••• (saved)" : ""} /></div>
        <div className="space-y-1 text-sm sm:col-span-3">
          <div className="flex flex-wrap items-center gap-2"><span className="text-muted">{t.cl.waWebhook}:</span><code className="break-all rounded bg-ink px-2 py-1 text-xs" dir="ltr">{webhook}</code><CopyButton text={webhook} label={t.copy} done={t.copied} /></div>
          <div className="flex flex-wrap items-center gap-2"><span className="text-muted">{t.cl.waVerify}:</span><code className="rounded bg-ink px-2 py-1 text-xs" dir="ltr">{c.waVerifyToken}</code><CopyButton text={c.waVerifyToken} label={t.copy} done={t.copied} /></div>
        </div>
        <div><button className="btn-ghost">{t.cl.save}</button></div>
      </form>
      <form action={clientStatusAction} className="card flex items-center gap-3">
        {hidden}
        <input type="hidden" name="status" value={c.status === "active" ? "paused" : "active"} />
        <span className="text-sm">{t.cl.status[c.status]}</span>
        <button className="btn-ghost">{c.status === "active" ? t.cl.pause : t.cl.activate}</button>
      </form>
    </div>
  );
}
