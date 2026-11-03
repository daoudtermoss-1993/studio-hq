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
