BEGIN;
CREATE TABLE IF NOT EXISTS schema_version (version integer PRIMARY KEY);
INSERT INTO schema_version VALUES(1),(2) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS admin_credentials (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS password_tokens (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE TABLE IF NOT EXISTS login_limits (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  attempts integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part integer NOT NULL CHECK(part IN (1,2,3)),
  topic text NOT NULL,
  title text NOT NULL,
  prompt text NOT NULL,
  bank text NOT NULL CHECK(bank IN ('regular','retained','new')),
  collection text NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  title text NOT NULL DEFAULT '' CHECK(length(title)<=120),
  body text NOT NULL CHECK(length(btrim(body))>0 AND length(body)<=40000),
  feedback text NOT NULL DEFAULT '' CHECK(length(feedback)<=40000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS answers_question ON answers(question_id,created_at DESC);
CREATE OR REPLACE VIEW service_health AS
SELECT 1 AS schema_version,
  (SELECT count(*)::int FROM questions) AS question_count,
  (SELECT count(*)::int FROM answers) AS answer_count,
  (SELECT max(updated_at) FROM answers) AS last_answer_at;
COMMIT;
