CREATE TABLE "loadforge_test_claim" (
	"id" varchar PRIMARY KEY NOT NULL,
	"test_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"requirement" varchar(512) NOT NULL,
	"claim" text NOT NULL,
	"verdict" varchar(32) DEFAULT 'met' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loadforge_test_claim" ADD CONSTRAINT "loadforge_test_claim_test_id_loadforge_load_test_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."loadforge_load_test"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loadforge_test_claim" ADD CONSTRAINT "loadforge_test_claim_user_id_loadforge_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."loadforge_user"("id") ON DELETE no action ON UPDATE no action;