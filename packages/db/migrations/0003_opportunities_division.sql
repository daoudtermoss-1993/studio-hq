ALTER TABLE "brand_profiles" ADD COLUMN "service_catalog" text DEFAULT 'speed-fix | إصلاح السرعة والموبايل | $250 | ضغط الصور، كاش و CDN، إصلاح الموبايل، تقرير قبل/بعد بالأرقام
new-site | موقع جديد سريع | $700 + $25/شهر | تصميم كامل، حجز عالواتساب، SEO محلي، استضافة وصيانة
google-profile | ملف Google والتقييمات | $150 + $40/شهر | تصليح الملف، صور، ردود على التقييمات كل أسبوع
whatsapp-booking | حجز وتذكير عالواتساب | $400 + $30/شهر | رد أوتوماتيكي، حجز مواعيد، تذكير قبل الموعد' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "opp_vertical" text DEFAULT 'عيادات أسنان' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "opp_city" text DEFAULT 'بيروت' NOT NULL;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "kind" text DEFAULT 'problem' NOT NULL;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "place_id" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "website" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "phone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "rating" real;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "reviews" integer;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "google_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "audit" jsonb;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "design" jsonb;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "offer" jsonb;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "preview_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "problems_preview_uq" ON "problems" USING btree ("preview_token");--> statement-breakpoint
CREATE INDEX "problems_ws_place_idx" ON "problems" USING btree ("workspace_id","place_id");