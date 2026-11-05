CREATE TYPE "public"."engagement_stage" AS ENUM('lead', 'proposal', 'assessment', 'pilot', 'retainer', 'closed', 'lost');--> statement-breakpoint
CREATE TABLE "engagement_interviews" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"engagement_id" text NOT NULL,
	"role" text NOT NULL,
	"person" text DEFAULT '' NOT NULL,
	"notes" text NOT NULL,
	"synthesis" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagements" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"company" text NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"sector" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"size" text DEFAULT '' NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"contact_role" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'network' NOT NULL,
	"market" text DEFAULT 'lebanon' NOT NULL,
	"language" text DEFAULT 'Lebanese Arabic' NOT NULL,
	"stage" "engagement_stage" DEFAULT 'lead' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"research" jsonb,
	"opportunities" jsonb,
	"proposal" jsonb,
	"pilot_proposal" jsonb,
	"pilot" jsonb,
	"pilot_report" jsonb,
	"demo" jsonb,
	"review" jsonb,
	"prices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"value" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "consulting_catalog" text DEFAULT 'assessment | تقييم فرص الـ AI (أسبوعين) | $2,000 | مقابلات ومراقبة، تحليل الداتا، 3 لـ 5 فرص بالأرقام، demo، توصية بتجربة
pilot | تجربة تنفيذ (4 لـ 6 أسابيع) | $8,000 | حل واحد شغّال بمحيط الزبون، وضع المسودة، قياس قبل وبعد، تسليم وتدريب
retainer | اشتراك شهري | $1,000/شهر | صيانة وتحسين، تقرير شهري بالأرقام، فرصة جديدة كل 3 أشهر' NOT NULL;--> statement-breakpoint
ALTER TABLE "engagement_interviews" ADD CONSTRAINT "engagement_interviews_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_interviews" ADD CONSTRAINT "engagement_interviews_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "engagement_interviews_idx" ON "engagement_interviews" USING btree ("engagement_id","created_at");--> statement-breakpoint
CREATE INDEX "engagements_ws_stage_idx" ON "engagements" USING btree ("workspace_id","stage");