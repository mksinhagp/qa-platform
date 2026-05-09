'use server';

import { invokeProc } from '@qa-platform/db';
import { requireOperator } from '@qa-platform/auth';

export interface ApprovalPolicy {
  id: number;
  action_category: string;
  default_strength: string;
  description: string | null;
  is_system: boolean;
}

export interface ApprovalPoliciesListResult {
  success: boolean;
  policies?: ApprovalPolicy[];
  error?: string;
}

export async function listApprovalPolicies(
  isSystem?: boolean
): Promise<ApprovalPoliciesListResult> {
  try {
    await requireOperator();

    const result = await invokeProc('sp_approval_policies_list', {
      i_is_system: isSystem ?? null,
    });

    const policies: ApprovalPolicy[] = result.map((row: {
      o_id: number;
      o_action_category: string;
      o_default_strength: string;
      o_description: string | null;
      o_is_system: boolean;
    }) => ({
      id: row.o_id,
      action_category: row.o_action_category,
      default_strength: row.o_default_strength,
      description: row.o_description,
      is_system: row.o_is_system,
    }));

    return { success: true, policies };
  } catch (error) {
    console.error('List approval policies error:', error);
    return { success: false, error: 'Failed to list approval policies' };
  }
}
