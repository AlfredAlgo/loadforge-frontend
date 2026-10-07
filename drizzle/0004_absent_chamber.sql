CREATE TABLE "loadforge_environment" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"team_id" varchar,
	"name" varchar(256) NOT NULL,
	"base_url" varchar(2048) NOT NULL,
	"headers" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loadforge_sign_off" (
	"id" varchar PRIMARY KEY NOT NULL,
	"test_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"decision" varchar(32) NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loadforge_team" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loadforge_load_test" ADD COLUMN "team_id" varchar;--> statement-breakpoint
ALTER TABLE "loadforge_user" ADD COLUMN "role" varchar(32) DEFAULT 'tester' NOT NULL;--> statement-breakpoint
ALTER TABLE "loadforge_user" ADD COLUMN "team_id" varchar;--> statement-breakpoint
ALTER TABLE "loadforge_environment" ADD CONSTRAINT "loadforge_environment_user_id_loadforge_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."loadforge_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loadforge_environment" ADD CONSTRAINT "loadforge_environment_team_id_loadforge_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."loadforge_team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loadforge_sign_off" ADD CONSTRAINT "loadforge_sign_off_test_id_loadforge_load_test_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."loadforge_load_test"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loadforge_sign_off" ADD CONSTRAINT "loadforge_sign_off_user_id_loadforge_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."loadforge_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loadforge_load_test" ADD CONSTRAINT "loadforge_load_test_team_id_loadforge_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."loadforge_team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loadforge_user" ADD CONSTRAINT "loadforge_user_team_id_loadforge_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."loadforge_team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- One-time bootstrap: every existing user defaults to 'tester' (see the
-- column default above), so without this nobody could reach the new
-- admin-only screens after this migration runs. Promotes the known demo
-- account; harmless no-op if that account doesn't exist in a given
-- environment. Further admins are then promoted from Settings → Team
-- Management by an existing admin.
UPDATE "loadforge_user" SET "role" = 'admin' WHERE "email" = 'alfred@algorhythmlab.com';