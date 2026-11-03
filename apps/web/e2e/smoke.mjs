// End-to-end smoke test: run against a live app + worker started with AI_PROVIDER=mock.
//   BASE_URL=http://localhost:3000 SAMPLE_VIDEO=/path/raw.mp4 SHOTS=./shots node e2e/smoke.mjs
import { mkdirSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS ?? "./e2e-shots";
const VIDEO = process.env.SAMPLE_VIDEO;
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const step = (s) => console.log("•", s);
let previewOverflow = null;
let demoOverflow = null;
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

async function waitFor(fn, label, timeout = 120_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    await page.reload();
    if (await fn()) return;
    await page.waitForTimeout(2000);
  }
  throw new Error(`timeout: ${label}`);
}

try {
  step("landing");
  await page.goto(BASE);
  await shot("01-landing");

  step("sign up");
  await page.goto(`${BASE}/signup`);
  await page.fill("#name", "Daoud");
  await page.fill("#email", `daoud+${Date.now()}@example.com`);
  await page.fill("#password", "correct-horse-1");
  await Promise.all([page.waitForURL("**/onboarding"), page.click("button[type=submit], form button")]);

  step("onboarding");
  await page.fill("#studioName", "استوديو داود");
  await page.fill("#niche", "أدوات الذكاء الاصطناعي للمحترفين العرب");
  await page.fill("#audience", "موظفين وأصحاب مشاريع بين 22 و40 سنة بالعالم العربي");
  await page.fill("#pillars", "أدوات\nقصص\nنصائح شغل");
  await page.fill("#ctaKeyword", "مدير");
  await page.fill("#ctaReward", "البرومبت الكامل");
  await shot("02-onboarding");
  await Promise.all([page.waitForURL("**/app"), page.click("text=أنشئ الاستوديو وابدأ")]);

  step("team writes the first reels (worker)");
  await waitFor(async () => (await page.locator("text=سجّل ريل").count()) >= 2, "2 reels ready to record");
  await shot("03-dashboard");

  step("reel page + teleprompter");
  await page.goto(`${BASE}/app/reels/1`);
  await shot("04-reel-ready");
  await page.goto(`${BASE}/tp/1`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/05-teleprompter.png` });

  if (VIDEO) {
    step("upload recording");
    await page.goto(`${BASE}/app/reels/1`);
    await page.setInputFiles("[data-testid=recording-input]", VIDEO);
    await waitFor(async () => (await page.locator("text=موافقة وجدولة").count()) > 0, "edit ready", 180_000);
    await shot("06-reel-edited");

    step("approve");
    await page.click("text=موافقة وجدولة");
    await waitFor(async () => (await page.locator("text=مجدول في").count()) > 0, "scheduled");
    await shot("07-reel-scheduled");
  }

  step("viral lab");
  await page.goto(`${BASE}/app/viral`);
  await waitFor(async () => (await page.locator("button:has-text('اعملو ريل إلنا')").count()) > 0, "analyzed viral finds");
  await shot("08a-viral");

  step("strategy");
  await page.goto(`${BASE}/app/strategy`);
  await shot("08b-strategy");

  step("digital twin: switch presenter, adopt a viral video");
  await page.goto(`${BASE}/app/settings`);
  await page.check("input[name=presenterMode][value=avatar]");
  await page.click("text=حفظ");
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/app/viral`);
  await Promise.all([page.waitForURL("**/app/reels/*"), page.locator("button:has-text('اعملو ريل إلنا')").first().click()]);
  await waitFor(async () => (await page.locator("text=لا أوافق").count()) > 1 || (await page.locator("text=موافقة وجدولة").count()) > 0, "twin video edited", 180_000);
  await shot("08c-twin-reel");
  await page.fill("input[name=reason] >> nth=-1", "مش هلّق");
  await page.locator("button:has-text('لا أوافق')").last().click();
  await waitFor(async () => (await page.locator("text=مرفوض").count()) > 0, "rejected");

  step("engineering division: hunt → qualify → solve");
  await page.goto(`${BASE}/app/solutions`);
  await page.click("text=دوّر على مشاكل هلّق");
  await waitFor(async () => (await page.locator("a .chip:text-is('الحل جاهز')").count()) > 0, "a solved problem", 180_000);
  await shot("08d-solutions");
  await page.locator("a:has(.chip:text-is('الحل جاهز'))").first().click();
  await page.waitForURL("**/app/solutions/*");
  await shot("08e-problem");
  await page.click("button:has-text('بعتّ الرسالة')");
  await page.waitForTimeout(800);
  await page.fill("#value", "400");
  await page.fill("#note", "قبل بالعرض");
  await page.click("button:has-text('صار زبون')");
  await waitFor(async () => (await page.locator(".chip:text-is('زبون ✓')").count()) > 0, "deal won");
  await Promise.all([page.waitForURL("**/app/reels/*"), page.click("button:has-text('اعمل منها ريل')")]);

  step("connectors");
  await page.goto(`${BASE}/app/connectors`);
  await page.fill("#cname", "docs-search");
  await page.fill("#curl", "https://mcp.example.com/mcp");
  await page.fill("#ctoken", "secret-token");
  await page.click("button:has-text('ضيف connector')");
  await waitFor(async () => (await page.locator("text=docs-search").count()) > 0, "connector listed");
  if ((await page.content()).includes("secret-token")) throw new Error("token leaked to the page");
  await shot("08f-connectors");

  step("opportunities: hunt clinics → measured audit → design → offer");
  await page.goto(`${BASE}/app/solutions`);
  await page.click("button:has-text('دوّر على محلات وافحصن')");
  const clinic = "a:has-text('عيادة د. سمير للأسنان')";
  await waitFor(async () => (await page.locator(`${clinic} .chip:text-is('الحل جاهز')`).count()) > 0, "clinic offer ready", 180_000);
  await shot("08g-opportunities");
  await Promise.all([page.waitForURL("**/app/solutions/*"), page.locator(clinic).first().click()]);
  await page.waitForTimeout(1500);
  await shot("08h-clinic");
  const href = await page.locator("a:has-text('افتح التصوّر')").getAttribute("href");
  const res = await page.request.get(`${BASE}${href}`);
  const csp = res.headers()["content-security-policy"] ?? "";
  const body = await res.text();
  if (!csp.includes("sandbox") || !body.includes("مش الموقع الرسمي") || /<script/i.test(body)) throw new Error("concept preview is not sandboxed/bannered");
  const pv = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await pv.goto(`${BASE}${href}`);
  await pv.waitForTimeout(1000);
  await pv.screenshot({ path: `${SHOTS}/08i-concept-mobile.png`, fullPage: true });
  previewOverflow = await pv.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  await pv.setViewportSize({ width: 1440, height: 900 });
  await pv.waitForTimeout(500);
  await pv.screenshot({ path: `${SHOTS}/08j-concept-desktop.png` });
  await pv.close();

  step("audit a pasted site");
  await page.goto(`${BASE}/app/solutions`);
  await page.fill("#siteurl", "my-clinic-fast.example");
  await Promise.all([page.waitForURL("**/app/solutions/*"), page.click("button:has-text('افحص موقع')")]);
  await waitFor(async () => (await page.locator(".chip:text-is('مرفوضة')").count()) > 0, "good site skipped");

  step("client delivery: win the clinic → client → knowledge base → 30-question test");
  await page.goto(`${BASE}/app/solutions`);
  await Promise.all([page.waitForURL("**/app/solutions/*"), page.locator("a:has-text('عيادة د. سمير للأسنان')").first().click()]);
  await page.fill("#value", "700");
  await page.click("button:has-text('صار زبون')");
  await waitFor(async () => (await page.locator("button:has-text('حوّلو لزبون')").count()) > 0, "won");
  await Promise.all([page.waitForURL("**/app/clients/*"), page.click("button:has-text('حوّلو لزبون')")]);
  const clientUrl = page.url();
  const clientId = clientUrl.split("/app/clients/")[1].split("?")[0];
  await waitFor(async () => (await page.locator("text=/\\d+\\/30/").count()) > 0, "evaluation done", 180_000);
  await page.locator("button:has-text('قديش سعر التبييض؟')").first().click();
  await page.waitForSelector("div[class*='bg-[#202c33]'][dir='auto']:has-text('بتحب احجزلك موعد')", { timeout: 60_000 });
  await page.waitForTimeout(300);
  await shot("08k-client-assistant");

  step("public demo on a phone");
  const demoHref = await page.locator("a[href^='/a/']").first().getAttribute("href");
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  phone.on("pageerror", (e) => errors.push(`demo: ${e.message}`));
  await phone.goto(`${BASE}${demoHref}`);
  await phone.locator("button:has-text('شو دوامكن؟')").click();
  await phone.waitForSelector("text=09:00", { timeout: 60_000 });
  await phone.fill("input[placeholder='اكتب رسالة…']", "Vous êtes où ?");
  await phone.click("button:has-text('ابعت')");
  await phone.waitForSelector("text=Nous sommes", { timeout: 60_000 });
  await phone.waitForTimeout(400);
  await phone.screenshot({ path: `${SHOTS}/08l-demo-phone.png` });
  demoOverflow = await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  await phone.close();

  step("WhatsApp: connect, signed webhook → draft reply + booking request");
  await page.goto(`${clientUrl.split("?")[0]}?tab=settings`);
  await page.fill("#pnid", "1234567890");
  await page.fill("#was", "e2e-app-secret");
  await page.locator("form:has(#pnid) button:has-text('احفظ')").click();
  await page.waitForTimeout(800);
  const wa = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "1234567890" }, contacts: [{ wa_id: "96170111222", profile: { name: "Rim" } }],
    messages: [{ from: "96170111222", id: `wamid.${Date.now()}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "اسمي ريم بدي احجز موعد تنظيف بكرا الساعة 5" } }] } }] }] });
  const bad = await page.request.post(`${BASE}/api/wa/${clientId}`, { data: wa, headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=00" } });
  if (bad.status() !== 401) throw new Error(`unsigned webhook accepted: ${bad.status()}`);
  const ok = await page.request.post(`${BASE}/api/wa/${clientId}`, { data: wa, headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${createHmac("sha256", "e2e-app-secret").update(wa).digest("hex")}` } });
  if (ok.status() !== 200) throw new Error(`signed webhook rejected: ${ok.status()}`);
  await page.goto(`${clientUrl.split("?")[0]}?tab=inbox`);
  await waitFor(async () => (await page.locator("button:has-text('وافق وابعت')").count()) > 0, "WhatsApp draft reply");
  await shot("08m-client-inbox");
  await page.goto(`${clientUrl.split("?")[0]}?tab=bookings`);
  await shot("08n-client-bookings");
  await page.goto(`${clientUrl.split("?")[0]}?tab=report`);
  await page.click("button:has-text('اعمل تقرير هالشهر')");
  await waitFor(async () => (await page.locator("text=رسائل زباين").count()) > 0, "monthly report");
  await shot("08o-client-report");

  step("weekly meeting");
  await page.goto(`${BASE}/app/meeting`);
  await page.click("text=اعقد الاجتماع الآن");
  await waitFor(async () => (await page.locator("button:has-text('اعتمد')").count()) > 0, "lessons proposed");
  await shot("08-meeting");
  await page.locator("button:has-text('اعتمد')").first().click();
  await page.waitForTimeout(1000);

  step("board, office, english");
  await page.goto(`${BASE}/app/reels`);
  await shot("09-board");
  await page.goto(`${BASE}/app/office`);
  await page.waitForTimeout(1500);
  await shot("10-office");
  await page.goto(`${BASE}/app`);
  await page.click("text=English");
  await page.waitForTimeout(800);
  await shot("11-dashboard-en");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.context().addCookies(await page.context().cookies());
  await mobile.goto(`${BASE}/app`);
  await mobile.waitForTimeout(800);
  await mobile.screenshot({ path: `${SHOTS}/12-mobile.png` });
  let overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  for (const path of ["/app/solutions", "/app/connectors"]) {
    await mobile.goto(`${BASE}${path}`);
    await mobile.waitForTimeout(500);
    overflow ||= await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  }
  await mobile.screenshot({ path: `${SHOTS}/13-mobile-connectors.png`, fullPage: true });

  console.log(JSON.stringify({ ok: true, pageErrors: errors, mobileOverflow: overflow, conceptMobileOverflow: previewOverflow, demoMobileOverflow: demoOverflow }));
} catch (e) {
  await shot("error");
  console.log(JSON.stringify({ ok: false, error: String(e), pageErrors: errors }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
