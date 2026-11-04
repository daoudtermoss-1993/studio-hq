import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, brandProfiles, db, eq, jobs, memberships, pool, problems, runMigrations, users, workspaces } from "@studio/db";
import {
  addSiteToAudit, analyzeHtml, assertPublicUrl, checkMockup, claimNext, complete, huntOpportunities, inspectSite, mockSiteFacts,
  parseCatalog, purgeGoogleData, runJob, sanitizeMockup, scoreSite, withConceptBanner,
} from "../src";
import { mockHomepage } from "../src/mock-site";

let wsId = "";
let server: Server;
let base = "";

const SLOW_PAGE = `<!doctype html><html><head><title>Home</title>
<script src="http://cdn.example.com/jquery.js"></script></head><body>
<img src="a.jpg"><img src="b.jpg"><img src="c.jpg"><img src="d.jpg"><p>Dental clinic © 2018</p></body></html>`;
const GOOD_PAGE = `<!doctype html><html lang="en"><head><title>Smile Center Beirut — Dentist</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Dental clinic in Beirut">
<meta property="og:title" content="Smile Center"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Dentist","name":"Smile"}</script>
</head><body><h1>Smile Center</h1><a href="https://wa.me/9611000000">WhatsApp</a><a href="tel:+9611000000">Call</a>
<a href="https://cal.com/smile">Book now</a><img src="x.webp" alt="clinic"><p>© ${new Date().getFullYear()}</p></body></html>`;

async function drain() {
  for (let i = 0; i < 30; i++) {
    const job = await claimNext();
    if (!job) return;
    await runJob(job);
    await complete(job);
  }
}

beforeAll(async () => {
  await runMigrations();
  await db.delete(jobs);
  const stamp = Date.now();
  const [u] = await db.insert(users).values({ email: `opp${stamp}@test.dev`, name: "Opp", passwordHash: "x" }).returning();
  const [w] = await db.insert(workspaces).values({ name: "Opp Studio", slug: `opp-${stamp}` }).returning();
  await db.insert(memberships).values({ userId: u.id, workspaceId: w.id });
  await db.insert(brandProfiles).values({ workspaceId: w.id, niche: "AI for businesses", audience: "clinics", platforms: ["instagram"], pillars: ["حلول"] });
  wsId = w.id;
  server = createServer((req, res) => {
    if (req.url === "/robots.txt") return res.writeHead(404).end();
    if (req.url === "/old") return res.writeHead(301, { Location: "/" }).end();
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(req.headers.host?.includes("127.0.0.1") ? SLOW_PAGE : GOOD_PAGE);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.close();
  await pool().end();
});

describe("audit engine (measured, deterministic)", () => {
  it("reads the signals a local business needs from HTML", () => {
    const good = analyzeHtml(GOOD_PAGE, "https://smile.example/");
    expect(good).toMatchObject({ viewport: true, whatsapp: true, tel: true, booking: true, h1Count: 1, imgNoAlt: 0, lang: "en", openGraph: true });
    expect(good.jsonLdTypes).toContain("Dentist");
    expect(good.platforms).toEqual(expect.arrayContaining(["whatsapp", "cal.com"]));
    expect(analyzeHtml('<a href="https://drapp.me/d/lb/dentistry/x">DrApp</a><a href="https://www.instagram.com/x">IG</a>', "https://x.example/").platforms)
      .toEqual(expect.arrayContaining(["drapp", "instagram"]));
    const slow = analyzeHtml(SLOW_PAGE, "https://old.example/");
    expect(slow).toMatchObject({ viewport: false, whatsapp: false, tel: false, h1Count: 0, imgNoAlt: 4, copyrightYear: 2018, mixedContent: 1 });
  });

  it("scores a slow site low with the right findings, and a healthy one high", () => {
    const bad = scoreSite(mockSiteFacts("https://dr-samir-dental.example"));
    const ids = bad.findings.map((f) => f.id);
    expect(bad.score).toBeLessThan(50);
    expect(ids).toEqual(expect.arrayContaining(["slow-lcp", "no-mobile", "no-whatsapp", "tls-expiring", "mixed-content", "looks-abandoned"]));
    expect(bad.findings[0].severity).toBe("critical");
    expect(bad.findings.find((f) => f.id === "slow-lcp")?.evidence).toBe("LCP 9.4s");
    const good = scoreSite(mockSiteFacts("https://smilecenter-fast.example"));
    expect(good.score).toBeGreaterThanOrEqual(80);
    expect(good.findings.filter((f) => f.severity === "critical" || f.severity === "high")).toHaveLength(0);
  });

  it("blocks private addresses (no SSRF into our own network)", async () => {
    for (const u of ["http://127.0.0.1/", "http://169.254.169.254/latest/meta-data", "http://10.0.0.5/", "http://localhost:5432/", "ftp://example.com/", "https://user:pw@example.com/"]) {
      await expect(assertPublicUrl(u)).rejects.toThrow();
    }
  });

  it("measures a real HTTP site end to end (redirects re-checked, robots respected)", async () => {
    process.env.AUDIT_ALLOW_PRIVATE = "1";
    try {
      const f = await inspectSite(`${base}/old`, { psi: false });
      expect(f.reachable).toBe(true);
      expect(f.finalUrl).toBe(`${base}/`);
      expect(f.https).toBe(false);
      expect(f.ttfbMs).not.toBeNull();
      expect(f.html?.imgNoAlt).toBe(4);
      expect(scoreSite(f).findings.map((x) => x.id)).toContain("no-https");
    } finally {
      delete process.env.AUDIT_ALLOW_PRIVATE;
    }
  });
});

describe("mockup safety + quality gate", () => {
  it("the designer's homepage passes the professional gate", () => {
    expect(checkMockup(mockHomepage("عيادة اختبار", "+961 1 234 567"))).toEqual([]);
  });

  it("rejects scripts, handlers and external images, and sanitizes them away", () => {
    const evil = `<!doctype html><html lang="en"><head><title>x</title></head><body><script>alert(1)</script>
<img src="https://evil.example/x.png" onerror="steal()"><a href="javascript:steal()">x</a><iframe src="https://evil"></iframe></body></html>`;
    const issues = checkMockup(evil);
    expect(issues.join(" ")).toMatch(/JavaScript/);
    expect(issues.join(" ")).toMatch(/external images/);
    const clean = sanitizeMockup(evil);
    expect(clean).not.toMatch(/<script|onerror|javascript:|<iframe/i);
    expect(withConceptBanner(clean, "Studio")).toContain("مش الموقع الرسمي");
  });

  it("parses the fixed-price service catalog", () => {
    const c = parseCatalog("speed-fix | Speed | $250 | images, cache\nbad line\nnew-site | Site | $700 + $25/mo | all");
    expect(c.map((x) => x.id)).toEqual(["speed-fix", "new-site"]);
    expect(c[1].price).toBe("$700 + $25/mo");
  });
});

describe("opportunities pipeline (mock AI, real DB)", () => {
  it("hunts clinics, audits them, designs for the ones worth it, and drafts the offer", async () => {
    const n = await huntOpportunities(wsId, { vertical: "عيادات أسنان", city: "بيروت", limit: 5 });
    expect(n).toBe(3);
    expect(await huntOpportunities(wsId, {})).toBe(0); // same places are not added twice
    await drain();
    const all = await db.select().from(problems).where(and(eq(problems.workspaceId, wsId), eq(problems.kind, "opportunity")));
    const byName = Object.fromEntries(all.map((p) => [p.title, p]));

    const slow = byName["عيادة د. سمير للأسنان"];
    expect(slow.status).toBe("solved");
    expect(slow.audit.score.score).toBeLessThan(50);
    expect(slow.audit.report.recommendedPackage).toBe("speed-fix");
    expect(slow.audit.presence.profiles.map((x: any) => x.platform)).toEqual(expect.arrayContaining(["Google Maps", "DrApp", "Instagram"]));
    expect(slow.audit.presence.alreadyCovered.join(" ")).toMatch(/DrApp/); // we never sell what they already have
    expect(slow.audit.presence.positioning).toBeTruthy();
    expect(checkMockup(slow.design.html)).toEqual([]);
    expect(slow.design.backend.stack.length).toBeGreaterThan(1);
    expect(slow.offer.price).toBe("$250");
    expect(slow.offer.alsoSuggest).toContain("whatsapp-booking");
    expect(slow.previewToken).toBeTruthy();
    expect(slow.outreach.message).toContain(`/p/${slow.previewToken}`);
    expect(slow.solution.summary).toBeTruthy(); // so it can become an anonymized case-study reel

    expect(byName["Smile Center Beirut"].status).toBe("rejected"); // already a good site: no offer

    const noSite = byName["عيادة الأرز لطب الأسنان"];
    expect(noSite.status).toBe("solved");
    expect(noSite.offer.packageId).toBe("new-site");
    expect(noSite.design.html).toContain("wa.me/96130000");
  });

  it("the owner can paste a site to audit", async () => {
    const p = await addSiteToAudit(wsId, { url: "goodclinic-fast.example", name: "Good Clinic" });
    expect(p?.website).toBe("https://goodclinic-fast.example");
    await drain();
    const [row] = await db.select().from(problems).where(eq(problems.id, p!.id));
    expect(row.status).toBe("rejected");
  });

  it("clears Google Places content after 30 days unless the owner is talking to them", async () => {
    const rows = await db.select().from(problems).where(and(eq(problems.workspaceId, wsId), eq(problems.source, "google-maps")));
    const past = new Date(Date.now() - 86_400_000);
    await db.update(problems).set({ googleExpiresAt: past }).where(and(eq(problems.workspaceId, wsId), eq(problems.source, "google-maps")));
    await db.update(problems).set({ status: "contacted" }).where(eq(problems.id, rows[0].id));
    expect(await purgeGoogleData(wsId)).toBe(rows.length - 1);
    const after = await db.select().from(problems).where(and(eq(problems.workspaceId, wsId), eq(problems.source, "google-maps")));
    const kept = after.find((r) => r.id === rows[0].id)!;
    expect(kept.phone).not.toBe("");
    for (const r of after.filter((r) => r.id !== rows[0].id)) {
      expect(r.phone).toBe("");
      expect(r.placeId).toBeTruthy(); // place_id is the one field we may keep
    }
  });
});
