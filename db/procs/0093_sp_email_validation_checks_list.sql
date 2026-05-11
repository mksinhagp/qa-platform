-- Stored Procedure: sp_email_validation_checks_list
-- Purpose: Retrieve all individual check results for an email validation run
-- Parameters:
--   i_email_validation_run_id: email_validation_runs.id
-- Returns: all check rows ordered by creation time

CREATE OR REPLACE FUNCTION sp_email_validation_checks_list(
    i_email_validation_run_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_email_validation_run_id INTEGER,
    o_check_type VARCHAR(100),
    o_status VARCHAR(50),
    o_detail TEXT,
    o_url_tested VARCHAR(2048),
    o_diff_percent VARCHAR(20),
    o_http_status INTEGER,
    o_artifact_path VARCHAR(1024),
    o_created_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        evc.id AS o_id,
        evc.email_validation_run_id AS o_email_validation_run_id,
        evc.check_type AS o_check_type,
        evc.status AS o_status,
        evc.detail AS o_detail,
        evc.url_tested AS o_url_tested,
        evc.diff_percent AS o_diff_percent,
        evc.http_status AS o_http_status,
        evc.artifact_path AS o_artifact_path,
        evc.created_date AS o_created_date
    FROM email_validation_checks evc
    WHERE evc.email_validation_run_id = i_email_validation_run_id
    ORDER BY evc.created_date ASC;
END;
$$;
