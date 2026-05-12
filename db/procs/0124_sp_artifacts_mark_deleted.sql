BEGIN
-- ============================================================
-- Stored Procedure: 0124_sp_artifacts_mark_deleted
-- Phase 11.1: Retention enforcement audits and cleanup
--
-- Purpose: Hard-delete artifact records by their IDs.
--   The cleanup job deletes the actual files from disk first, then
--   calls this procedure to remove the DB records.
--   Accepts an array of IDs so the entire batch can be committed
--   in one round-trip.
--
-- Parameters:
--   i_artifact_ids  INTEGER[]  Array of artifact IDs to delete
--
-- Returns: o_deleted_count INTEGER — number of rows actually deleted.
-- ============================================================

CREATE OR REPLACE FUNCTION sp_artifacts_mark_deleted(
    i_artifact_ids INTEGER[]
)
RETURNS TABLE(
    o_deleted_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete the artifact records whose IDs appear in the input array
    DELETE FROM artifacts
    WHERE id = ANY(i_artifact_ids);

    -- Capture the number of rows removed
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN QUERY SELECT v_deleted_count;
END;
$$;

END;
