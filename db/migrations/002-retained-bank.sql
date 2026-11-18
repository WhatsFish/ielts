BEGIN;
SELECT pg_advisory_xact_lock(3017,2);
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_bank_check;
ALTER TABLE questions ADD CONSTRAINT questions_bank_check CHECK(bank IN ('regular','retained','new'));
INSERT INTO schema_version VALUES(2) ON CONFLICT DO NOTHING;
COMMIT;
