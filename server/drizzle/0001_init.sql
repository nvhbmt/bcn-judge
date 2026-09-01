-- BCN Judge — schema v1 (design.md §2). Viết tay: chứa composite FK deferrable,
-- partial index và trigger append-only mà drizzle-kit không sinh được.
-- Chỉ-additive (§9 check-migrations-safe.sh): file này là migration khởi tạo.

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────── §2.1 Danh tính & phiên

CREATE TABLE users (
  id                   text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email                citext NOT NULL,
  username             citext,
  display_name         text NOT NULL,
  role                 text NOT NULL CHECK (role IN ('admin','mentor','member')),
  password_hash        text,
  hash_algo            text CHECK (hash_algo IS NULL OR hash_algo = 'argon2id'),
  must_change_password boolean NOT NULL DEFAULT true,
  totp_secret          text,
  disabled             boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  last_login           timestamptz,
  deleted_at           timestamptz
);
CREATE UNIQUE INDEX users_email_key ON users (email);
CREATE UNIQUE INDEX users_username_key ON users (username);
CREATE INDEX users_role_idx ON users (role);

CREATE TABLE user_sessions (
  token_hash  bytea PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  ip          inet,
  user_agent  text
);
CREATE INDEX user_sessions_user_idx ON user_sessions (user_id);

-- ────────────────────────────────────────────────────── §2.2 Khoá học & nội dung

CREATE TABLE courses (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code           citext NOT NULL,
  name           text NOT NULL,
  description_md text,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','archived')),
  self_enroll    boolean NOT NULL DEFAULT false,
  created_by     text REFERENCES users (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  archived_at    timestamptz
);
CREATE UNIQUE INDEX courses_code_key ON courses (code);
CREATE INDEX courses_status_idx ON courses (status);

CREATE TABLE course_mentors (
  course_id   text NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  user_id     text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  assigned_by text REFERENCES users (id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, user_id)
);
CREATE INDEX course_mentors_user_idx ON course_mentors (user_id);

CREATE TABLE course_enrollments (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  course_id   text NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  user_id     text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  enrolled_by text REFERENCES users (id),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  removed_at  timestamptz,
  CONSTRAINT course_enrollments_course_user_key UNIQUE (course_id, user_id)
);
CREATE INDEX course_enrollments_user_idx ON course_enrollments (user_id, status);

CREATE TABLE sections (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  course_id  text NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  title      text NOT NULL,
  position   integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sections_course_pos_idx ON sections (course_id, position);

-- ───────────────────────────────────────────────── §2.3 Ngân hàng bài & testcase

CREATE TABLE problems (
  id                     text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title                  text NOT NULL,
  statement_md           text NOT NULL,
  input_desc_md          text,
  output_desc_md         text,
  constraints_md         text,
  examples               jsonb NOT NULL DEFAULT '[]'::jsonb,
  time_limit_ms          integer CHECK (time_limit_ms IS NULL OR time_limit_ms > 0),
  memory_limit_mb        integer CHECK (memory_limit_mb IS NULL OR memory_limit_mb > 0),
  difficulty             text CHECK (difficulty IS NULL OR difficulty IN ('easy','medium','hard')),
  tags                   text[] NOT NULL DEFAULT '{}'::text[],
  allowed_language_ids   text[],
  compare_mode           text NOT NULL DEFAULT 'trim' CHECK (compare_mode IN ('trim','exact','float')),
  float_eps              double precision,
  starter_code           jsonb NOT NULL DEFAULT '{}'::jsonb,
  solution_language_id   text,
  solution_source        text,
  solution_visibility    text NOT NULL DEFAULT 'mentor'
                           CHECK (solution_visibility IN ('mentor','after_ac','after_contest')),
  testcase_rev           integer NOT NULL DEFAULT 1,
  validated_testcase_rev integer,
  validated_at           timestamptz,
  scope_course_id        text REFERENCES courses (id),
  created_by             text REFERENCES users (id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);
CREATE INDEX problems_scope_idx ON problems (scope_course_id);
CREATE INDEX problems_tags_idx ON problems USING gin (tags);
-- §2.6: chống một submission trỏ item A mà chấm bài B, ở tầng DB.
ALTER TABLE problems ADD CONSTRAINT problems_id_key UNIQUE (id);

CREATE TABLE testcases (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  problem_id     text NOT NULL REFERENCES problems (id) ON DELETE CASCADE,
  position       integer NOT NULL,
  kind           text NOT NULL CHECK (kind IN ('sample','hidden')),
  weight         integer NOT NULL DEFAULT 1 CHECK (weight > 0),
  input          bytea NOT NULL,
  expected       bytea,
  input_bytes    integer NOT NULL,
  expected_bytes integer,
  input_sha256   bytea NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX testcases_problem_pos_idx ON testcases (problem_id, position);

CREATE TABLE files (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kind       text NOT NULL DEFAULT 'image' CHECK (kind IN ('image')),
  bytes      bytea NOT NULL,
  mime       text NOT NULL,
  width      integer,
  height     integer,
  sha256     bytea,
  created_by text REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE items (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  section_id     text NOT NULL REFERENCES sections (id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('lesson','problem')),
  title          text NOT NULL,
  position       integer NOT NULL,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  visible_from   timestamptz,
  lesson_body_md text,
  problem_id     text REFERENCES problems (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'lesson') = (problem_id IS NULL)),
  CONSTRAINT items_id_problem_key UNIQUE (id, problem_id)
);
CREATE INDEX items_section_pos_idx ON items (section_id, position);
CREATE INDEX items_problem_idx ON items (problem_id);

-- ──────────────────────────────────────────────────── §2.4 Ngôn ngữ & cấu hình

CREATE TABLE languages (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  version_label   text,
  image           text NOT NULL,
  source_filename text NOT NULL,
  compile_argv    jsonb,
  run_argv        jsonb NOT NULL,
  time_factor     numeric(4,2) NOT NULL DEFAULT 1,
  memory_extra_mb integer NOT NULL DEFAULT 0,
  cm_mode         text,
  enabled         boolean NOT NULL DEFAULT false,
  position        integer
);

CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES users (id)
);

-- ───────────────────────────────────────────────────────────────── §2.5 Contest

CREATE TABLE contests (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  course_id       text REFERENCES courses (id),
  title           text NOT NULL,
  description_md  text,
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  scoring         text NOT NULL DEFAULT 'sum_score' CHECK (scoring IN ('sum_score','icpc')),
  penalty_minutes integer NOT NULL DEFAULT 20,
  sequential      boolean NOT NULL DEFAULT false,
  freeze_minutes  integer NOT NULL DEFAULT 0,
  created_by      text REFERENCES users (id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CHECK (end_at > start_at)
);
CREATE INDEX contests_status_start_idx ON contests (status, start_at);

CREATE TABLE contest_problems (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  contest_id text NOT NULL REFERENCES contests (id) ON DELETE CASCADE,
  problem_id text NOT NULL REFERENCES problems (id),
  position   integer NOT NULL,
  label      text,
  max_score  integer NOT NULL DEFAULT 100 CHECK (max_score > 0),
  CONSTRAINT contest_problems_contest_problem_key UNIQUE (contest_id, problem_id),
  CONSTRAINT contest_problems_id_problem_key UNIQUE (id, problem_id)
);
CREATE INDEX contest_problems_contest_pos_idx ON contest_problems (contest_id, position);

CREATE TABLE contest_participants (
  contest_id      text NOT NULL REFERENCES contests (id) ON DELETE CASCADE,
  user_id         text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  first_opened_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);

CREATE TABLE contest_events (
  seq        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contest_id text NOT NULL REFERENCES contests (id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('started','standings.changed')),
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contest_events_contest_seq_idx ON contest_events (contest_id, seq);
-- §2.5: 'started' chèn lười, idempotent — unique partial nuốt va chạm.
CREATE UNIQUE INDEX contest_events_started_key ON contest_events (contest_id, kind)
  WHERE kind = 'started';

-- ────────────────────────────────────────────────────────── §2.6 Bài nộp & chấm

CREATE TABLE submissions (
  id                  text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  seq                 bigint GENERATED ALWAYS AS IDENTITY,
  kind                text NOT NULL CHECK (kind IN ('submit','run')),
  user_id             text NOT NULL REFERENCES users (id),
  problem_id          text NOT NULL REFERENCES problems (id),
  item_id             text,
  contest_id          text REFERENCES contests (id),
  contest_problem_id  text,
  language_id         text NOT NULL REFERENCES languages (id),
  source              text NOT NULL,
  source_bytes        integer NOT NULL,
  custom_input        bytea,
  run_target          text CHECK (run_target IS NULL OR run_target IN ('samples','custom','validate')),
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done')),
  verdict             text CHECK (verdict IS NULL OR verdict IN ('AC','WA','TLE','MLE','RE','CE','IE')),
  passed_weight       integer,
  total_weight        integer,
  time_ms_max         integer,
  memory_kb_max       integer,
  compile_output      text,
  testcase_rev        integer,
  received_at         timestamptz NOT NULL DEFAULT now(),
  started_at          timestamptz,
  finished_at         timestamptz,
  queued_ms           integer,
  judge_ms            integer,
  worker_id           text,
  heartbeat_at        timestamptz,
  attempt             integer NOT NULL DEFAULT 0,
  priority            smallint NOT NULL DEFAULT 1,
  ie_reason           text,
  ie_retry            boolean NOT NULL DEFAULT true,
  -- Toàn vẹn tham chiếu chống gian lận điểm ở tầng DB (§2.6): không thể trỏ
  -- contest problem A mà chấm bài B, kể cả khi guard API có bug.
  CONSTRAINT submissions_contest_problem_fk
    FOREIGN KEY (contest_problem_id, problem_id)
    REFERENCES contest_problems (id, problem_id),
  CONSTRAINT submissions_item_fk
    FOREIGN KEY (item_id, problem_id)
    REFERENCES items (id, problem_id)
);
CREATE UNIQUE INDEX submissions_seq_key ON submissions (seq);
CREATE INDEX submissions_claim_idx ON submissions (priority, seq) WHERE status = 'pending';
CREATE INDEX submissions_user_problem_idx ON submissions (user_id, problem_id, seq DESC);
CREATE INDEX submissions_contest_standings_idx
  ON submissions (contest_id, contest_problem_id, user_id, received_at);
CREATE INDEX submissions_problem_idx ON submissions (problem_id, seq DESC);
CREATE INDEX submissions_reaper_idx ON submissions (heartbeat_at) WHERE status = 'running';
CREATE INDEX submissions_run_purge_idx ON submissions (received_at) WHERE kind = 'run';

CREATE TABLE submission_results (
  submission_id   text NOT NULL REFERENCES submissions (id) ON DELETE CASCADE,
  attempt         integer NOT NULL,
  position        integer NOT NULL,
  testcase_id     text REFERENCES testcases (id) ON DELETE SET NULL,
  is_sample       boolean NOT NULL,
  verdict         text NOT NULL CHECK (verdict IN ('AC','WA','TLE','MLE','RE','IE')),
  time_ms         integer,
  memory_kb       integer,
  exit_code       integer,
  term_signal     integer,
  detail          text,
  stdout          text,
  stderr          text,
  mentor_stdout   text,
  first_diff_line integer,
  PRIMARY KEY (submission_id, attempt, position)
);

CREATE TABLE submission_score_audit (
  id                    text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  submission_id         text NOT NULL REFERENCES submissions (id) ON DELETE CASCADE,
  verdict_before        text,
  verdict_after         text,
  passed_weight_before  integer,
  passed_weight_after   integer,
  reason                text NOT NULL,
  actor                 text REFERENCES users (id),
  at                    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX submission_score_audit_submission_idx ON submission_score_audit (submission_id);

-- Append-only (mẫu score_recompute_audit của imath).
CREATE OR REPLACE FUNCTION submission_score_audit_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'submission_score_audit là append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER submission_score_audit_no_update
  BEFORE UPDATE OR DELETE ON submission_score_audit
  FOR EACH ROW EXECUTE FUNCTION submission_score_audit_append_only();

CREATE TABLE rejudge_queue (
  submission_id  text PRIMARY KEY REFERENCES submissions (id) ON DELETE CASCADE,
  requested_at   timestamptz NOT NULL DEFAULT now(),
  actor          text REFERENCES users (id),
  reason         text,
  claimed_by     text,
  claimed_at     timestamptz,
  shadow_attempt integer
);
CREATE INDEX rejudge_queue_unclaimed_idx ON rejudge_queue (requested_at) WHERE claimed_by IS NULL;

CREATE TABLE drafts (
  user_id     text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  problem_id  text NOT NULL REFERENCES problems (id) ON DELETE CASCADE,
  language_id text NOT NULL REFERENCES languages (id),
  source      text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, problem_id, language_id)
);
CREATE INDEX drafts_user_updated_idx ON drafts (user_id, updated_at DESC);

CREATE TABLE workers (
  id           text PRIMARY KEY,
  slots        integer NOT NULL,
  version      text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  actor_id    text REFERENCES users (id),
  action      text NOT NULL,
  entity_type text,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  ip          inet,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_at_idx ON audit_log (at DESC);

-- ─────────────────────────────────────────────────── §2.8 Team & Leader (FR-J)

CREATE TABLE teams (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name           text NOT NULL,
  description_md text,
  leader_id      text NOT NULL REFERENCES users (id),
  course_id      text REFERENCES courses (id),
  created_by     text REFERENCES users (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX teams_course_idx ON teams (course_id);

CREATE TABLE team_members (
  team_id  text NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  user_id  text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  added_by text REFERENCES users (id),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
-- FR-J1: mỗi member thuộc TỐI ĐA một team (Q17 flip = DROP constraint này).
CREATE UNIQUE INDEX team_members_user_key ON team_members (user_id);

-- ADR-14: leader PHẢI là thành viên của chính team đó — thi hành ở DB, không ở guard.
-- DEFERRABLE để giải vòng tròn teams ↔ team_members: tạo team + dòng thành viên của
-- leader trong MỘT transaction, FK kiểm ở commit.
ALTER TABLE teams ADD CONSTRAINT teams_leader_is_member_fk
  FOREIGN KEY (id, leader_id) REFERENCES team_members (team_id, user_id)
  DEFERRABLE INITIALLY DEFERRED;
