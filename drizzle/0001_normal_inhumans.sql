ALTER TABLE "loadforge_load_test" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loadforge_test_phase" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loadforge_test_result" ALTER COLUMN "user_id" DROP NOT NULL;