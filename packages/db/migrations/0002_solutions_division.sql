CREATE TYPE "public"."problem_status" AS ENUM('new', 'qualified', 'rejected', 'solving', 'solved', 'contacted', 'replied', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "connectors" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"token_enc" text,
	"agents" text[] DEFAULT '{}' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "problems" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"track" text DEFAULT 'smb' NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"url" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"organization" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"posted_at" timestamp with time zone,
	"votes" integer,
	"status" "problem_status" DEFAULT 'new' NOT NULL,
	"qualification" jsonb,
	"solution" jsonb,
	"demo" jsonb,
	"review" jsonb,
	"outreach" jsonb,
	"deal_value" integer,
	"notes" text DEFAULT '' NOT NULL,
	"reel_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "solution_tracks" text[] DEFAULT '{"smb","technical"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "tech_focus" text DEFAULT 'network automation (Cisco NSO, YANG, NETCONF/RESTCONF), AI & workflow automation' NOT NULL;--> statement-breakpoint
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "problems_ws_url_uq" ON "problems" USING btree ("workspace_id","url");--> statement-breakpoint
CREATE INDEX "problems_ws_status_idx" ON "problems" USING btree ("workspace_id","status");