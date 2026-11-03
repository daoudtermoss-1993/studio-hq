CREATE TYPE "public"."viral_status" AS ENUM('new', 'analyzed', 'adopted', 'dismissed');--> statement-breakpoint
ALTER TYPE "public"."reel_status" ADD VALUE 'rendering' BEFORE 'recorded';--> statement-breakpoint
ALTER TYPE "public"."reel_status" ADD VALUE 'rejected';--> statement-breakpoint
CREATE TABLE "strategy_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"plan" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "viral_finds" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"platform" text NOT NULL,
	"url" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"creator" text DEFAULT '' NOT NULL,
	"views" integer,
	"likes" integer,
	"comments" integer,
	"creator_followers" integer,
	"published_at" timestamp with time zone,
	"velocity" integer,
	"outlier" integer,
	"source" text DEFAULT 'web' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"analysis" jsonb,
	"status" "viral_status" DEFAULT 'new' NOT NULL,
	"reel_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "country" text DEFAULT 'LB' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "goals" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "presenter_mode" text DEFAULT 'self' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "avatar_provider" text DEFAULT 'heygen' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "avatar_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "voice_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "reels" ADD COLUMN "presenter" text DEFAULT 'self' NOT NULL;--> statement-breakpoint
ALTER TABLE "reels" ADD COLUMN "ai_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reels" ADD COLUMN "viral_id" text;--> statement-breakpoint
ALTER TABLE "reels" ADD COLUMN "decision" jsonb;--> statement-breakpoint
ALTER TABLE "reels" ADD COLUMN "avatar_job" jsonb;--> statement-breakpoint
ALTER TABLE "strategy_reports" ADD CONSTRAINT "strategy_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viral_finds" ADD CONSTRAINT "viral_finds_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "viral_ws_url_uq" ON "viral_finds" USING btree ("workspace_id","url");--> statement-breakpoint
CREATE INDEX "viral_ws_status_idx" ON "viral_finds" USING btree ("workspace_id","status");