-- Stored Procedure: sp_admin_test_results_record
-- Purpose: Transactionally record admin test results (suites + assertions) from runner callback.
--   Validates the callback token, upserts each suite, and batch-inserts assertions.
--   Idempotent: re-posting the same payload converges to the same final state.
-- Parameters:
--   i_run_execution_id: run_executions.id
--   i_callback_token: one-time runner token for auth
--   i_suites_json: JSONB array of suite objects, each with nested assertions array
--   i_created_by: 'runner' or operator login
-- Returns: one row per suite with o_suite_id, o_suite_type, o_status

CREATE OR REPLACE FUNCTION sp_admin_test_results_record(
    i_run_execution_id INTEGER,
    i_callback_token VARCHAR(255),
    i_suites_json JSONB,
    i_created_by VARCHAR(255) DEFAULT 'runner'
)
RETURNS TABLE (
    o_suite_id INTEGER,
    o_suite_type VARCHAR(50),
    o_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_valid BOOLEAN;
    v_suite JSONB;
    v_suite_id INTEGER;
    v_suite_type VARCHAR(50);
    v_suite_status VARCHAR(50);
BEGIN
    -- Validate callback token
    SELECT re.callback_token = i_callback_token
    INTO v_is_valid
    FROM run_executions re
    WHERE re.id = i_run_execution_id;

    IF NOT FOUND OR NOT v_is_valid THEN
        RAISE EXCEPTION 'invalid_callback_token: token mismatch for execution %', i_run_execution_id;
    END IF;

    -- Process each suite
    FOR v_suite IN SELECT * FROM jsonb_array_elements(i_suites_json)
    LOOP
        v_suite_type := (v_suite->>'suite_type')::VARCHAR(50);
        v_suite_status := (v_suite->>'status')::VARCHAR(50);

        -- Upsert suite row
        INSERT INTO admin_test_suites (
            run_execution_id, suite_type, status,
            total_assertions, passed_assertions, failed_assertions, skipped_assertions,
            started_at, completed_at, duration_ms, error_message, metadata,
            created_by, updated_by
        ) VALUES (
            i_run_execution_id,
            v_suite_type,
            v_suite_status,
            COALESCE((v_suite->>'total_assertions')::INTEGER, 0),
            COALESCE((v_suite->>'passed_assertions')::INTEGER, 0),
            COALESCE((v_suite->>'failed_assertions')::INTEGER, 0),
            COALESCE((v_suite->>'skipped_assertions')::INTEGER, 0),
            CASE WHEN v_suite->>'started_at' IS NOT NULL
                 THEN (v_suite->>'started_at')::TIMESTAMP WITH TIME ZONE
                 ELSE CURRENT_TIMESTAMP END,
            CASE WHEN v_suite->>'completed_at' IS NOT NULL
                 THEN (v_suite->>'completed_at')::TIMESTAMP WITH TIME ZONE
                 ELSE CURRENT_TIMESTAMP END,
            (v_suite->>'duration_ms')::INTEGER,
            v_suite->>'error_message',
            v_suite->'metadata',
            i_created_by,
            i_created_by
        )
        ON CONFLICT (run_execution_id, suite_type)
        DO UPDATE SET
            status = EXCLUDED.status,
            total_assertions = EXCLUDED.total_assertions,
            passed_assertions = EXCLUDED.passed_assertions,
            failed_assertions = EXCLUDED.failed_assertions,
            skipped_assertions = EXCLUDED.skipped_assertions,
            started_at = EXCLUDED.started_at,
            completed_at = EXCLUDED.completed_at,
            duration_ms = EXCLUDED.duration_ms,
            error_message = EXCLUDED.error_message,
            metadata = COALESCE(EXCLUDED.metadata, admin_test_suites.metadata),
            updated_date = CURRENT_TIMESTAMP,
            updated_by = i_created_by
        RETURNING id INTO v_suite_id;

        -- Delete existing assertions for this suite (idempotent replay)
        DELETE FROM admin_test_assertions WHERE admin_test_suite_id = v_suite_id;

        -- Batch-insert assertions
        IF v_suite->'assertions' IS NOT NULL AND jsonb_array_length(v_suite->'assertions') > 0 THEN
            INSERT INTO admin_test_assertions (
                admin_test_suite_id, assertion_name, status,
                page_url, expected_value, actual_value,
                error_message, detail, created_by, updated_by
            )
            SELECT
                v_suite_id,
                (a->>'assertion_name')::VARCHAR(255),
                (a->>'status')::VARCHAR(50),
                (a->>'page_url')::VARCHAR(2048),
                a->>'expected_value',
                a->>'actual_value',
                a->>'error_message',
                a->'detail',
                i_created_by,
                i_created_by
            FROM jsonb_array_elements(v_suite->'assertions') AS a;
        END IF;

        RETURN QUERY SELECT v_suite_id, v_suite_type, v_suite_status;
    END LOOP;
END;
$$;
