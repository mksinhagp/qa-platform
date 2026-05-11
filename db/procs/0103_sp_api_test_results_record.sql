BEGIN
-- Stored procedure: sp_api_test_results_record
-- Purpose: Record API test results (Phase 6) for a run execution in a single
--   transactional, idempotent, token-bound write. Replaces the previous three-
--   step route logic (suite upsert + assertion batch insert + suite update),
--   which was not transactional and not retry-safe (duplicate assertions on
--   replay).
--
-- Behaviour:
--   1. Validates the callback token against run_executions.callback_token. If
--      the token does not match, raises an exception and returns no rows. The
--      dashboard route maps this to a 401.
--   2. For each suite object in i_suites_json:
--        a. Upserts the suite row on (run_execution_id, suite_type), setting
--           the final status, counters, duration, and error_message.
--        b. Deletes any existing assertion rows for the suite (idempotency on
--           runner-side retry).
--        c. Batch-inserts the provided assertion rows.
--   3. All steps execute inside the implicit function transaction; if any
--      step raises, the entire record operation rolls back.
--
-- Parameters:
--   i_run_execution_id  : run_executions.id this batch belongs to
--   i_callback_token    : runner one-time token; must match run_executions row
--   i_suites_json       : JSONB array of suite objects (see route handler)
--   i_created_by        : audit user (typically 'runner')
--
-- Returns: one row per suite recorded, with the suite_id and final status.

CREATE OR REPLACE FUNCTION sp_api_test_results_record(
    i_run_execution_id INTEGER,
    i_callback_token   VARCHAR(255),
    i_suites_json      JSONB,
    i_created_by       VARCHAR(255) DEFAULT 'runner'
)
RETURNS TABLE (
    o_suite_id   INTEGER,
    o_suite_type VARCHAR(50),
    o_status     VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_token_ok    BOOLEAN;
    v_suite       JSONB;
    v_suite_id    INTEGER;
    v_assertions  JSONB;
BEGIN
    -- 1. Validate the callback token (must match the run_executions row).
    SELECT EXISTS (
        SELECT 1
        FROM run_executions re
        WHERE re.id = i_run_execution_id
          AND re.callback_token = i_callback_token
    ) INTO v_token_ok;

    IF NOT v_token_ok THEN
        RAISE EXCEPTION 'invalid_callback_token'
            USING ERRCODE = '28000';  -- invalid_authorization_specification
    END IF;

    IF i_suites_json IS NULL OR jsonb_typeof(i_suites_json) <> 'array' THEN
        RAISE EXCEPTION 'i_suites_json must be a JSONB array';
    END IF;

    -- 2. Iterate suites.
    FOR v_suite IN SELECT * FROM jsonb_array_elements(i_suites_json)
    LOOP
        -- 2a. Upsert suite row with final state (single write, no intermediate
        --     'running' phase). started_at / completed_at come from payload.
        INSERT INTO api_test_suites (
            run_execution_id,
            suite_type,
            status,
            total_assertions,
            passed_assertions,
            failed_assertions,
            skipped_assertions,
            duration_ms,
            error_message,
            metadata,
            started_at,
            completed_at,
            created_by,
            updated_by
        ) VALUES (
            i_run_execution_id,
            COALESCE(v_suite->>'suite_type', 'unknown'),
            COALESCE(v_suite->>'status', 'error'),
            COALESCE((v_suite->>'total_assertions')::INTEGER, 0),
            COALESCE((v_suite->>'passed_assertions')::INTEGER, 0),
            COALESCE((v_suite->>'failed_assertions')::INTEGER, 0),
            COALESCE((v_suite->>'skipped_assertions')::INTEGER, 0),
            (v_suite->>'duration_ms')::INTEGER,
            v_suite->>'error_message',
            NULLIF(v_suite->'metadata', 'null'::jsonb),
            (v_suite->>'started_at')::TIMESTAMPTZ,
            (v_suite->>'completed_at')::TIMESTAMPTZ,
            i_created_by,
            i_created_by
        )
        ON CONFLICT (run_execution_id, suite_type) DO UPDATE SET
            status             = EXCLUDED.status,
            total_assertions   = EXCLUDED.total_assertions,
            passed_assertions  = EXCLUDED.passed_assertions,
            failed_assertions  = EXCLUDED.failed_assertions,
            skipped_assertions = EXCLUDED.skipped_assertions,
            duration_ms        = COALESCE(EXCLUDED.duration_ms, api_test_suites.duration_ms),
            error_message      = EXCLUDED.error_message,
            metadata           = COALESCE(EXCLUDED.metadata, api_test_suites.metadata),
            started_at         = COALESCE(EXCLUDED.started_at, api_test_suites.started_at),
            completed_at       = COALESCE(EXCLUDED.completed_at, api_test_suites.completed_at),
            updated_date       = CURRENT_TIMESTAMP,
            updated_by         = i_created_by
        RETURNING id INTO v_suite_id;

        -- 2b. Idempotency: clear any pre-existing assertions for this suite
        --     before re-inserting. Safe because assertion ids are not user-
        --     facing and the runner re-sends the full set on every callback.
        DELETE FROM api_test_assertions WHERE api_test_suite_id = v_suite_id;

        -- 2c. Batch-insert assertions for this suite, if any.
        v_assertions := v_suite->'assertions';
        IF v_assertions IS NOT NULL AND jsonb_typeof(v_assertions) = 'array' THEN
            INSERT INTO api_test_assertions (
                api_test_suite_id,
                endpoint_url,
                http_method,
                assertion_name,
                status,
                expected_value,
                actual_value,
                response_status,
                response_time_ms,
                error_message,
                detail,
                created_by,
                updated_by
            )
            SELECT
                v_suite_id,
                COALESCE(a->>'endpoint_url', ''),
                COALESCE(a->>'http_method', 'GET'),
                COALESCE(a->>'assertion_name', 'unnamed'),
                COALESCE(a->>'status', 'error'),
                a->>'expected_value',
                a->>'actual_value',
                (a->>'response_status')::INTEGER,
                (a->>'response_time_ms')::INTEGER,
                a->>'error_message',
                NULLIF(a->'detail', 'null'::jsonb),
                i_created_by,
                i_created_by
            FROM jsonb_array_elements(v_assertions) AS a;
        END IF;

        o_suite_id   := v_suite_id;
        o_suite_type := COALESCE(v_suite->>'suite_type', 'unknown');
        o_status     := COALESCE(v_suite->>'status', 'error');
        RETURN NEXT;
    END LOOP;

    RETURN;
END;
$$;
END;
