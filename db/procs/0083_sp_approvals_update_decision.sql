BEGIN
-- Stored procedure: Record an operator decision on a pending approval.
-- Status transitions: pending -> approved | rejected | timed_out
-- Returns: TABLE with updated approval id and new status.

CREATE OR REPLACE FUNCTION sp_approvals_update_decision(
    i_id          INTEGER,
    i_status      VARCHAR(50),   -- 'approved' | 'rejected' | 'timed_out'
    i_decided_by  VARCHAR(255)   DEFAULT NULL,
    i_reason      TEXT           DEFAULT NULL,
    i_updated_by  VARCHAR(255)   DEFAULT 'system'
)
RETURNS TABLE(
    o_id     INTEGER,
    o_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE approvals
    SET
        status       = i_status,
        decided_by   = i_decided_by,
        decided_at   = CURRENT_TIMESTAMP,
        reason       = i_reason,
        updated_date = CURRENT_TIMESTAMP,
        updated_by   = i_updated_by
    WHERE id = i_id
      AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Approval % not found or already decided', i_id;
    END IF;

    o_id     := i_id;
    o_status := i_status;
    RETURN NEXT;
END;
$$;
END;
