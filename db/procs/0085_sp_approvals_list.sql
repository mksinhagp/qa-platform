BEGIN
-- Stored procedure: List approvals with optional filters.
-- Joins run_steps and run_executions to surface run context for the dashboard.
-- Used by the live Approvals page and the run detail pending-approvals banner.

CREATE OR REPLACE FUNCTION sp_approvals_list(
    i_status         VARCHAR(50)  DEFAULT NULL,   -- NULL = all statuses
    i_run_id         INTEGER      DEFAULT NULL,   -- filter to a single run
    i_category       VARCHAR(100) DEFAULT NULL,
    i_limit          INTEGER      DEFAULT 50,
    i_offset         INTEGER      DEFAULT 0
)
RETURNS TABLE(
    o_id                INTEGER,
    o_run_step_id       INTEGER,
    o_run_execution_id  INTEGER,
    o_run_id            INTEGER,
    o_run_name          VARCHAR(255),
    o_step_name         VARCHAR(255),
    o_flow_name         VARCHAR(100),
    o_persona_id        VARCHAR(100),
    o_category          VARCHAR(100),
    o_target_type       VARCHAR(100),
    o_target_id         VARCHAR(255),
    o_payload_summary   TEXT,
    o_required_strength VARCHAR(50),
    o_status            VARCHAR(50),
    o_decided_by        VARCHAR(255),
    o_decided_at        TIMESTAMP WITH TIME ZONE,
    o_reason            TEXT,
    o_timeout_at        TIMESTAMP WITH TIME ZONE,
    o_created_date      TIMESTAMP WITH TIME ZONE,
    o_updated_date      TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.run_step_id,
        rs.run_execution_id,
        re.run_id,
        r.name,
        rs.step_name,
        re.flow_name,
        re.persona_id,
        a.category,
        a.target_type,
        a.target_id,
        a.payload_summary,
        a.required_strength,
        a.status,
        a.decided_by,
        a.decided_at,
        a.reason,
        a.timeout_at,
        a.created_date,
        a.updated_date
    FROM approvals a
    JOIN run_steps      rs ON rs.id  = a.run_step_id
    JOIN run_executions re ON re.id  = rs.run_execution_id
    JOIN runs           r  ON r.id   = re.run_id
    WHERE
        (i_status   IS NULL OR a.status   = i_status)
        AND (i_run_id   IS NULL OR re.run_id  = i_run_id)
        AND (i_category IS NULL OR a.category = i_category)
    ORDER BY
        CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END ASC,
        a.created_date DESC
    LIMIT  i_limit
    OFFSET i_offset;
END;
$$;
END;
