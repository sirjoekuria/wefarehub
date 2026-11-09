CREATE TYPE "public"."case_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."case_type" AS ENUM('hospital', 'death');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('matched', 'unmatched');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('submitted', 'chairperson_review', 'recommended', 'not_recommended', 'pending_final', 'approved', 'rejected', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."field_type" AS ENUM('text', 'number', 'date', 'dropdown', 'multi', 'checkbox', 'phone', 'file');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('pending', 'active', 'suspended', 'inactive', 'transferred', 'deceased', 'archived');--> statement-breakpoint
CREATE TYPE "public"."official_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'secretary', 'treasurer');--> statement-breakpoint
CREATE TYPE "public"."org_status" AS ENUM('pending', 'active', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rh_payment_status" AS ENUM('pending', 'verified', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."station_role" AS ENUM('chairperson', 'secretary', 'deputy_chairperson');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('pending_payment', 'active', 'renewal_due', 'past_due', 'grace_period', 'suspended', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_email" text DEFAULT 'system' NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"entity_name" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demo_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pickup_point_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"qr_number" text NOT NULL,
	"id_number" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_pickup_qr_unique" UNIQUE("pickup_point_id","qr_number"),
	CONSTRAINT "member_qr_format" CHECK ("members"."qr_number" ~ '^[0-9]{1,12}$'),
	CONSTRAINT "member_phone_format" CHECK ("members"."phone" ~ '^254(7|1)[0-9]{8}$')
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mpesa_receipt" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"payer_phone" text NOT NULL,
	"bill_ref_raw" text NOT NULL,
	"pickup_code_parsed" text,
	"qr_parsed" text,
	"member_id" uuid,
	"status" "payment_status" DEFAULT 'unmatched' NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_mpesa_receipt_unique" UNIQUE("mpesa_receipt"),
	CONSTRAINT "payment_amount_positive" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payment_match_consistency" CHECK (("payments"."status" = 'matched' AND "payments"."member_id" IS NOT NULL) OR ("payments"."status" = 'unmatched' AND "payments"."member_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "pickup_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickup_points_code_unique" UNIQUE("code"),
	CONSTRAINT "pickup_code_format" CHECK ("pickup_points"."code" ~ '^[A-Z][A-Z0-9]{1,15}$')
);
--> statement-breakpoint
CREATE TABLE "welfare_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"case_type" "case_type" NOT NULL,
	"status" "case_status" DEFAULT 'open' NOT NULL,
	"description" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"station_id" integer,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"author" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rh_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer,
	"user_id" integer,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"details" jsonb,
	"ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_custom_field_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"key" varchar(80) NOT NULL,
	"label" text NOT NULL,
	"type" "field_type" DEFAULT 'text' NOT NULL,
	"options" jsonb,
	"required" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"visibility" text DEFAULT 'registration' NOT NULL,
	"help_text" text,
	"form_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fdefs_org_key_uniq" UNIQUE("org_id","key")
);
--> statement-breakpoint
CREATE TABLE "member_custom_field_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"value_text" text,
	"value_number" double precision,
	"value_date" date,
	"value_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fvals_member_field_uniq" UNIQUE("member_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "rh_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"station_id" integer NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text,
	"surname" text NOT NULL,
	"phone" text,
	"alt_phone" text,
	"email" text,
	"area" text,
	"dob" date,
	"gender" text,
	"national_id" text,
	"photo_url" text,
	"id_image_url" text,
	"id_type" text,
	"id_number" text,
	"id_name" text,
	"id_dob" date,
	"id_gender" text,
	"id_issued_at" date,
	"id_expiry_at" date,
	"bike_reg_no" text,
	"bike_model" text,
	"bike_ownership" text,
	"membership_number" text,
	"existing_qr_id" text,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"source" text DEFAULT 'online' NOT NULL,
	"registration_date" date,
	"approved_by" integer,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rh_members_org_number_uniq" UNIQUE("org_id","membership_number")
);
--> statement-breakpoint
CREATE TABLE "membership_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"station_id" integer NOT NULL,
	"invitation_id" integer,
	"form_version" integer DEFAULT 1 NOT NULL,
	"status" "application_status" DEFAULT 'submitted' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"email" text,
	"area" text,
	"chair_notes" text,
	"recommended_by" integer,
	"recommended_at" timestamp,
	"decision_by" integer,
	"decision_at" timestamp,
	"decision_notes" text,
	"rejection_reason" text,
	"member_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"qr_payload" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "membership_cards_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "membership_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"from_station_id" integer NOT NULL,
	"to_station_id" integer NOT NULL,
	"reason" text NOT NULL,
	"requested_by" integer,
	"status" "transfer_status" DEFAULT 'pending' NOT NULL,
	"approved_by" integer,
	"decided_at" timestamp,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"org_id" integer,
	"type" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "org_role" DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "om_org_user_uniq" UNIQUE("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organization_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"status" "subscription_status" DEFAULT 'pending_payment' NOT NULL,
	"billing_cycle" "billing_cycle" DEFAULT 'monthly' NOT NULL,
	"current_period_start" date,
	"current_period_end" date,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(120) NOT NULL,
	"code" varchar(12) NOT NULL,
	"motto" text,
	"logo_url" text,
	"primary_color" text DEFAULT '#177245' NOT NULL,
	"secondary_color" text DEFAULT '#14201A' NOT NULL,
	"accent_color" text DEFAULT '#F5B301' NOT NULL,
	"county" text,
	"location" text,
	"phone" text,
	"email" text,
	"registration_number" text,
	"description" text,
	"status" "org_status" DEFAULT 'pending' NOT NULL,
	"form_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pickup_stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"name" text NOT NULL,
	"code" varchar(40) NOT NULL,
	"location" text,
	"description" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stations_org_code_uniq" UNIQUE("org_id","code")
);
--> statement-breakpoint
CREATE TABLE "registration_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"station_id" integer NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"max_uses" integer DEFAULT 100 NOT NULL,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "registration_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_officials" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "station_role" NOT NULL,
	"status" "official_status" DEFAULT 'active' NOT NULL,
	"note" text,
	"appointed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"subscription_id" integer,
	"method" text DEFAULT 'manual_bank' NOT NULL,
	"mpesa_ref" varchar(64),
	"amount_kes" integer NOT NULL,
	"status" "rh_payment_status" DEFAULT 'pending' NOT NULL,
	"verified_by" integer,
	"verified_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"monthly_price_kes" integer NOT NULL,
	"annual_price_kes" integer NOT NULL,
	"max_stations" integer NOT NULL,
	"max_members" integer NOT NULL,
	"max_admins" integer NOT NULL,
	"storage_mb" integer NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"platform_role" text,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_pickup_point_id_pickup_points_id_fk" FOREIGN KEY ("pickup_point_id") REFERENCES "public"."pickup_points"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "welfare_cases" ADD CONSTRAINT "welfare_cases_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_station_id_pickup_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pickup_stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rh_audit_logs" ADD CONSTRAINT "rh_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_custom_field_definitions" ADD CONSTRAINT "member_custom_field_definitions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_custom_field_values" ADD CONSTRAINT "member_custom_field_values_member_id_rh_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."rh_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_custom_field_values" ADD CONSTRAINT "member_custom_field_values_field_id_member_custom_field_definitions_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."member_custom_field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rh_members" ADD CONSTRAINT "rh_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rh_members" ADD CONSTRAINT "rh_members_station_id_pickup_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pickup_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rh_members" ADD CONSTRAINT "rh_members_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_station_id_pickup_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pickup_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_invitation_id_registration_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."registration_invitations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_recommended_by_users_id_fk" FOREIGN KEY ("recommended_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_decision_by_users_id_fk" FOREIGN KEY ("decision_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_member_id_rh_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."rh_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_cards" ADD CONSTRAINT "membership_cards_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_cards" ADD CONSTRAINT "membership_cards_member_id_rh_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."rh_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_member_id_rh_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."rh_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_from_station_id_pickup_stations_id_fk" FOREIGN KEY ("from_station_id") REFERENCES "public"."pickup_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_to_station_id_pickup_stations_id_fk" FOREIGN KEY ("to_station_id") REFERENCES "public"."pickup_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_transfers" ADD CONSTRAINT "membership_transfers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_stations" ADD CONSTRAINT "pickup_stations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_invitations" ADD CONSTRAINT "registration_invitations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_invitations" ADD CONSTRAINT "registration_invitations_station_id_pickup_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pickup_stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_invitations" ADD CONSTRAINT "registration_invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_officials" ADD CONSTRAINT "station_officials_station_id_pickup_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pickup_stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_officials" ADD CONSTRAINT "station_officials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_organization_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."organization_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_email_idx" ON "audit_logs" USING btree ("actor_email");--> statement-breakpoint
CREATE INDEX "members_pickup_idx" ON "members" USING btree ("pickup_point_id");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_member_idx" ON "payments" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "welfare_cases_status_idx" ON "welfare_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "welfare_cases_member_idx" ON "welfare_cases" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "ann_org_idx" ON "announcements" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "rh_audit_logs_org_idx" ON "rh_audit_logs" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "rh_audit_logs_user_idx" ON "rh_audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "fdefs_org_idx" ON "member_custom_field_definitions" USING btree ("org_id","position");--> statement-breakpoint
CREATE INDEX "rh_members_org_idx" ON "rh_members" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "rh_members_station_idx" ON "rh_members" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "rh_members_org_phone_idx" ON "rh_members" USING btree ("org_id","phone");--> statement-breakpoint
CREATE INDEX "apps_org_idx" ON "membership_applications" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "apps_station_idx" ON "membership_applications" USING btree ("station_id","status");--> statement-breakpoint
CREATE INDEX "cards_org_idx" ON "membership_cards" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "transfers_org_idx" ON "membership_transfers" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "transfers_member_idx" ON "membership_transfers" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "notif_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "subs_org_idx" ON "organization_subscriptions" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "stations_org_idx" ON "pickup_stations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "inv_station_idx" ON "registration_invitations" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "soff_station_idx" ON "station_officials" USING btree ("station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "soff_one_active_chair" ON "station_officials" USING btree ("station_id") WHERE "role" = 'chairperson' AND "status" = 'active';--> statement-breakpoint
CREATE INDEX "pay_org_idx" ON "subscription_payments" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pay_mpesa_ref_uniq" ON "subscription_payments" USING btree ("mpesa_ref");