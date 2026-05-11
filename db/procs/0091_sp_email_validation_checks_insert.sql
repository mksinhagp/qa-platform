-- Stored Procedure: sp_email_validation_checks_insert
-- Purpose: Record a single check result within an email validation run
-- Parameters:
--   i_email_validation_run_id: parent email_validation_runs.id
--   i_check_type: delivery|subject_pattern|body_pattern|link_extract|link_reachable|render_fidelity|brand_logo|brand_footer
--   i_status: passed|failed|skipped|error
--   i_detail: human-readable assertion detail
--   i_url_tested: URL for link checks (nullable)
--   i_diff_percent: pixel diff % for render checks (nullable)
--   i_http_status: HTTP status for link checks (nullable)
--   i_artifact_path: path to screenshot artifact (nullable)
--   i_created_by: operator login or 'system'
-- Returns: o_id

CREATE OR REPLACE FUNCTION sp_email_validation_checks_insert(
    i_email_validation_run_id INTEGER,
    i_check_type VARCHAR(100),
    i_status VARCHAR(50),
    i_detail TEXT DEFAULT NULL,
    i_url_tested VARCHAR(2048) DEFAULT NULL,
    i_diff_percent VARCHAR(20) DEFAULT NULL,
    i_http_status INTEGER DEFAULT NULL,
    i_artifact_path VARCHAR(1024) DEFAULT NULL,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO email_validation_checks (
        email_validation_run_id,
        check_type,
        status,
        detail,
        url_tested,
        diff_percent,
        http_status,
        artifact_path,
        created_by,
        updated_by
    ) VALUES (
        i_email_validation_run_id,
        i_check_type,
        i_status,
        i_detail,
        i_url_tested,
        i_diff_percent,
        i_http_status,
        i_artifact_path,
        i_created_by,
        i_created_by
    )
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id;
END;
$$;
