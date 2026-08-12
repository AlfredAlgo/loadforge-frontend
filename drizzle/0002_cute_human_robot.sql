ALTER TABLE "loadforge_load_test" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "loadforge_load_test" ALTER COLUMN "urls" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loadforge_load_test" ALTER COLUMN "concurrency_pattern" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loadforge_load_test" ALTER COLUMN "duration" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loadforge_load_test" ALTER COLUMN "ramp_up_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loadforge_load_test" ALTER COLUMN "ramp_down_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loadforge_test_phase" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "loadforge_test_result" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "loadforge_load_test" ADD COLUMN "type" varchar(32) DEFAULT 'url' NOT NULL;--> statement-breakpoint
ALTER TABLE "loadforge_load_test" ADD COLUMN "mode" varchar(32);--> statement-breakpoint
ALTER TABLE "loadforge_load_test" ADD COLUMN "users" integer;--> statement-breakpoint
ALTER TABLE "loadforge_load_test" ADD COLUMN "jmx_filename" varchar(512);--> statement-breakpoint
ALTER TABLE "loadforge_load_test" ADD COLUMN "file_id" varchar(64);
