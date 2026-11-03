import type { BrandProfile } from "@studio/db";
import type { T } from "@/lib/i18n";

const PLATFORMS = ["instagram", "tiktok", "facebook", "youtube"];

export function BrandForm({ t, brand, studioName, submit, action }: {
  t: T;
  brand?: BrandProfile;
  studioName?: string;
  submit: string;
  action: (f: FormData) => Promise<void>;
}) {
  const f = t.f;
  const field = (name: keyof typeof f, el: React.ReactNode, wide = false) => (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={name}>{f[name]}</label>
      {el}
    </div>
  );
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {field("studioName", <input className="input" id="studioName" name="studioName" defaultValue={studioName} required />)}
      {field("niche", <input className="input" id="niche" name="niche" defaultValue={brand?.niche} required placeholder="AI tools for Arab professionals" />)}
      {field("audience", <textarea className="input" id="audience" name="audience" rows={2} defaultValue={brand?.audience} required />, true)}
      {field("language", <input className="input" id="language" name="language" defaultValue={brand?.language ?? "Lebanese Arabic"} />)}
      {field("tone", <input className="input" id="tone" name="tone" defaultValue={brand?.tone} placeholder="direct, funny, no hype" />)}
      {field("pillars", <textarea className="input" id="pillars" name="pillars" rows={4} required defaultValue={brand?.pillars.join("\n")} />, true)}
      <fieldset className="sm:col-span-2">
        <legend className="label">{f.platforms}</legend>
        <div className="flex flex-wrap gap-3">
          {PLATFORMS.map((p) => (
            <label key={p} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <input type="checkbox" name="platforms" value={p} defaultChecked={brand ? brand.platforms.includes(p) : p !== "youtube"} />
              <span dir="ltr">{p}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {field("reelsPerWeek", <input className="input" id="reelsPerWeek" name="reelsPerWeek" type="number" min={1} max={14} defaultValue={brand?.reelsPerWeek ?? 3} />)}
      {field("targetSeconds", <input className="input" id="targetSeconds" name="targetSeconds" type="number" min={10} max={180} defaultValue={brand?.targetSeconds ?? 45} />)}
      {field("buffer", <input className="input" id="buffer" name="buffer" type="number" min={1} max={10} defaultValue={brand?.buffer ?? 2} />)}
      {field("postingTime", <input className="input" id="postingTime" name="postingTime" type="time" defaultValue={brand?.postingTime ?? "19:30"} />)}
      {field("timezone", <input className="input" id="timezone" name="timezone" dir="ltr" defaultValue={brand?.timezone ?? "Asia/Beirut"} />)}
      {field("ctaKeyword", <input className="input" id="ctaKeyword" name="ctaKeyword" defaultValue={brand?.ctaKeyword} placeholder="مدير" />)}
      {field("ctaReward", <input className="input" id="ctaReward" name="ctaReward" defaultValue={brand?.ctaReward} />, true)}
      {field("inspirations", <input className="input" id="inspirations" name="inspirations" defaultValue={brand?.inspirations} />, true)}
      {field("redLines", <textarea className="input" id="redLines" name="redLines" rows={2} defaultValue={brand?.redLines} />, true)}
      {field("recordingSetup", <input className="input" id="recordingSetup" name="recordingSetup" defaultValue={brand?.recordingSetup} />, true)}
      {field("country", <input className="input" id="country" name="country" dir="ltr" maxLength={2} defaultValue={brand?.country ?? "LB"} />)}
      {field("goals", <input className="input" id="goals" name="goals" defaultValue={brand?.goals} />)}
      <fieldset className="sm:col-span-2">
        <legend className="label">{f.solutionTracks}</legend>
        <div className="flex flex-wrap gap-3">
          {(["smb", "technical"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <input type="checkbox" name="solutionTracks" value={k} defaultChecked={brand ? brand.solutionTracks.includes(k) : true} />
              {t.track[k]}
            </label>
          ))}
        </div>
      </fieldset>
      {field("serviceCatalog", <textarea className="input" id="serviceCatalog" name="serviceCatalog" rows={4} dir="auto" defaultValue={brand?.serviceCatalog} />, true)}
      {field("techFocus", <input className="input" id="techFocus" name="techFocus" dir="auto" defaultValue={brand?.techFocus} />, true)}
      <fieldset className="space-y-3 rounded-xl border border-line p-4 sm:col-span-2">
        <legend className="label px-1">{f.presenterMode}</legend>
        <div className="flex flex-wrap gap-3">
          {(["self", "avatar", "auto"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <input type="radio" name="presenterMode" value={m} defaultChecked={(brand?.presenterMode ?? "self") === m} />
              {t.presenter[m]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">{t.twinHelp}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="avatarId">{f.avatarId}</label><input className="input" id="avatarId" name="avatarId" dir="ltr" defaultValue={brand?.avatarId} /></div>
          <div><label className="label" htmlFor="voiceId">{f.voiceId}</label><input className="input" id="voiceId" name="voiceId" dir="ltr" defaultValue={brand?.voiceId} /></div>
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <button className="btn-gold px-6 py-3">{submit}</button>
      </div>
    </form>
  );
}
