# Studio HQ

**شركة محتوى كاملة… موظفوها ذكاء اصطناعي.** أنت تسجّل وتوافق فقط، والفريق يعمل الباقي.
*A full content company staffed by AI agents. You record and approve; the team does everything else.*

| الشاشة | ماذا فيها |
|---|---|
| المكتب المباشر | 12 موظف + المدير، الضوء يضيء لمن يعمل، المهمة والأداة الحالية، المستوى (متدرّب ← أسطورة) |
| دورك اليوم | ريلز للتسجيل (مع رابط التلقين)، مونتاج ينتظر موافقتك، أسئلة، نشر اليوم، دروس الاجتماع |
| الريل | الهوكات، السكربت، التدقيق، رفع التسجيل، الفيديو بعد المونتاج، الكابشن، الغلاف، موافقة أو طلب تعديل، إعادة التدوير |
| التلقين | شاشة كاملة، سرعة، حجم، مرآة، مسافة = تشغيل/إيقاف |
| الاجتماع | كل أحد: دروس مقترحة من أرقامك وتعديلاتك ← توافق ← الموظف يرتقي ويعمل أفضل |
| الأرقام | استيراد CSV من Meta / TikTok / YouTube، وتعليقات ← ردود جاهزة + لائحة رسائل خاصة |
| مختبر الـ Viral | كل يوم: أقوى الفيديوهات بمجالك (YouTube Data API + بحث ويب لـ TikTok / Instagram) مع السرعة ونسبة التفوّق، تحليل ليش انتشرت، ونسختنا **الأصلية** منها |
| التوأم الرقمي | نسخة منك على HeyGen تقدّم الريلز بدالك؛ المدير يقرّر لكل ريل أنت أو التوأم، وتذكير بعلامة الـ AI عند النشر |
| الاستراتيجية | خطة لكل منصّة حسب بلدك: دور المنصّة، طريق الربح المتاح فعلاً، الهدف الجاي، ومصادر الدخل؛ وقرار مكتوب لكل ريل |

## Architecture

```
apps/web        Next.js 15 (App Router, RTL Arabic + English), auth, UI, uploads, file streaming
apps/worker     background worker: job queue, daily 07:30 / Sunday 10:00 cron per brand timezone
  tools/edit_reel.py   silence cut + Whisper subtitles + 9:16 export (ffmpeg)
packages/core   the company: agents, skills, Claude API calls (validated structured output),
                CEO pipeline, Postgres job queue, storage (local / S3), brief, office state
packages/db     Drizzle ORM schema + SQL migrations (PostgreSQL)
```

Reel pipeline (`packages/core/src/pipeline.ts`):

```
trend-scout → content-strategist → hook-writer → scriptwriter → fact-checker → READY TO RECORD
   (owner records) → video-editor → caption-writer ∥ cover-designer → NEEDS APPROVAL
   (owner approves / asks changes → CEO routes them) → scheduler ∥ repurposer → SCHEDULED → posted
weekly: CEO meeting → proposed lessons → owner approves → appended to the agents' prompts (level up)

daily, before planning: CEO strategy (weekly refresh) → viral-hunter (web search + YouTube API) → viral-analyst
  → strategist picks ideas + analyzed viral references and writes a decision per reel (presenter, platforms, goal, money)
presenter = avatar: fact-checked script → digital-twin (HeyGen job, polled) → recorded → normal edit → approval
owner can reject at any step; rejection reasons feed the weekly meeting
```

**Originality rule:** the team learns the *recipe* of viral videos (hook, structure, pacing) and writes original
versions. It never downloads or reuses anyone's footage, audio or wording — platforms down-rank or demonetize reposts.

- Each agent returns JSON through a forced `submit` tool, validated with zod before anything is saved.
- `trend-scout` and `fact-checker` use Claude's web search tool.
- Jobs of one workspace run one at a time; different workspaces run in parallel (`FOR UPDATE SKIP LOCKED`).
- `AI_PROVIDER=mock` runs the whole product without an API key (demos, tests).

## Engineering division (solutions)

Eight more agents turn real public problems into paid work, on two tracks: **SMB** (small businesses drowning in manual work)
and **technical** (engineers stuck on automation, AI, networking, software).

| Agent | Does | Tools |
|---|---|---|
| Problem hunter | Finds fresh public problems daily | web search, Stack Exchange, Hacker News, GitHub Issues, Reddit |
| Chief engineer | Qualifies: can we solve it, fit, value, effort, price, who owns it | web search + fetch |
| Automation / AI / Network / Software engineers | Design the solution, then build and **run** a small demo | web search + fetch, code sandbox, assigned MCP connectors |
| Security reviewer | Reviews the solution and demo before anything leaves | code sandbox |
| Outreach writer | One personal message + follow-up + a helpful public reply | — |

Flow: `hunt-problems` → `qualify-problem` → `solve-problem` (solution → tested demo → security review → outreach) →
the owner sends the message and moves the deal (contacted → replied → won/lost) → "make a reel" turns it into an
anonymized problem → solution video. Nothing is ever sent by an agent.

**Connectors** (`/app/connectors`): add any remote MCP server (https), choose which agents can use it; tokens are
AES-256-GCM encrypted with `APP_SECRET` and only decrypted in the worker when calling the Claude API (MCP connector beta).
Prefer read-only connectors. Built-in sources show whether their key is set.

**Skills**: every engineer has an expert playbook in `packages/core/src/skills.ts` (engineering, automation, ai-engineering,
network, software, security, outreach) plus the lessons the owner approves in the weekly meeting.

## Opportunities division (websites & local presence)

Instead of waiting for someone to post a problem, the team finds local businesses (default: dental clinics in Beirut — editable on
the Solutions page) and prepares an offer they can say yes to.

| Agent | Does | Tools |
|---|---|---|
| Opportunity scout | Finds businesses of a type in a city | Google Places API (New), or web search without a key |
| Website auditor | Explains the **measured** audit in plain words, picks the package | PageSpeed Insights (mobile), TLS, one homepage fetch (code, not the model) |
| Lead designer (UI + backend) | Visual system + a complete responsive homepage (real HTML) + the architecture, stack, cost and build plan | quality gate, software + security skills |
| Outreach writer | One personal WhatsApp message with a measured fact and the private concept link | — |

Flow: `hunt-opportunities` → `audit-site` (score 0–100 in code: speed 35, booking/contact 20, trust 15, mobile 15, Google visibility 15;
sites ≥ 80 without serious findings are skipped) → `design-site` (HTML must pass `checkMockup`: one h1, ≥4 sections, wa.me/tel CTA,
responsive, no JS, no external images, < 120 KB; one automatic fix round) → fixed-price offer from the service catalog in settings →
message. The concept is served at `/p/<token>`: unlisted, `noindex`, sandbox CSP (no scripts, opaque origin) and a fixed
"concept — not the official website" banner.

Guardrails: passive checks only (no vulnerability scanning of sites we don't own); fetches are restricted to public addresses
(SSRF guard, redirects re-checked, robots.txt respected); Google Places content other than `place_id` is cleared after 30 days
unless the owner is in contact with the business (`purgeGoogleData`, daily). Hunting is manual (button) so you control the spend.

## Run locally

Requirements: Node 22, pnpm 10, PostgreSQL 16, ffmpeg, Python 3 (+ `pip install faster-whisper` for subtitles).

```bash
cp .env.example .env            # set ANTHROPIC_API_KEY (or AI_PROVIDER=mock)
pnpm install
pnpm db:migrate
pnpm dev                        # web on http://localhost:3000 + worker
```

Load `.env` in your shell first (`set -a; source .env; set +a`) or use your process manager.

## Deploy (one server, Docker)

```bash
cp .env.example .env            # ANTHROPIC_API_KEY, POSTGRES_PASSWORD, S3 keys, APP_URL
docker compose up -d --build    # postgres + minio + migrate + web + worker
```

Put a reverse proxy (Caddy / Nginx) with HTTPS in front of port 3000. For production storage you can
point `S3_*` at AWS S3 or Cloudflare R2 instead of MinIO.

## Tests

```bash
createdb studio_test
pnpm test                       # integration: full reel lifecycle with real DB + ffmpeg, mock AI
# end-to-end (app + worker running with AI_PROVIDER=mock):
BASE_URL=http://localhost:3000 SAMPLE_VIDEO=./sample.mp4 node apps/web/e2e/smoke.mjs
```

## Roadmap

1. Direct publishing + metrics via Meta / TikTok / YouTube APIs (today: owner posts, metrics by CSV)
   — publishing stays behind the owner's explicit approval
2. Billing (Stripe), plans, usage limits per plan
3. Team members & roles per workspace, multiple brands per account
4. Mobile recording app with the teleprompter
5. Skills marketplace between users
