'use server';

import { invokeProc } from '@qa-platform/db';
import { requireOperator } from '@qa-platform/auth';

export interface AuditLogEntry {
  id: number;
  actor_type: string;
  actor_id: string;
  action: string;
  target: string;
  status: string;
  details: string | null;
  created_date: string;
}

export interface LogAuditInput {
  action: string;
  target: string;
  status: string;
  details?: Record<string, unknown>;
}

export interface AuditListResult {
  success: boolean;
  logs?: AuditLogEntry[];
  error?: string;
}

export async function logAudit(params: LogAuditInput): Promise<void> {
  try {
    const authContext = await requireOperator();
    await invokeProc('sp_audit_logs_insert', {
      i_actor_type: 'operator',
      i_actor_id: authContext.operatorId?.toString() || 'system',
      i_action: params.action,
      i_target: params.target,
      i_status: params.status,
      i_details: params.details ? JSON.stringify(params.details) : null,
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

export async function queryAuditLogs(
  actorId?: string,
  action?: string,
  target?: string,
  status?: string,
  limit: number = 100
): Promise<AuditListResult> {
  try {
    await requireOperator();

    const result = await invokeProc('sp_audit_logs_query', {
      i_actor_id: actorId || null,
      i_action: action || null,
      i_target: target || null,
      i_status: status || null,
      i_limit: limit,
    });

    const logs: AuditLogEntry[] = result.map((row: {
      o_id: number;
      o_actor_type: string;
      o_actor_id: string;
      o_action: string;
      o_target: string;
      o_status: string;
      o_details: string | null;
      o_created_date: string;
    }) => ({
      id: row.o_id,
      actor_type: row.o_actor_type,
      actor_id: row.o_actor_id,
      action: row.o_action,
      target: row.o_target,
      status: row.o_status,
      details: row.o_details,
      created_date: row.o_created_date,
    }));

    return { success: true, logs };
  } catch (error) {
    console.error('Query audit logs error:', error);
    return { success: false, error: 'Failed to query audit logs' };
  }
}
