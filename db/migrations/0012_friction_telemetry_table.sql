BEGIN
-- Migration 0012: Friction telemetry table
-- Stores per-execution friction signals captured by the runner

CREATE TABLE IF NOT EXISTS friction_signals (
    id SERIAL PRIMARY KEY,
    run_execution_id INTEGER NOT NULL REFERENCES run_executions(id) ON DELETE CASCADE,
    signal_type VARCHAR(100) NOT NULL,
    -- Signal types: 'repeated_click_non_interactive', 'hover_without_click', 'scroll_up_after_submit',
    --               'field_edited_multiple_times', 'focus_exit_empty_required', 'back_button_in_flow',
    --               'time_to_first_action', 'abandonment', 'retry_after_error', 'long_pause'
    step_name VARCHAR(255),
    element_selector TEXT,
    metadata JSONB,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_friction_signals_execution_id ON friction_signals(run_execution_id);
CREATE INDEX idx_friction_signals_signal_type ON friction_signals(signal_type);
CREATE INDEX idx_friction_signals_occurred_at ON friction_signals(occurred_at);

END;
