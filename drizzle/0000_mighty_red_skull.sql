CREATE TABLE "loadforge_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loadforge_load_test" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(256) NOT NULL,
	"urls" jsonb NOT NULL,
	"concurrency_pattern" jsonb NOT NULL,
	"duration" integer NOT NULL,
	"ramp_up_time" integer NOT NULL,
	"ramp_down_time" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "loadforge_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "loadforge_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "loadforge_setting" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(256) NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "loadforge_setting_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "loadforge_test_phase" (
	"id" varchar PRIMARY KEY NOT NULL,
	"test_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"phase_number" integer NOT NULL,
	"total_phases" integer NOT NULL,
	"concurrency" integer NOT NULL,
	"requests" integer NOT NULL,
	"success_count" integer NOT NULL,
	"error_count" integer NOT NULL,
	"percentile" jsonb NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "loadforge_test_phase_test_id_phase_number_unique" UNIQUE("test_id","phase_number")
);
--> statement-breakpoint
CREATE TABLE "loadforge_test_result" (
	"id" varchar PRIMARY KEY NOT NULL,
	"test_id" varchar,
	"user_id" varchar NOT NULL,
	"total_requests" integer NOT NULL,
	"successful_requests" integer NOT NULL,
	"failed_requests" integer NOT NULL,
	"avg_response_time" integer NOT NULL,
	"min_response_time" integer NOT NULL,
	"max_response_time" integer NOT NULL,
	"p50_response_time" integer NOT NULL,
	"p95_response_time" integer NOT NULL,
	"p99_response_time" integer NOT NULL,
	"requests_per_second" integer NOT NULL,
	"url_breakdown" jsonb NOT NULL,
	"phase_metrics" jsonb NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loadforge_user" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"email" varchar(256) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loadforge_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "loadforge_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loadforge_account" ADD CONSTRAINT "loadforge_account_user_id_loadforge_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."loadforge_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loadforge_load_test" ADD CONSTRAINT "loadforge_load_test_user_id_loadforge_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."loadforge_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loadforge_session" ADD CONSTRAINT "loadforge_session_user_id_loadforge_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."loadforge_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loadforge_test_phase" ADD CONSTRAINT "loadforge_test_phase_test_id_loadforge_load_test_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."loadforge_load_test"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loadforge_test_phase" ADD CONSTRAINT "loadforge_test_phase_user_id_loadforge_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."loadforge_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loadforge_test_result" ADD CONSTRAINT "loadforge_test_result_test_id_loadforge_load_test_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."loadforge_load_test"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loadforge_test_result" ADD CONSTRAINT "loadforge_test_result_user_id_loadforge_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."loadforge_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "loadforge_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "loadforge_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "loadforge_verification" USING btree ("identifier");