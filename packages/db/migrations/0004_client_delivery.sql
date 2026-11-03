CREATE TYPE "public"."booking_status" AS ENUM('requested', 'confirmed', 'declined', 'done', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('onboarding', 'active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('received', 'pending', 'draft', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"client_id" text NOT NULL,
	"conversation_id" text,
	"name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"service" text DEFAULT '' NOT NULL,
	"preferred_time" text DEFAULT '' NOT NULL,
	"starts_at" timestamp with time zone,
	"status" "booking_status" DEFAULT 'requested' NOT NULL,
	"reminded_at" timestamp with time zone,
	"review_requested_at" timestamp with time zone,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"client_id" text NOT NULL,
	"kind" text NOT NULL,
	"period" text DEFAULT '' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"client_id" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"phone" text NOT NULL,
	"opt_in" boolean DEFAULT false NOT NULL,
	"last_visit" timestamp with time zone,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"client_id" text NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"rating" integer,
	"text" text NOT NULL,
	"reply" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"vertical" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT 'Asia/Beirut' NOT NULL,
	"status" "client_status" DEFAULT 'onboarding' NOT NULL,
	"problem_id" text,
	"notes" text DEFAULT '' NOT NULL,
	"knowledge" jsonb,
	"knowledge_at" timestamp with time zone,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"demo_token" text NOT NULL,
	"wa_phone_number_id" text DEFAULT '' NOT NULL,
	"wa_token_enc" text,
	"wa_app_secret_enc" text,
	"wa_verify_token" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"client_id" text NOT NULL,
	"channel" text NOT NULL,
	"contact" text NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"handoff" boolean DEFAULT false NOT NULL,
	"handoff_reason" text DEFAULT '' NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"client_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"text" text NOT NULL,
	"status" "message_status" DEFAULT 'received' NOT NULL,
	"intent" text DEFAULT '' NOT NULL,
	"confidence" real,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_artifacts" ADD CONSTRAINT "client_artifacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_artifacts" ADD CONSTRAINT "client_artifacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reviews" ADD CONSTRAINT "client_reviews_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reviews" ADD CONSTRAINT "client_reviews_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_client_idx" ON "bookings" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "client_artifacts_idx" ON "client_artifacts" USING btree ("client_id","kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "client_contacts_uq" ON "client_contacts" USING btree ("client_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_demo_uq" ON "clients" USING btree ("demo_token");--> statement-breakpoint
CREATE INDEX "clients_ws_idx" ON "clients" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "clients_wa_phone_idx" ON "clients" USING btree ("wa_phone_number_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_uq" ON "conversations" USING btree ("client_id","channel","contact");--> statement-breakpoint
CREATE INDEX "conversations_last_idx" ON "conversations" USING btree ("client_id","last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_external_uq" ON "messages" USING btree ("client_id","external_id");--> statement-breakpoint
CREATE INDEX "messages_conv_idx" ON "messages" USING btree ("conversation_id","created_at");