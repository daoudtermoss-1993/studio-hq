/** A real, production-quality homepage used as the lead designer's answer in mock mode (demo + tests). */
export function mockHomepage(name: string, phone: string) {
  const digits = phone.replace(/\D/g, "") || "9610000000";
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
  const n = esc(name);
  const icon = (d: string) => `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const services = [
    ["زراعة الأسنان", "زرعات بتدوم، مع خطة واضحة وسعر معروف من أول زيارة.", '<path d="M12 3c-3 0-5 2-5 5 0 4 2 5 2 9 0 2 1 4 3 4s3-2 3-4c0-4 2-5 2-9 0-3-2-5-5-5z"/>'],
    ["تبييض الأسنان", "جلسة وحدة بالعيادة، نتيجة طبيعية وبلا حساسية.", '<path d="M12 2v4M12 18v4M4 12H2M22 12h-2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/><circle cx="12" cy="12" r="4"/>'],
    ["تقويم شفاف", "تقويم ما بينشاف، متابعة كل 6 أسابيع.", '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M8 8v8M12 8v8M16 8v8"/>'],
    ["تنظيف وفحص دوري", "فحص كامل وتنظيف بـ 30 دقيقة، للكبار والصغار.", '<path d="M4 20l6-6M14 4l6 6-8 8-6-6z"/>'],
  ].map(([t, d, i]) => `<article class="card">${icon(i)}<h3>${t}</h3><p>${d}</p><p class="from">ابتداءً من [السعر]</p></article>`).join("");
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${n} — عيادة أسنان، احجز موعدك عالواتساب</title>
<meta name="description" content="${n}: زراعة، تبييض، تقويم شفاف وتنظيف. احجز موعدك عالواتساب بدقيقة.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap">
<style>
:root{--brand:#0e6e6b;--brand-2:#0b4f4d;--accent:#f4a259;--ink:#13232f;--muted:#5b6b78;--bg:#f7faf9;--card:#fff;--line:#e3ecea;--r:18px;--s:clamp(16px,4vw,32px)}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;font-family:"IBM Plex Sans Arabic",system-ui,sans-serif;color:var(--ink);background:var(--bg);line-height:1.7;font-size:clamp(16px,1.6vw,18px)}
a{color:inherit}.wrap{max-width:1120px;margin-inline:auto;padding-inline:var(--s)}
header{position:sticky;top:0;z-index:5;background:rgba(247,250,249,.92);backdrop-filter:blur(8px);border-block-end:1px solid var(--line)}
.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:68px}
.logo{display:flex;align-items:center;gap:10px;font-weight:700;text-decoration:none}
.logo span{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--brand);color:#fff}
nav ul{display:flex;gap:24px;list-style:none;margin:0;padding:0}nav a{text-decoration:none;color:var(--muted)}nav a:hover{color:var(--brand)}
.btn{display:inline-flex;align-items:center;gap:10px;min-height:48px;padding:12px 22px;border-radius:999px;background:var(--brand);color:#fff;font-weight:700;text-decoration:none;box-shadow:0 8px 24px rgba(14,110,107,.25)}
.btn:hover{background:var(--brand-2)}.btn:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.btn.ghost{background:transparent;color:var(--brand);box-shadow:inset 0 0 0 2px var(--brand)}
.hero{padding-block:clamp(48px,9vw,112px);display:grid;gap:40px;grid-template-columns:1.1fr .9fr;align-items:center}
.eyebrow{display:inline-block;padding:6px 14px;border-radius:999px;background:#e2f1ef;color:var(--brand);font-weight:600;font-size:.9em}
h1{font-size:clamp(32px,5.4vw,58px);line-height:1.2;margin:16px 0}h2{font-size:clamp(26px,3.4vw,38px);line-height:1.3;margin:0 0 12px}
h3{margin:12px 0 4px;font-size:1.15em}.lead{color:var(--muted);font-size:1.1em;max-width:60ch}
.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.facts{display:flex;flex-wrap:wrap;gap:24px;margin-top:32px;color:var(--muted)}.facts b{display:block;color:var(--ink);font-size:1.4em}
.art{position:relative;aspect-ratio:1;border-radius:32px;background:linear-gradient(150deg,#d7efeb 0%,#9fd3cb 45%,#0e6e6b 100%);display:grid;place-items:center;overflow:hidden}
.art::after{content:"";position:absolute;inset-inline-end:-18%;bottom:-18%;width:60%;aspect-ratio:1;border-radius:50%;background:rgba(255,255,255,.18)}
.appt{position:relative;z-index:1;width:min(78%,320px);background:#fff;border-radius:22px;padding:20px;box-shadow:0 24px 60px rgba(11,79,77,.28)}
.appt .row{display:flex;align-items:center;gap:12px}.appt .tooth{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:#e2f1ef;color:var(--brand)}
.appt small{color:var(--muted)}.appt .time{font-size:1.5em;font-weight:700;margin:14px 0 6px}
.appt .ok{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:#e6f6ec;color:#1d7a46;font-weight:600;font-size:.85em}
.bubble{position:absolute;z-index:1;inset-inline-start:8%;top:10%;background:#fff;border-radius:16px 16px 16px 4px;padding:10px 14px;font-size:.85em;box-shadow:0 12px 30px rgba(0,0,0,.12)}
section{padding-block:clamp(56px,8vw,96px)}.alt{background:#fff;border-block:1px solid var(--line)}
.grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));margin-top:32px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:24px;color:var(--brand)}.card p{color:var(--muted);margin:0}.card h3{color:var(--ink)}
.from{margin-top:10px!important;font-weight:600;color:var(--brand)!important}
.steps{counter-reset:s;display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));padding:0;list-style:none;margin-top:32px}
.steps li{counter-increment:s;background:var(--bg);border-radius:var(--r);padding:24px}.steps li::before{content:counter(s);display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--accent);color:var(--ink);font-weight:700;margin-block-end:8px}
details{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin-top:12px}summary{cursor:pointer;font-weight:600}
.contact{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:24px}
.box{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:24px}
.map{min-height:220px;border-radius:var(--r);background:repeating-linear-gradient(45deg,#e7f0ee 0 14px,#f2f7f6 14px 28px);display:grid;place-items:center;color:var(--muted)}
footer{padding-block:32px;color:var(--muted);font-size:.9em;border-block-start:1px solid var(--line)}
.bar{display:none}
@media (max-width:820px){.hero{grid-template-columns:1fr}.art{aspect-ratio:4/3;width:100%}nav ul{display:none}.top-cta{display:none}
.bar{display:flex;gap:8px;position:fixed;inset-inline:12px;bottom:12px;z-index:6;padding:8px;border-radius:999px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.15)}
.bar a{flex:1;justify-content:center}body{padding-block-end:84px}}
</style>
</head>
<body>
<header><div class="wrap nav">
<a class="logo" href="#top"><span>${icon('<path d="M12 3c-3 0-5 2-5 5 0 4 2 5 2 9 0 2 1 4 3 4s3-2 3-4c0-4 2-5 2-9 0-3-2-5-5-5z"/>')}</span>${n}</a>
<nav aria-label="القائمة"><ul><li><a href="#services">الخدمات</a></li><li><a href="#how">كيف تحجز</a></li><li><a href="#faq">أسئلة</a></li><li><a href="#contact">تواصل</a></li></ul></nav>
<a class="btn top-cta" href="https://wa.me/${digits}">احجز عالواتساب</a>
</div></header>
<main id="top">
<section class="wrap hero" aria-labelledby="h">
<div>
<span class="eyebrow">عيادة أسنان · [المنطقة]</span>
<h1 id="h">ابتسامة صحية، وموعد بدقيقة وحدة عالواتساب</h1>
<p class="lead">زراعة، تبييض، تقويم شفاف وتنظيف — خطة علاج واضحة وسعر معروف قبل ما نبلّش. ابعتلنا رسالة ومنرد عليك بنفس اليوم.</p>
<div class="cta"><a class="btn" href="https://wa.me/${digits}">احجز موعدك عالواتساب</a><a class="btn ghost" href="tel:+${digits}">اتصل فينا</a></div>
<div class="facts"><div><b>[عدد السنين]</b>سنة خبرة</div><div><b>[تقييم Google]</b>من مرضى حقيقيين</div><div><b>نفس اليوم</b>رد على الرسائل</div></div>
</div>
<div class="art" role="img" aria-label="مثال على تأكيد موعد عالواتساب">
<div class="bubble">مرحبا، بدي موعد تنظيف 🙏</div>
<div class="appt"><div class="row"><span class="tooth">${icon('<path d="M12 3c-3 0-5 2-5 5 0 4 2 5 2 9 0 2 1 4 3 4s3-2 3-4c0-4 2-5 2-9 0-3-2-5-5-5z"/>')}</span><div><b>موعدك القادم</b><br><small>تنظيف وفحص دوري</small></div></div>
<div class="time">الخميس · 4:30</div><span class="ok">✓ تأكّد عالواتساب</span></div>
</div>
</section>
<section id="services" class="alt" aria-labelledby="sv"><div class="wrap">
<h2 id="sv">خدماتنا</h2><p class="lead">كل علاج بيبلّش بفحص وصورة، وخطة مكتوبة إلك.</p>
<div class="grid">${services}</div>
</div></section>
<section aria-labelledby="why"><div class="wrap">
<h2 id="why">ليش المرضى بيرجعولنا</h2>
<div class="grid">
<article class="card"><h3>بلا وجع قد ما فينا</h3><p>تخدير موضعي حديث وشرح لكل خطوة.</p></article>
<article class="card"><h3>تعقيم كامل</h3><p>أدوات معقّمة لكل مريض، حسب المعايير الدولية.</p></article>
<article class="card"><h3>أسعار واضحة</h3><p>بتعرف الكلفة قبل العلاج، وفي تقسيط لبعض العلاجات.</p></article>
</div></div></section>
<section id="how" class="alt" aria-labelledby="hw"><div class="wrap">
<h2 id="hw">كيف تحجز</h2>
<ol class="steps"><li><b>ابعت رسالة</b><br>عالواتساب، قلّنا شو بدك.</li><li><b>منقترح موعد</b><br>بنفس اليوم أو اليوم يلّي بعدو.</li><li><b>تذكير قبل بيوم</b><br>رسالة تذكير أوتوماتيكية.</li></ol>
</div></section>
<section id="faq" aria-labelledby="fq"><div class="wrap">
<h2 id="fq">أسئلة متكررة</h2>
<details><summary>قديش بتاخد زراعة السن؟</summary><p>عادة على مرحلتين خلال [المدة]؛ منشرحلك كل شي بالزيارة الأولى.</p></details>
<details><summary>في مواقف سيارات؟</summary><p>[معلومات المواقف]</p></details>
<details><summary>بتستقبلو أطفال؟</summary><p>إيه، فحص وتنظيف للأطفال من عمر [العمر].</p></details>
</div></section>
<section id="contact" class="alt" aria-labelledby="ct"><div class="wrap">
<h2 id="ct">الدوام والموقع</h2>
<div class="contact">
<div class="box"><h3>الدوام</h3><p>[الإثنين – الجمعة: …]<br>[السبت: …]</p><p><a class="btn" href="https://wa.me/${digits}">احجز هلّق</a></p></div>
<div class="map" role="img" aria-label="مكان الخريطة">[خريطة Google للعيادة]</div>
</div></div></section>
</main>
<footer><div class="wrap">© ${new Date().getFullYear()} ${n} · <a href="tel:+${digits}">+${digits}</a></div></footer>
<div class="bar"><a class="btn" href="https://wa.me/${digits}">واتساب</a><a class="btn ghost" href="tel:+${digits}">اتصال</a></div>
</body>
</html>`;
}
