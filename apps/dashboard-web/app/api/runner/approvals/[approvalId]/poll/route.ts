/**
 * GET /api/runner/approvals/:approvalId/poll
 *
 * Used by the runner to poll for an operator decision on a pending approval.
 * Returns: { decided: boolean, status?: 'approved' | 'rejected' | 'timed_out' }
 *
 * Authentication: X-Runner-Token validated against the run_execution's callback_token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { invokeProc, invokeProcWrite } from '@qa-platform/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> },
) {
  const { approvalId: approvalIdStr } = await params;
  const token = request.headers.get('x-runner-token');

  if (!token) {
    return NextResponse.json({ error: 'Missing runner token' }, { status: 401 });
  }

  const approvalId = Number.parseInt(approvalIdStr, 10);
  if (!Number.isFinite(approvalId) || approvalId <= 0) {
    return NextResponse.json({ error: 'Invalid approval ID' }, { status: 400 });
  }

  try {
    const rows = await invokeProc('sp_approvals_get_by_id_for_runner', {
      i_id: approvalId,
      i_callback_token: token,
    });

    if (!rows.length) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    const row = rows[0] as {
      o_status: string;
      o_reason: string | null;
      o_timeout_at: Date;
    };

    const status = row.o_status;

    if (status === 'pending') {
      // Auto-expire if past timeout — persist the timed_out status in DB
      if (new Date() > new Date(row.o_timeout_at)) {
        try {
          await invokeProcWrite('sp_approvals_update_decision', {
            i_id: approvalId,
            i_status: 'timed_out',
            i_decided_by: null,
            i_reason: 'Automatically expired — no operator decision before timeout',
            i_updated_by: 'system',
          });
        } catch {
          // Already decided by another thread — ignore
        }
        return NextResponse.json({ decided: true, status: 'timed_out' });
      }
      return NextResponse.json({ decided: false });
    }

    return NextResponse.json({
      decided: true,
      status,
      reason: row.o_reason,
    });
  } catch (err) {
    console.error('Approval poll error:', err);
    return NextResponse.json({ error: 'Failed to poll approval' }, { status: 500 });
  }
}
