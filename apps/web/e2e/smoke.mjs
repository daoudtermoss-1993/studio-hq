// End-to-end smoke test: run against a live app + worker started with AI_PROVIDER=mock.
//   BASE_URL=http://localhost:3000 SAMPLE_VIDEO=/path/raw.mp4 SHOTS=./shots node e2e/smoke.mjs
import { mkdirSync } from "node:fs";
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

  console.log(JSON.stringify({ ok: true, pageErrors: errors, mobileOverflow: overflow }));
} catch (e) {
  await shot("error");
  console.log(JSON.stringify({ ok: false, error: String(e), pageErrors: errors }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
