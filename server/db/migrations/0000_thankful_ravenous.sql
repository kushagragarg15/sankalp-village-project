CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"google_id" text,
	"role" text DEFAULT 'volunteer' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('admin', 'volunteer')),
	CONSTRAINT "users_password_or_google_check" CHECK ("users"."password_hash" IS NOT NULL OR "users"."google_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"grade" text NOT NULL,
	"grade_number" integer,
	"enrollment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"parent_phone" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"topic" text NOT NULL,
	"score" numeric NOT NULL,
	"max_score" numeric NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_scores_max_score_check" CHECK ("quiz_scores"."max_score" > 0),
	CONSTRAINT "quiz_scores_score_check" CHECK ("quiz_scores"."score" >= 0 AND "quiz_scores"."score" <= "quiz_scores"."max_score")
);
--> statement-breakpoint
CREATE TABLE "attendance_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"active_code" text,
	"code_expiry" timestamp with time zone,
	"lat" double precision,
	"lng" double precision,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_sessions_time_check" CHECK ("attendance_sessions"."end_time" > "attendance_sessions"."start_time")
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teaching_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"volunteer_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"topic" text NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code_used" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"grade" text NOT NULL,
	"grade_number" integer,
	"content" text NOT NULL,
	"embedding_model" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(3072),
	"embedding_model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"question" text NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"model" text NOT NULL,
	"iterations" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"llm_ms" integer DEFAULT 0 NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_runs_role_check" CHECK ("agent_runs"."role" IN ('admin', 'volunteer')),
	CONSTRAINT "agent_runs_status_check" CHECK ("agent_runs"."status" IN ('completed', 'max_iterations', 'error'))
);
--> statement-breakpoint
CREATE TABLE "agent_run_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"iteration" integer,
	"tool" text,
	"args" jsonb,
	"ok" boolean,
	"duration_ms" integer,
	"result_preview" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_plan_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"volunteer_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"focus_groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"review_note" text DEFAULT '' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"edited_by_volunteer" boolean DEFAULT false NOT NULL,
	"context_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"trace" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"provider" text,
	"model" text,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_plan_drafts_status_check" CHECK ("lesson_plan_drafts"."status" IN ('draft', 'approved', 'rejected', 'superseded'))
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"per_query" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eval_runs_kind_check" CHECK ("eval_runs"."kind" IN ('retrieval', 'generation'))
);
--> statement-breakpoint
ALTER TABLE "quiz_scores" ADD CONSTRAINT "quiz_scores_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_session_id_attendance_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."attendance_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_logs" ADD CONSTRAINT "teaching_logs_volunteer_id_users_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_logs" ADD CONSTRAINT "teaching_logs_session_id_attendance_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."attendance_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_logs" ADD CONSTRAINT "teaching_logs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_chunks" ADD CONSTRAINT "resource_chunks_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run_steps" ADD CONSTRAINT "agent_run_steps_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_plan_drafts" ADD CONSTRAINT "lesson_plan_drafts_session_id_attendance_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."attendance_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_plan_drafts" ADD CONSTRAINT "lesson_plan_drafts_volunteer_id_users_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_id_key" ON "users" USING btree ("google_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "quiz_scores_student_taken_idx" ON "quiz_scores" USING btree ("student_id","taken_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "attendance_sessions_window_idx" ON "attendance_sessions" USING btree ("start_time","end_time");--> statement-breakpoint
CREATE INDEX "attendance_sessions_active_code_idx" ON "attendance_sessions" USING btree ("active_code");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_user_session_key" ON "registrations" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teaching_logs_session_volunteer_student_key" ON "teaching_logs" USING btree ("session_id","volunteer_id","student_id");--> statement-breakpoint
CREATE INDEX "teaching_logs_volunteer_logged_idx" ON "teaching_logs" USING btree ("volunteer_id","logged_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "teaching_logs_session_idx" ON "teaching_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "teaching_logs_student_idx" ON "teaching_logs" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "resources_embedding_subject_grade_idx" ON "resources" USING btree ("embedding_model","subject","grade");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_chunks_resource_chunk_key" ON "resource_chunks" USING btree ("resource_id","chunk_index");--> statement-breakpoint
CREATE INDEX "resource_chunks_embedding_model_idx" ON "resource_chunks" USING btree ("embedding_model");--> statement-breakpoint
CREATE INDEX "agent_runs_user_created_idx" ON "agent_runs" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "agent_runs_user_conversation_created_idx" ON "agent_runs" USING btree ("user_id","conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_run_steps_run_idx" ON "agent_run_steps" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "lesson_plan_drafts_session_volunteer_status_idx" ON "lesson_plan_drafts" USING btree ("session_id","volunteer_id","status");--> statement-breakpoint
CREATE INDEX "lesson_plan_drafts_volunteer_created_idx" ON "lesson_plan_drafts" USING btree ("volunteer_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "eval_runs_kind_created_idx" ON "eval_runs" USING btree ("kind","created_at" DESC NULLS LAST);
--> statement-breakpoint
-- Keeps `updated_at` accurate on every UPDATE without relying on app code to
-- remember to set it (mirrors Mongoose's automatic `timestamps: true` behaviour).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER students_set_updated_at BEFORE UPDATE ON "students"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER attendance_sessions_set_updated_at BEFORE UPDATE ON "attendance_sessions"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER registrations_set_updated_at BEFORE UPDATE ON "registrations"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER teaching_logs_set_updated_at BEFORE UPDATE ON "teaching_logs"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER resources_set_updated_at BEFORE UPDATE ON "resources"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER lesson_plan_drafts_set_updated_at BEFORE UPDATE ON "lesson_plan_drafts"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
